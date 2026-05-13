'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  runTransaction,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, roundMoney, cn } from '@/lib/utils';
import type { ReceivableRow } from '@/lib/receivable-schemas';
import type { PaymentSplit } from '@/lib/finance-schemas';
import type { BankAccount, BankEntryMethod } from '@/lib/business-types';
import { PaymentEngine } from './payment-engine';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Loader2,
  Printer,
} from 'lucide-react';
import { downloadPdf } from '@/lib/download-pdf';

const DEFAULT_IGTF_ENTRY_METHODS: BankEntryMethod[] = [
  'efectivo_fisico',
  'zelle',
  'crypto',
  'transferencia',
];

interface ReceivablePaymentDialogProps {
  open: boolean;
  rows: ReceivableRow[];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function origenLabel(origen: ReceivableRow['origen']): string {
  const map: Record<ReceivableRow['origen'], string> = {
    venta_credito_vehiculo: 'Financiamiento Vehículo',
    venta_credito_producto: 'Crédito Comercial',
    nota_debito_cliente: 'Nota de Débito',
  };
  return map[origen];
}

function calcIgtf(splits: PaymentSplit[], isFiscal: boolean): number {
  if (!isFiscal) return 0;
  return splits.reduce((acc, s) => acc + (s.igtfAmount ?? 0), 0);
}

export function ReceivablePaymentDialog({
  open,
  rows,
  onOpenChange,
  onSuccess,
}: ReceivablePaymentDialogProps) {
  const { concesionario, staff } = useBusinessAuth();
  const { bcvRate } = useCurrency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const concId = concesionario?.id;
  const safeBcvRate = bcvRate || 1;

  const primaryRow = rows[0];
  const isMulti = rows.length > 1;

  // Saldos siempre en USD (canonical). CXC nunca usa tasa_cambio histórica para conversión.
  const aggregateSaldo = useMemo(
    () => roundMoney(rows.reduce((acc, r) => acc + r.saldo_pendiente, 0)),
    [rows]
  );
  const aggregateOriginal = useMemo(
    () => roundMoney(rows.reduce((acc, r) => acc + r.monto_original, 0)),
    [rows]
  );

  const anyFiscal = rows.some((r) => r.is_fiscal);

  const [step, setStep] = useState<'monto' | 'pago' | 'confirmar' | 'exito'>('monto');
  const [payCurrency, setPayCurrency] = useState<'USD' | 'VES'>('USD');
  const [montoPagoUsd, setMontoPagoUsd] = useState(aggregateSaldo);
  const [montoPagoInput, setMontoPagoInput] = useState(aggregateSaldo.toFixed(2));
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [payEngineValid, setPayEngineValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const isSpecialTaxpayer = !!concesionario?.configuracion?.sujeto_pasivo_especial;
  const igtfTriggerMethods = (concesionario?.configuracion?.igtf_trigger_entry_methods?.length
    ? concesionario.configuracion.igtf_trigger_entry_methods
    : DEFAULT_IGTF_ENTRY_METHODS) as BankEntryMethod[];

  useEffect(() => {
    setStep('monto');
    setPayCurrency('USD');
    setMontoPagoUsd(aggregateSaldo);
    setMontoPagoInput(aggregateSaldo.toFixed(2));
    setSplits([]);
    setPayEngineValid(false);
    setReferencia('');
    setIsDownloading(false);
  }, [primaryRow.id, aggregateSaldo]);

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

  const igtfMonto = useMemo(() => calcIgtf(splits, anyFiscal), [splits, anyFiscal]);
  const totalEntraAlBanco = montoPagoUsd + igtfMonto;
  const hasIgtf = igtfMonto > 0;

  function handleCurrencyToggle(newCur: 'USD' | 'VES') {
    if (newCur === payCurrency) return;
    setPayCurrency(newCur);
    if (newCur === 'USD') {
      setMontoPagoInput(montoPagoUsd.toFixed(2));
    } else {
      setMontoPagoInput(roundMoney(montoPagoUsd * safeBcvRate).toFixed(2));
    }
  }

  function handleInputChange(valStr: string) {
    setMontoPagoInput(valStr);
    const val = parseFloat(valStr) || 0;
    // BCV LIVE (no histórico): convertimos siempre con bcvRate actual.
    const inUsd = payCurrency === 'USD' ? val : val / safeBcvRate;
    setMontoPagoUsd(Math.min(roundMoney(inUsd), aggregateSaldo));
  }

  const handleEngineChange = useCallback(
    (valid: boolean, newSplits: PaymentSplit[]) => {
      setPayEngineValid(valid);
      setSplits(newSplits);
    },
    []
  );

  function refForRow(r: ReceivableRow) {
    if (!concId) return null;
    if (r.origen === 'nota_debito_cliente' && r.nota_id) {
      return doc(firestore, 'concesionarios', concId, 'notas_fiscales', r.nota_id);
    }
    if (r.cuenta_cobrar_id && r.cuota_id) {
      return doc(
        firestore,
        'concesionarios',
        concId,
        'cuentas_por_cobrar',
        r.cuenta_cobrar_id,
        'cuotas',
        r.cuota_id
      );
    }
    return null;
  }

  async function handleConfirm() {
    if (!concId || !staff || splits.length === 0) return;
    setIsSaving(true);
    try {
      await runTransaction(firestore, async (transaction) => {
        // ── Reads first ──────────────────────────────────────────────
        const bankSnaps: Record<string, any> = {};
        for (const split of splits) {
          if (split.accountId && !bankSnaps[split.accountId]) {
            const bankRef = doc(
              firestore,
              'concesionarios',
              concId,
              'cuentas_bancarias',
              split.accountId
            );
            bankSnaps[split.accountId] = await transaction.get(bankRef);
          }
        }

        // Distinct parent CuentaPorCobrar ids (so we can update aggregates once each)
        const cuentaIds = new Set<string>();
        rows.forEach((r) => r.cuenta_cobrar_id && cuentaIds.add(r.cuenta_cobrar_id));

        const cuentaSnaps: Record<string, { ref: ReturnType<typeof doc>; data: any }> = {};
        for (const cuentaId of cuentaIds) {
          const ref = doc(firestore, 'concesionarios', concId, 'cuentas_por_cobrar', cuentaId);
          const snap = await transaction.get(ref);
          if (!snap.exists()) {
            throw new Error(`Cuenta por cobrar ${cuentaId} no existe.`);
          }
          cuentaSnaps[cuentaId] = { ref, data: snap.data() };
        }

        // Read every receivable row source document (cuota or nota_debito)
        const sourceEntries: { row: ReceivableRow; ref: ReturnType<typeof doc>; data: any }[] = [];
        for (const r of rows) {
          const ref = refForRow(r);
          if (!ref) continue;
          const snap = await transaction.get(ref);
          if (!snap.exists()) throw new Error(`El documento ${r.descripcion} ya no existe.`);
          sourceEntries.push({ row: r, ref, data: snap.data() });
        }

        // Read parent Venta (to update its aggregate paid/saldo) — first row drives it.
        const ventaIds = new Set<string>();
        rows.forEach((r) => r.venta_id && ventaIds.add(r.venta_id));
        const ventaSnaps: Record<string, { ref: ReturnType<typeof doc>; data: any }> = {};
        for (const ventaId of ventaIds) {
          const ref = doc(firestore, 'concesionarios', concId, 'ventas', ventaId);
          const snap = await transaction.get(ref);
          if (snap.exists()) ventaSnaps[ventaId] = { ref, data: snap.data() };
        }

        // Read parent Cliente (first one available)
        const clienteIds = new Set<string>();
        rows.forEach((r) => r.cliente_id && clienteIds.add(r.cliente_id));
        const clienteSnaps: Record<string, { ref: ReturnType<typeof doc>; data: any }> = {};
        for (const clienteId of clienteIds) {
          const ref = doc(firestore, 'concesionarios', concId, 'clientes', clienteId);
          const snap = await transaction.get(ref);
          if (snap.exists()) clienteSnaps[clienteId] = { ref, data: snap.data() };
        }

        // ── Writes ──────────────────────────────────────────────────

        // 1. FIFO apply montoPagoUsd across rows (cuotas / notas)
        let remainingUsd = montoPagoUsd;
        const perCuentaApplied: Record<string, number> = {};
        const perVentaApplied: Record<string, number> = {};
        let totalAppliedUsd = 0;

        for (const entry of sourceEntries) {
          if (remainingUsd <= 0.001) break;
          const r = entry.row;
          const sourceData = entry.data;
          const currentSaldo = roundMoney(
            sourceData.saldo_usd ?? sourceData.saldo_pendiente ?? r.saldo_pendiente
          );
          if (currentSaldo <= 0.001) continue;

          const apply = roundMoney(Math.min(remainingUsd, currentSaldo));
          const newSaldo = roundMoney(currentSaldo - apply);
          const newPaid = roundMoney((sourceData.paid_usd ?? 0) + apply);
          remainingUsd = roundMoney(remainingUsd - apply);
          totalAppliedUsd = roundMoney(totalAppliedUsd + apply);

          if (r.origen === 'nota_debito_cliente') {
            transaction.update(entry.ref, {
              saldo_pendiente: newSaldo,
              status: newSaldo <= 0.001 ? 'PAGADA' : 'PENDIENTE',
              updated_at: serverTimestamp(),
            });
          } else {
            // Cuota update
            const nowDate = new Date();
            const fechaVenc = sourceData.fecha_vencimiento?.toDate?.() ?? r.fecha_vencimiento ?? nowDate;
            let nuevoEstado: string;
            if (newSaldo <= 0.001) nuevoEstado = 'pagada';
            else if (fechaVenc < nowDate) nuevoEstado = 'vencida';
            else nuevoEstado = 'parcial';

            transaction.update(entry.ref, {
              saldo_usd: newSaldo,
              paid_usd: newPaid,
              estado: nuevoEstado,
              ...(newSaldo <= 0.001 ? { pagada_at: serverTimestamp() } : {}),
            });
          }

          if (r.cuenta_cobrar_id) {
            perCuentaApplied[r.cuenta_cobrar_id] =
              (perCuentaApplied[r.cuenta_cobrar_id] ?? 0) + apply;
          }
          if (r.venta_id) {
            perVentaApplied[r.venta_id] = (perVentaApplied[r.venta_id] ?? 0) + apply;
          }
        }

        // 2. Update CuentaPorCobrar aggregates (per parent)
        for (const [cuentaId, appliedUsd] of Object.entries(perCuentaApplied)) {
          const snap = cuentaSnaps[cuentaId];
          if (!snap) continue;
          const currentSaldo = snap.data.saldo_pendiente_usd ?? 0;
          const currentPaid = snap.data.paid_usd ?? 0;
          const currentPagadas = snap.data.cuotas_pagadas ?? 0;
          const newSaldo = roundMoney(Math.max(0, currentSaldo - appliedUsd));
          const newPaid = roundMoney(currentPaid + appliedUsd);

          // Count how many of the touched rows under this cuenta have estado === 'pagada' now
          const newlyPagadas = sourceEntries.filter((e) => {
            if (e.row.cuenta_cobrar_id !== cuentaId) return false;
            if (e.row.origen === 'nota_debito_cliente') return false;
            const before = roundMoney(e.data.saldo_usd ?? e.row.saldo_pendiente);
            const applied = Math.min(appliedUsd, before);
            return before - applied <= 0.001;
          }).length;

          const newStatus = newSaldo <= 0.001 ? 'pagado' : newPaid > 0 ? 'parcial' : 'pendiente';

          transaction.update(snap.ref, {
            saldo_pendiente_usd: newSaldo,
            paid_usd: newPaid,
            cuotas_pagadas: currentPagadas + newlyPagadas,
            status: newStatus,
            updated_at: serverTimestamp(),
          });
        }

        // 3. Update parent Venta aggregates
        for (const [ventaId, appliedUsd] of Object.entries(perVentaApplied)) {
          const snap = ventaSnaps[ventaId];
          if (!snap) continue;
          const currentSaldo = snap.data.saldo_pendiente_usd ?? 0;
          const currentPaid = snap.data.paid_usd ?? 0;
          const newSaldo = roundMoney(Math.max(0, currentSaldo - appliedUsd));
          const newPaid = roundMoney(currentPaid + appliedUsd);
          const newStatus = newSaldo <= 0.001 ? 'pagado' : 'parcial';
          transaction.update(snap.ref, {
            saldo_pendiente_usd: newSaldo,
            paid_usd: newPaid,
            status_pago: newStatus,
            updated_at: serverTimestamp(),
          });
        }

        // 4. Update Cliente.deuda_actual_usd
        for (const [clienteId, snap] of Object.entries(clienteSnaps)) {
          const totalApplied = rows
            .filter((r) => r.cliente_id === clienteId)
            .reduce((acc, r) => acc + (perVentaApplied[r.venta_id ?? ''] ?? 0), 0);
          if (totalApplied <= 0) continue;
          const currentDeuda = snap.data.deuda_actual_usd ?? 0;
          const newDeuda = roundMoney(Math.max(0, currentDeuda - totalApplied));
          // Remove venta IDs that have been fully paid
          const venta_ids = (snap.data.ventas_credito_ids ?? []) as string[];
          const remainingVentaIds = venta_ids.filter((vid) => {
            const vsnap = ventaSnaps[vid];
            if (!vsnap) return true;
            const newSaldo = (vsnap.data.saldo_pendiente_usd ?? 0) - (perVentaApplied[vid] ?? 0);
            return newSaldo > 0.001;
          });
          transaction.update(snap.ref, {
            deuda_actual_usd: newDeuda,
            ventas_credito_ids: remainingVentaIds,
            updated_at: serverTimestamp(),
          });
        }

        // 5. Bank transactions — ONE ingreso_cxc per split, igtf_retenido as subfield.
        const bankTotals: Record<string, { prev: number; next: number }> = {};
        const conceptDocs = rows
          .map((r) => `${origenLabel(r.origen)} ${r.descripcion}`)
          .join(' + ');

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
          const splitIgtf = anyFiscal ? roundMoney(split.igtfAmount ?? 0) : 0;
          // Cliente paga (amount + igtf) en su moneda → suma al banco.
          const totalEntradaCuenta = roundMoney(split.amount + splitIgtf);
          bankTotals[split.accountId].next = roundMoney(
            bankTotals[split.accountId].next + totalEntradaCuenta
          );

          const txRef = doc(
            collection(
              firestore,
              'concesionarios',
              concId,
              'cuentas_bancarias',
              split.accountId,
              'transacciones'
            )
          );
          transaction.set(txRef, {
            cuenta_id: split.accountId,
            tipo: 'ingreso_cxc',
            flujo: 'entrada',
            monto: totalEntradaCuenta,
            metodo_pago: split.method,
            concepto: `Cobro CXC: ${conceptDocs} — ${primaryRow.cliente_nombre}`,
            referencia: referencia || null,
            registrado_por_id: staff.id,
            registrado_por_nombre: staff.nombre,
            saldo_anterior: prevForSplit,
            saldo_posterior: bankTotals[split.accountId].next,
            fecha: serverTimestamp(),
            venta_id: primaryRow.venta_id ?? null,
            cuenta_cobrar_id: primaryRow.cuenta_cobrar_id ?? null,
            cuota_id: primaryRow.cuota_id ?? null,
            igtf_retenido: splitIgtf || null,
            tasa_bcv_cobro: bcvRate ?? null,
          });
        }

        for (const [accId, totals] of Object.entries(bankTotals)) {
          transaction.update(
            doc(firestore, 'concesionarios', concId, 'cuentas_bancarias', accId),
            { saldo_actual: totals.next, updated_at: serverTimestamp() }
          );
        }
      });

      setStep('exito');
    } catch (e: any) {
      console.error('CXC collection error:', e);
      toast({
        title: 'Error al registrar cobro',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setStep('monto');
          onOpenChange(o);
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2rem]">
          {/* Header */}
          <div className="bg-emerald-500/5 p-5 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-emerald-600" />
                Registrar Cobro
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isMulti ? `${rows.length} documentos` : origenLabel(primaryRow.origen)} —{' '}
                {primaryRow.cliente_nombre}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex gap-3">
              <div className="flex-1 rounded-2xl bg-background/80 p-3 ring-1 ring-border">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Original
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(aggregateOriginal, 'USD')}
                </p>
              </div>
              <div className="flex-1 rounded-2xl bg-emerald-500/5 p-3 ring-1 ring-emerald-500/20">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Saldo Pendiente
                </p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(aggregateSaldo, 'USD')}
                </p>
              </div>
            </div>
            {bcvRate && (
              <p className="mt-2 text-[10px] font-medium text-muted-foreground">
                Tasa BCV en vivo: Bs {bcvRate.toFixed(2)} — conversión USD↔Bs usa esta tasa, no la
                histórica de la venta.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {step === 'monto' && (
              <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Monto a Cobrar
                    </Label>
                    <div className="flex items-center bg-muted/50 rounded-lg p-1">
                      <button
                        className={cn(
                          'px-3 py-1 text-xs font-bold rounded-md transition-all',
                          payCurrency === 'USD'
                            ? 'bg-background shadow text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => handleCurrencyToggle('USD')}
                      >
                        USD
                      </button>
                      <button
                        className={cn(
                          'px-3 py-1 text-xs font-bold rounded-md transition-all',
                          payCurrency === 'VES'
                            ? 'bg-background shadow text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
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
                      onChange={(e) => handleInputChange(e.target.value)}
                      className="h-14 text-2xl font-bold rounded-2xl text-center pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                      {payCurrency}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Máx:{' '}
                    {formatCurrency(
                      payCurrency === 'USD'
                        ? aggregateSaldo
                        : roundMoney(aggregateSaldo * safeBcvRate),
                      payCurrency
                    )}
                  </p>
                  {payCurrency === 'VES' && (
                    <p className="text-[10px] text-emerald-700 text-center font-bold">
                      Equiv. {formatCurrency(montoPagoUsd, 'USD')} aplicados a deuda
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Referencia (opcional)
                  </Label>
                  <Input
                    placeholder="Nº comprobante, transferencia..."
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="h-12 rounded-2xl"
                  />
                </div>

                {anyFiscal && isSpecialTaxpayer && (
                  <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/5 ring-1 ring-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                      Factura fiscal (Sujeto Pasivo Especial): si el cliente paga en Divisas, se
                      retendrá 3% de IGTF para entero al SENIAT.
                    </p>
                  </div>
                )}

                <Button
                  className="w-full h-12 rounded-2xl font-bold text-base shadow-xl shadow-primary/20"
                  disabled={montoPagoUsd <= 0 || montoPagoUsd > aggregateSaldo + 0.001}
                  onClick={() => setStep('pago')}
                >
                  Seleccionar Método de Pago
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 'pago' && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <PaymentEngine
                  totalUsd={montoPagoUsd}
                  tasaBcv={bcvRate ?? 0}
                  bankAccounts={bankAccounts}
                  onValidChange={handleEngineChange}
                  isFiscal={anyFiscal}
                  isSpecialTaxpayer={isSpecialTaxpayer}
                  igtfTriggerMethods={igtfTriggerMethods}
                />

                {hasIgtf && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/5 ring-1 ring-amber-500/20 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                        IGTF 3% Retenido
                      </span>
                    </div>
                    <span className="text-sm font-bold text-amber-700">
                      + {formatCurrency(igtfMonto, 'USD')}
                    </span>
                  </div>
                )}

                {hasIgtf && (
                  <div className="p-3 rounded-2xl bg-emerald-500/5 ring-1 ring-emerald-500/20">
                    <div className="flex justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        Total que entra al banco
                      </span>
                      <span className="text-base font-bold text-emerald-700">
                        {formatCurrency(totalEntraAlBanco, 'USD')}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatCurrency(montoPagoUsd, 'USD')} aplicado a deuda +{' '}
                      {formatCurrency(igtfMonto, 'USD')} IGTF retenido (entero al SENIAT)
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

            {step === 'confirmar' && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div className="rounded-2xl ring-1 ring-border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Resumen del Cobro
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <SummaryRow label="Cliente" value={primaryRow.cliente_nombre} />
                    <SummaryRow
                      label="Documentos"
                      value={
                        isMulti
                          ? `${rows.length}: ${rows.map((r) => r.descripcion).join(', ')}`
                          : origenLabel(primaryRow.origen)
                      }
                    />
                    <SummaryRow
                      label="Aplicado a deuda"
                      value={formatCurrency(montoPagoUsd, 'USD')}
                      bold
                    />
                    {hasIgtf && (
                      <SummaryRow
                        label="IGTF 3% Retenido"
                        value={`+ ${formatCurrency(igtfMonto, 'USD')}`}
                        accent="amber"
                      />
                    )}
                    <SummaryRow
                      label="Total entrada al banco"
                      value={formatCurrency(totalEntraAlBanco, 'USD')}
                      bold
                      accent="emerald"
                    />
                    {bcvRate && (
                      <SummaryRow
                        label="Equiv. Bs (BCV vivo)"
                        value={`Bs ${roundMoney(totalEntraAlBanco * bcvRate).toLocaleString(
                          'es-VE',
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}`}
                      />
                    )}
                    {referencia && <SummaryRow label="Referencia" value={referencia} />}
                  </div>
                </div>

                <div className="space-y-2">
                  {splits.map((s, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center px-4 py-2 rounded-2xl bg-muted/40 ring-1 ring-border"
                    >
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
                    className="rounded-2xl h-12 flex-1 shadow-xl shadow-emerald-500/30 font-bold bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleConfirm}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Cobro
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 'exito' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">¡Cobro Registrado!</h2>
                  <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                    El saldo del cliente se actualizó y la entrada bancaria quedó asentada.
                  </p>
                  {hasIgtf && (
                    <p className="text-xs text-amber-600 font-medium">
                      IGTF de {formatCurrency(igtfMonto, 'USD')} retenido — pendiente de entero al
                      SENIAT.
                    </p>
                  )}
                </div>

                <div className="w-full space-y-3">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full rounded-2xl h-12 font-bold gap-2"
                    disabled={isDownloading}
                    onClick={async () => {
                      setIsDownloading(true);
                      try {
                        await downloadPdf({
                          elementId: 'cxc-receipt-print-root',
                          filename: `Recibo_Caja_${primaryRow.cliente_nombre}.pdf`,
                        });
                      } finally {
                        setIsDownloading(false);
                      }
                    }}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                    Imprimir Recibo de Caja
                  </Button>
                  <Button
                    size="lg"
                    className="w-full rounded-2xl h-14 font-bold shadow-xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      onSuccess();
                      onOpenChange(false);
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden printable receipt */}
      <div style={{ display: 'none' }}>
        <div
          id="cxc-receipt-print-root"
          style={{
            fontFamily: 'Arial, sans-serif',
            width: '210mm',
            minHeight: '148mm',
            padding: '20mm 18mm',
            backgroundColor: '#ffffff',
            color: '#111',
            fontSize: '11px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              borderBottom: '2px solid #059669',
              paddingBottom: '12px',
              marginBottom: '16px',
            }}
          >
            <p
              style={{
                fontSize: '18px',
                fontWeight: 900,
                color: '#059669',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              RECIBO DE CAJA
            </p>
            <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              {concesionario?.nombre_empresa ?? 'Zona Motores Business'} ·{' '}
              {new Date().toLocaleDateString('es-VE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <tbody>
              {(
                [
                  ['Cliente', primaryRow.cliente_nombre],
                  [
                    'Documento(s)',
                    isMulti
                      ? rows.map((r) => `${origenLabel(r.origen)} ${r.descripcion}`).join(' + ')
                      : origenLabel(primaryRow.origen),
                  ],
                  ['Aplicado a deuda', formatCurrency(montoPagoUsd, 'USD')],
                  ...(hasIgtf
                    ? ([['IGTF 3% Retenido', `+ ${formatCurrency(igtfMonto, 'USD')}`]] as [
                        string,
                        string
                      ][])
                    : ([] as [string, string][])),
                  ['Total ingresado al banco', formatCurrency(totalEntraAlBanco, 'USD')],
                  ...(bcvRate
                    ? ([
                        [
                          'Equiv. Bs (BCV)',
                          `Bs ${roundMoney(totalEntraAlBanco * bcvRate).toLocaleString('es-VE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`,
                        ],
                      ] as [string, string][])
                    : ([] as [string, string][])),
                  ...(referencia ? ([['Nº Referencia', referencia]] as [string, string][]) : ([] as [string, string][])),
                  ['Cajero', staff?.nombre || '—'],
                ] as [string, string][]
              ).map(([label, value], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 4px', color: '#666', width: '45%', fontWeight: 600 }}>
                    {label}
                  </td>
                  <td style={{ padding: '6px 4px', fontWeight: 700, color: '#111' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {splits.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p
                style={{
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  fontSize: '9px',
                  color: '#888',
                  letterSpacing: '0.15em',
                  marginBottom: '6px',
                }}
              >
                Detalle de Pago
              </p>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #eee',
                  borderRadius: '6px',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f0fdf4' }}>
                    <th
                      style={{
                        padding: '5px 8px',
                        textAlign: 'left',
                        fontSize: '9px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#444',
                      }}
                    >
                      Cuenta / Método
                    </th>
                    <th
                      style={{
                        padding: '5px 8px',
                        textAlign: 'right',
                        fontSize: '9px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#444',
                      }}
                    >
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: '5px 8px' }}>{s.accountName || s.method}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(s.amount, s.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              marginTop: '24px',
              paddingTop: '12px',
              borderTop: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '9px',
              color: '#888',
            }}
          >
            <span>Generado por Zona Motores Business</span>
            <span>{new Date().toLocaleTimeString('es-VE')}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: 'primary' | 'amber' | 'emerald';
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm',
          bold ? 'font-bold' : 'font-medium',
          accent === 'primary' && 'text-primary',
          accent === 'amber' && 'text-amber-600',
          accent === 'emerald' && 'text-emerald-700'
        )}
      >
        {value}
      </span>
    </div>
  );
}
