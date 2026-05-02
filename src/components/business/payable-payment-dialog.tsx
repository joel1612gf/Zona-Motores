'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, runTransaction, serverTimestamp, orderBy
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/utils';
import type { PayableRow } from '@/lib/payable-schemas';
import type { PaymentSplit } from '@/lib/finance-schemas';
import type { BankAccount } from '@/lib/business-types';
import { PaymentEngine } from './payment-engine';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertCircle, CheckCircle2, ChevronRight, ChevronLeft,
  Loader2, FileWarning, AlertTriangle, Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadPdf } from '@/lib/download-pdf';

// ─── Props ───────────────────────────────────────────────────────────────────

interface PayablePaymentDialogProps {
  open: boolean;
  row: PayableRow;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── IGTF calculation (per split) ────────────────────────────────────────────

/**
 * Calculates IGTF (3%) only on USD-denominated splits from fiscal invoices.
 * Non-fiscal documents (Nota de Entrega, Consignación) are exempt — is_fiscal === false.
 */
function calcIgtf(splits: PaymentSplit[], isFiscal: boolean): number {
  if (!isFiscal) return 0;
  return splits
    .filter(s => s.currency === 'USD')
    .reduce((acc, s) => acc + s.equivalentUsd * 0.03, 0);
}

// ─── Origin label ─────────────────────────────────────────────────────────────

function origenLabel(origen: string): string {
  const map: Record<string, string> = {
    compra_factura: 'Factura Fiscal',
    compra_nota_entrega: 'Nota de Entrega',
    consignacion: 'Consignación',
    nota_debito: 'Nota de Débito',
    gasto: 'Gasto Operativo',
  };
  return map[origen] || 'Otros';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PayablePaymentDialog({ open, row, onOpenChange, onSuccess }: PayablePaymentDialogProps) {
  const { concesionario, staff } = useBusinessAuth();
  const { bcvRate } = useCurrency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const concId = concesionario?.id;

  const [step, setStep] = useState<'monto' | 'pago' | 'confirmar' | 'exito'>('monto');
  const [payCurrency, setPayCurrency] = useState<'USD' | 'VES'>('USD');
  const [montoPagoOriginal, setMontoPagoOriginal] = useState(row.saldo_pendiente);
  const [montoPagoInput, setMontoPagoInput] = useState(String(row.saldo_pendiente));
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [payEngineValid, setPayEngineValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const isDebtBs = row.moneda_original === 'bs';
  const safeBcvRate = bcvRate || 1;

  // Reset local state whenever the source row changes (e.g. user opens a different debt)
  useEffect(() => {
    setStep('monto');
    setPayCurrency(isDebtBs ? 'VES' : 'USD');
    setMontoPagoOriginal(row.saldo_pendiente);
    setMontoPagoInput(String(row.saldo_pendiente));
    setSplits([]);
    setPayEngineValid(false);
    setReferencia('');
    setIsDownloading(false);
  }, [row.id, row.saldo_pendiente, isDebtBs]);

  // ── Fetch active bank accounts for PaymentEngine ────────────────────────────
  const bankQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'cuentas_bancarias'),
      where('activa', '==', true),
      orderBy('nombre')
    );
  }, [concId, firestore]);
  const { data: bankAccountsRaw } = useCollection<BankAccount>(bankQuery);
  const bankAccounts = bankAccountsRaw ?? [];

  // Derived
  const totalUsdToPay = isDebtBs ? montoPagoOriginal / safeBcvRate : montoPagoOriginal;
  const igtfMonto = useMemo(() => calcIgtf(splits, !!row.is_fiscal), [splits, row.is_fiscal]);
  const totalSaleDelBanco = totalUsdToPay + igtfMonto;
  const hasIgtf = igtfMonto > 0;

  function handleCurrencyToggle(newCur: 'USD' | 'VES') {
    if (newCur === payCurrency) return;
    setPayCurrency(newCur);
    if (newCur === 'USD') {
      const val = isDebtBs ? montoPagoOriginal / safeBcvRate : montoPagoOriginal;
      setMontoPagoInput(val.toFixed(2));
    } else {
      const val = isDebtBs ? montoPagoOriginal : montoPagoOriginal * safeBcvRate;
      setMontoPagoInput(val.toFixed(2));
    }
  }

  function handleInputChange(valStr: string) {
    setMontoPagoInput(valStr);
    const val = parseFloat(valStr) || 0;
    
    let originalVal = 0;
    if (payCurrency === 'USD') {
      originalVal = isDebtBs ? val * safeBcvRate : val;
    } else {
      originalVal = isDebtBs ? val : val / safeBcvRate;
    }
    
    setMontoPagoOriginal(Math.min(originalVal, row.saldo_pendiente));
  }

  const handleEngineChange = useCallback((valid: boolean, newSplits: PaymentSplit[], _totalEquivalentUsd: number) => {
    setPayEngineValid(valid);
    setSplits(newSplits);
  }, []);

  // ─── Atomic Transaction ────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!concId || !staff || splits.length === 0) return;
    setIsSaving(true);
    try {
      await runTransaction(firestore, async (transaction) => {
        // ── Reads first (mandatory before any writes) ────────────────────────
        const bankSnaps: Record<string, any> = {};
        for (const split of splits) {
          if (split.accountId && !bankSnaps[split.accountId]) {
            const bankRef = doc(firestore, 'concesionarios', concId, 'cuentas_bancarias', split.accountId);
            bankSnaps[split.accountId] = await transaction.get(bankRef);
          }
        }

        let sourceRef: ReturnType<typeof doc> | null = null;
        let sourceData: any = null;

        if (row.origen === 'vehiculo' && row.compra_id) {
          sourceRef = doc(firestore, 'concesionarios', concId, 'inventario', row.compra_id);
          const snap = await transaction.get(sourceRef);
          if (!snap.exists()) throw new Error('El vehículo ya no existe.');
          sourceData = snap.data();
        } else if (row.compra_id) {
          sourceRef = doc(firestore, 'concesionarios', concId, 'compras', row.compra_id);
          const snap = await transaction.get(sourceRef);
          if (!snap.exists()) throw new Error('El documento de compra ya no existe.');
          sourceData = snap.data();
        } else if (row.consignacion_id) {
          sourceRef = doc(firestore, 'concesionarios', concId, 'consignaciones_por_pagar', row.consignacion_id);
          const snap = await transaction.get(sourceRef);
          if (!snap.exists()) throw new Error('El registro de consignación ya no existe.');
          sourceData = snap.data();
        } else if (row.gasto_id) {
          sourceRef = doc(firestore, 'concesionarios', concId, 'gastos', row.gasto_id);
          const snap = await transaction.get(sourceRef);
          if (!snap.exists()) throw new Error('El registro de gasto ya no existe.');
          sourceData = snap.data();
        }

        // ── Writes second ────────────────────────────────────────────────────

        // 1. Update source document balance
        if (sourceRef && sourceData !== null) {
          const currentSaldo = sourceData.saldo_pendiente ?? sourceData.neto_a_pagar ?? sourceData.total_usd ?? sourceData.total_bs ?? 0;
          const newSaldo = Math.max(0, currentSaldo - montoPagoOriginal);
          const newMontoPagado = (sourceData.monto_pagado || 0) + montoPagoOriginal;
          
          const updateData: any = {
            saldo_pendiente: newSaldo,
            monto_pagado: newMontoPagado,
            updated_at: serverTimestamp(),
          };

          // Map status based on collection conventions
          // 'parcial' = at least one payment made but balance remains
          if (row.origen === 'vehiculo') {
            updateData.estado_pago = newSaldo <= 0.001 ? 'pagada' : 'pendiente';
          } else if (row.gasto_id) {
            updateData.status = newSaldo <= 0.001 ? 'COMPLETADO' : 'PENDIENTE';
          } else {
            updateData.estado = newSaldo <= 0.001 ? 'pagada' : 'parcial';
          }

          transaction.update(sourceRef, updateData);
        }

        // 2. Process each bank split
        const bankTotals: Record<string, { prev: number; next: number }> = {};

        for (const split of splits) {
          if (!split.accountId || !bankSnaps[split.accountId]?.exists()) continue;
          const bankData = bankSnaps[split.accountId].data();

          if (!bankTotals[split.accountId]) {
            bankTotals[split.accountId] = {
              prev: bankData.saldo_actual || 0,
              next: bankData.saldo_actual || 0,
            };
          }

          const prevForSplit = bankTotals[split.accountId].next;
          // IGTF: only if fiscal invoice and the split's currency is USD
          const splitIgtf = (row.is_fiscal && split.currency === 'USD') ? split.equivalentUsd * 0.03 : 0;
          bankTotals[split.accountId].next -= (split.amount + splitIgtf);
          const nextAfterBoth = bankTotals[split.accountId].next;

          // CXP payment movement
          const txRef = doc(collection(firestore, 'concesionarios', concId, 'cuentas_bancarias', split.accountId, 'transacciones'));
          transaction.set(txRef, {
            cuenta_id: split.accountId,
            tipo: 'egreso_cxp',
            flujo: 'salida',
            monto: split.amount,
            metodo_pago: split.method,
            concepto: `Pago CXP: ${origenLabel(row.origen)} — ${row.proveedor_nombre}`,
            referencia: referencia || null,
            registrado_por_id: staff.id,
            registrado_por_nombre: staff.nombre,
            saldo_anterior: prevForSplit,
            saldo_posterior: nextAfterBoth + splitIgtf, // balance before IGTF is deducted
            fecha: serverTimestamp(),
            compra_id: row.compra_id || null,
          });

          // Separate IGTF movement (fisco line item)
          if (splitIgtf > 0) {
            const igtfRef = doc(collection(firestore, 'concesionarios', concId, 'cuentas_bancarias', split.accountId, 'transacciones'));
            transaction.set(igtfRef, {
              cuenta_id: split.accountId,
              tipo: 'egreso_igtf',
              flujo: 'salida',
              monto: splitIgtf,
              metodo_pago: split.method,
              concepto: `IGTF (3%) — Pago CXP: ${row.proveedor_nombre}`,
              registrado_por_id: staff.id,
              registrado_por_nombre: staff.nombre,
              saldo_anterior: nextAfterBoth + splitIgtf,
              saldo_posterior: nextAfterBoth,
              fecha: serverTimestamp(),
              compra_id: row.compra_id || null,
            });
          }
        }

        // Update bank account balances
        for (const [accId, totals] of Object.entries(bankTotals)) {
          transaction.update(
            doc(firestore, 'concesionarios', concId, 'cuentas_bancarias', accId),
            { saldo_actual: totals.next, updated_at: serverTimestamp() }
          );
        }
      });

      setStep('exito');
    } catch (e: any) {
      console.error('CXP payment error:', e);
      toast({ title: 'Error al registrar pago', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) setStep('monto'); onOpenChange(o); }}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2rem]">
        {/* Header */}
        <div className="bg-primary/5 p-5 border-b flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-primary" />
              Registrar Pago
            </DialogTitle>
            <DialogDescription className="text-xs">
              {origenLabel(row.origen)} — {row.proveedor_nombre}
            </DialogDescription>
          </DialogHeader>

          {/* Balance summary */}
          <div className="mt-4 flex gap-3">
            <div className="flex-1 rounded-2xl bg-background/80 p-3 ring-1 ring-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Original</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(row.monto_original, row.moneda_original === 'bs' ? 'VES' : 'USD')}
              </p>
            </div>
            <div className="flex-1 rounded-2xl bg-amber-500/5 p-3 ring-1 ring-amber-500/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Saldo Pendiente</p>
              <p className="text-lg font-bold text-amber-700">
                {formatCurrency(row.saldo_pendiente, row.moneda_original === 'bs' ? 'VES' : 'USD')}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step: Monto ── */}
          {step === 'monto' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Monto a Pagar
                  </Label>
                  <div className="flex items-center bg-muted/50 rounded-lg p-1">
                    <button
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-all",
                        payCurrency === 'USD' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => handleCurrencyToggle('USD')}
                    >
                      USD
                    </button>
                    <button
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-all",
                        payCurrency === 'VES' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => handleCurrencyToggle('VES')}
                    >
                      Bs
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={montoPagoInput}
                    onChange={e => handleInputChange(e.target.value)}
                    className="h-14 text-2xl font-bold rounded-2xl text-center pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                    {payCurrency}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Máx: {formatCurrency(isDebtBs ? (payCurrency === 'USD' ? row.saldo_pendiente / safeBcvRate : row.saldo_pendiente) : (payCurrency === 'USD' ? row.saldo_pendiente : row.saldo_pendiente * safeBcvRate), payCurrency)}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Referencia (opcional)
                </Label>
                <Input
                  placeholder="Nº comprobante, transferencia..."
                  value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>

              {!row.is_fiscal && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-slate-500/5 ring-1 ring-slate-500/20">
                  <CheckCircle2 className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600 font-medium">
                    Documento no fiscal: no involucra IGTF ni retención de IVA.
                  </p>
                </div>
              )}
              {row.is_fiscal && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/5 ring-1 ring-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">
                    Factura fiscal: Si pagas en Divisas (USD), se aplicará IGTF 3% como egreso operativo del banco.
                  </p>
                </div>
              )}

              <Button
                className="w-full h-12 rounded-2xl font-bold text-base shadow-xl shadow-primary/20"
                disabled={montoPagoOriginal <= 0 || montoPagoOriginal > row.saldo_pendiente}
                onClick={() => setStep('pago')}
              >
                Seleccionar Método de Pago
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* ── Step: Pago ── */}
          {step === 'pago' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <PaymentEngine
                totalUsd={totalUsdToPay}
                tasaBcv={bcvRate ?? 0}
                bankAccounts={bankAccounts}
                onValidChange={handleEngineChange}
                isFiscal={!!row.is_fiscal}
              />

              {/* IGTF badge — live update */}
              {hasIgtf && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/5 ring-1 ring-amber-500/20 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">IGTF 3% (Divisas)</span>
                  </div>
                  <span className="text-sm font-bold text-amber-700">
                    + {formatCurrency(igtfMonto, 'USD')}
                  </span>
                </div>
              )}

              {hasIgtf && (
                <div className="p-3 rounded-2xl bg-primary/5 ring-1 ring-primary/20">
                  <div className="flex justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total sale del banco</span>
                    <span className="text-base font-bold text-primary">{formatCurrency(totalSaleDelBanco, 'USD')}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatCurrency(totalUsdToPay, 'USD')} al proveedor + {formatCurrency(igtfMonto, 'USD')} IGTF (fisco)
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl h-12 flex-1"
                  onClick={() => setStep('monto')}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
                </Button>
                <Button
                  className="rounded-2xl h-12 flex-1 shadow-xl shadow-primary/20 font-bold"
                  disabled={!payEngineValid}
                  onClick={() => setStep('confirmar')}
                >
                  Revisar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Confirmar ── */}
          {step === 'confirmar' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="rounded-2xl ring-1 ring-border overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 border-b">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen del Pago</p>
                </div>
                <div className="p-4 space-y-3">
                  <SummaryRow label="Acreedor" value={row.proveedor_nombre} />
                  <SummaryRow label="Tipo" value={origenLabel(row.origen)} />
                  <SummaryRow label="Monto a Pagar" value={formatCurrency(totalUsdToPay, 'USD')} bold />
                  {hasIgtf && <SummaryRow label="IGTF 3% (Egreso)" value={`+ ${formatCurrency(igtfMonto, 'USD')}`} accent="amber" />}
                  <SummaryRow label="Total sale del banco" value={formatCurrency(totalSaleDelBanco, 'USD')} bold accent={hasIgtf ? 'primary' : undefined} />
                  {bcvRate && (
                    <SummaryRow
                      label="Equiv. Bs (BCV)"
                      value={`Bs ${(totalSaleDelBanco * bcvRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
                    />
                  )}
                  {referencia && <SummaryRow label="Referencia" value={referencia} />}
                </div>
              </div>

              {/* Splits summary */}
              <div className="space-y-2">
                {splits.map((s, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-2 rounded-2xl bg-muted/40 ring-1 ring-border">
                    <div>
                      <p className="text-xs font-bold">{s.accountName || s.method}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{s.method}</p>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(s.amount, s.currency)}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl h-12 flex-1"
                  onClick={() => setStep('pago')}
                  disabled={isSaving}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
                </Button>
                <Button
                  className="rounded-2xl h-12 flex-1 shadow-xl shadow-primary/20 font-bold"
                  onClick={handleConfirm}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Pago</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Éxito ── */}
          {step === 'exito' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">¡Pago Registrado!</h2>
                <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                  El saldo ha sido actualizado y el movimiento bancario fue registrado correctamente.
                </p>
                {hasIgtf && (
                  <p className="text-xs text-amber-600 font-medium">
                    IGTF de {formatCurrency(igtfMonto, 'USD')} registrado como egreso operativo separado.
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="w-full space-y-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full rounded-2xl h-12 font-bold gap-2"
                  disabled={isDownloading}
                  onClick={async () => {
                    setIsDownloading(true);
                    try {
                      await downloadPdf({ elementId: 'cxp-receipt-print-root', filename: `Comprobante_Pago_${row.proveedor_nombre}.pdf` });
                    } finally {
                      setIsDownloading(false);
                    }
                  }}
                >
                  {isDownloading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Printer className="h-4 w-4" />
                  }
                  Imprimir Comprobante
                </Button>
                <Button
                  size="lg"
                  className="w-full rounded-2xl h-14 font-bold shadow-xl"
                  onClick={() => { onSuccess(); onOpenChange(false); }}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Hidden Payment Receipt (for printing) ─────────────────────────── */}
    <div style={{ display: 'none' }}>
      <div id="cxp-receipt-print-root" style={{
        fontFamily: 'Arial, sans-serif',
        width: '210mm',
        minHeight: '148mm',
        padding: '20mm 18mm',
        backgroundColor: '#ffffff',
        color: '#111',
        fontSize: '11px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #2463eb', paddingBottom: '12px', marginBottom: '16px' }}>
          <p style={{ fontSize: '18px', fontWeight: 900, color: '#2463eb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            COMPROBANTE DE PAGO
          </p>
          <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            Zona Motores Business · {new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Debt info table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <tbody>
            {([
              ['Acreedor / Proveedor', row.proveedor_nombre],
              ['Tipo de Documento', origenLabel(row.origen)],
              ['Monto Pagado', formatCurrency(totalUsdToPay, 'USD')],
              ...(hasIgtf ? [['IGTF 3% (Egreso Operativo)', `+ ${formatCurrency(igtfMonto, 'USD')}`]] : []),
              ['Total Debitado del Banco', formatCurrency(totalSaleDelBanco, 'USD')],
              ...(referencia ? [['Nº Referencia', referencia]] : []),
              ['Registrado por', staff?.nombre || '—'],
            ] as [string, string][]).map(([label, value], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px 4px', color: '#666', width: '45%', fontWeight: 600 }}>{label}</td>
                <td style={{ padding: '6px 4px', fontWeight: 700, color: '#111' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Payment splits */}
        {splits.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '9px', color: '#888', letterSpacing: '0.15em', marginBottom: '6px' }}>Detalle de Pago</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #eee', borderRadius: '6px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f7ff' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#444' }}>Cuenta / Método</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#444' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '5px 8px' }}>{s.accountName || s.method}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(s.amount, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#888' }}>
          <span>Generado por Zona Motores Business</span>
          <span>{new Date().toLocaleTimeString('es-VE')}</span>
        </div>
      </div>
    </div>
  </>);
}

// ─── Small helper ────────────────────────────────────────────────────────────

function SummaryRow({ label, value, bold, accent }: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: 'primary' | 'amber';
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'text-sm',
        bold ? 'font-bold' : 'font-medium',
        accent === 'primary' && 'text-primary',
        accent === 'amber' && 'text-amber-600',
      )}>{value}</span>
    </div>
  );
}
