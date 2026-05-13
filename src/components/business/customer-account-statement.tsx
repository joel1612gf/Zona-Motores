'use client';

import { useMemo, useState } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, collectionGroup } from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';
import { downloadPdf, printPdf } from '@/lib/download-pdf';
import { formatCurrency, roundMoney } from '@/lib/utils';
import type { Cliente, CuentaPorCobrar, Cuota } from '@/lib/business-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Printer } from 'lucide-react';

interface CustomerAccountStatementProps {
  open: boolean;
  cliente: Cliente | null;
  onOpenChange: (open: boolean) => void;
}

const PRINT_ROOT_ID = 'customer-statement-print-root';

export function CustomerAccountStatement({ open, cliente, onOpenChange }: CustomerAccountStatementProps) {
  const { concesionario } = useBusinessAuth();
  const { bcvRate } = useCurrency();
  const firestore = useFirestore();
  const concId = concesionario?.id;
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null);

  const cuentasQuery = useMemoFirebase(() => {
    if (!concId || !cliente?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'cuentas_por_cobrar'),
      where('cliente_id', '==', cliente.id),
      orderBy('fecha_emision', 'desc'),
      limit(50)
    );
  }, [concId, firestore, cliente?.id]);

  const cuotasQuery = useMemoFirebase(() => {
    if (!concId || !cliente?.id) return null;
    return query(
      collectionGroup(firestore, 'cuotas'),
      where('concesionario_id', '==', concId),
      orderBy('fecha_vencimiento', 'asc'),
      limit(500)
    );
  }, [concId, firestore, cliente?.id]);

  const { data: cuentas } = useCollection<CuentaPorCobrar>(cuentasQuery);
  const { data: cuotas } = useCollection<Cuota & { id: string }>(cuotasQuery);

  const cuentaIds = useMemo(() => new Set((cuentas ?? []).map((c) => c.id)), [cuentas]);
  const cuotasByCuenta = useMemo(() => {
    const map = new Map<string, (Cuota & { id: string })[]>();
    (cuotas ?? []).forEach((c: any) => {
      if (!cuentaIds.has(c.cuenta_cobrar_id)) return;
      const list = map.get(c.cuenta_cobrar_id) ?? [];
      list.push(c);
      map.set(c.cuenta_cobrar_id, list);
    });
    map.forEach((arr) =>
      arr.sort(
        (a, b) =>
          (a.fecha_vencimiento?.toDate?.()?.getTime?.() ?? 0) -
          (b.fecha_vencimiento?.toDate?.()?.getTime?.() ?? 0)
      )
    );
    return map;
  }, [cuotas, cuentaIds]);

  const totalDeuda = useMemo(
    () => (cuentas ?? []).reduce((s, c) => s + (c.saldo_pendiente_usd ?? 0), 0),
    [cuentas]
  );
  const totalOriginal = useMemo(
    () => (cuentas ?? []).reduce((s, c) => s + (c.monto_original_usd ?? 0), 0),
    [cuentas]
  );
  const totalPagado = useMemo(
    () => (cuentas ?? []).reduce((s, c) => s + (c.paid_usd ?? 0), 0),
    [cuentas]
  );

  const handleDownload = async () => {
    setBusy('pdf');
    try {
      await downloadPdf({
        elementId: PRINT_ROOT_ID,
        filename: `Estado_Cuenta_${cliente?.apellido ?? 'cliente'}.pdf`,
      });
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    setBusy('print');
    try {
      await printPdf({ elementId: PRINT_ROOT_ID });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2rem]">
          <div className="bg-primary/5 p-5 border-b">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline">Estado de Cuenta del Cliente</DialogTitle>
            </DialogHeader>
            {cliente && (
              <div className="mt-2 text-sm text-muted-foreground">
                <span className="font-bold text-foreground">
                  {cliente.nombre} {cliente.apellido}
                </span>{' '}
                · {cliente.cedula_rif}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Mini label="Total Original" value={formatCurrency(totalOriginal, 'USD')} />
              <Mini label="Pagado" value={formatCurrency(totalPagado, 'USD')} tone="emerald" />
              <Mini label="Saldo Pendiente" value={formatCurrency(totalDeuda, 'USD')} tone="primary" />
            </div>

            {(cuentas ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                Este cliente no tiene cuentas por cobrar registradas.
              </div>
            ) : (
              <div className="space-y-6">
                {(cuentas ?? []).map((cuenta) => (
                  <CuentaBlock
                    key={cuenta.id}
                    cuenta={cuenta}
                    cuotas={cuotasByCuenta.get(cuenta.id) ?? []}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-4 flex gap-3 justify-end bg-muted/30">
            <Button
              variant="outline"
              className="rounded-2xl h-11 font-bold gap-2"
              onClick={handlePrint}
              disabled={!!busy}
            >
              {busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir
            </Button>
            <Button
              className="rounded-2xl h-11 font-bold gap-2 shadow-xl shadow-primary/20"
              onClick={handleDownload}
              disabled={!!busy}
            >
              {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden printable statement */}
      <div style={{ display: 'none' }}>
        <div
          id={PRINT_ROOT_ID}
          style={{
            fontFamily: 'Arial, sans-serif',
            width: '210mm',
            minHeight: '297mm',
            padding: '20mm 18mm',
            backgroundColor: '#ffffff',
            color: '#111',
            fontSize: '11px',
          }}
        >
          <div style={{ borderBottom: '2px solid #2463eb', paddingBottom: '12px', marginBottom: '16px' }}>
            <p style={{ fontSize: '20px', fontWeight: 900, color: '#2463eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Estado de Cuenta
            </p>
            <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              {concesionario?.nombre_empresa ?? 'Zona Motores Business'} ·{' '}
              {new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {cliente && (
            <table style={{ width: '100%', marginBottom: '16px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 0', color: '#666', width: '30%' }}>Cliente</td>
                  <td style={{ padding: '4px 0', fontWeight: 700 }}>
                    {cliente.nombre} {cliente.apellido}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', color: '#666' }}>Cédula / RIF</td>
                  <td style={{ padding: '4px 0', fontWeight: 700 }}>{cliente.cedula_rif}</td>
                </tr>
                {cliente.telefono && (
                  <tr>
                    <td style={{ padding: '4px 0', color: '#666' }}>Teléfono</td>
                    <td style={{ padding: '4px 0', fontWeight: 700 }}>{cliente.telefono}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '16px' }}>
            <PrintMini label="Total Original" value={formatCurrency(totalOriginal, 'USD')} />
            <PrintMini label="Pagado" value={formatCurrency(totalPagado, 'USD')} accent="#059669" />
            <PrintMini label="Saldo Pendiente" value={formatCurrency(totalDeuda, 'USD')} accent="#2463eb" />
          </div>

          {(cuentas ?? []).map((cuenta) => {
            const cs = cuotasByCuenta.get(cuenta.id) ?? [];
            return (
              <div key={cuenta.id} style={{ marginBottom: '16px' }}>
                <div style={{ background: '#f5f7ff', padding: '8px 12px', borderRadius: '6px', marginBottom: '6px' }}>
                  <p style={{ fontWeight: 800, fontSize: '12px' }}>{cuenta.descripcion}</p>
                  <p style={{ fontSize: '9px', color: '#666' }}>
                    Saldo: <strong>{formatCurrency(cuenta.saldo_pendiente_usd, 'USD')}</strong> ·{' '}
                    Pagado: {formatCurrency(cuenta.paid_usd, 'USD')} · Estado: {cuenta.status}
                  </p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '4px' }}>Cuota</th>
                      <th style={{ textAlign: 'left', padding: '4px' }}>Vence</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Monto</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Pagado</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Saldo</th>
                      <th style={{ textAlign: 'left', padding: '4px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '4px' }}>{c.numero}/{cuenta.cuotas_total}</td>
                        <td style={{ padding: '4px' }}>{c.fecha_vencimiento?.toDate?.()?.toLocaleDateString?.('es-VE') ?? '—'}</td>
                        <td style={{ padding: '4px', textAlign: 'right' }}>{formatCurrency(c.monto_usd, 'USD')}</td>
                        <td style={{ padding: '4px', textAlign: 'right' }}>{formatCurrency(c.paid_usd ?? 0, 'USD')}</td>
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(c.saldo_usd, 'USD')}</td>
                        <td style={{ padding: '4px', textTransform: 'capitalize' }}>{c.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #eee', fontSize: '10px', color: '#666', textAlign: 'center' }}>
            {bcvRate ? `Tasa BCV referencia: Bs ${bcvRate.toFixed(2)} · ` : ''}
            Equivalente Bs del saldo: Bs{' '}
            {bcvRate
              ? roundMoney(totalDeuda * bcvRate).toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '—'}
          </div>
        </div>
      </div>
    </>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'primary' }) {
  return (
    <div className="rounded-2xl border bg-card/60 backdrop-blur-md p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold mt-1 ${
          tone === 'emerald' ? 'text-emerald-700' : tone === 'primary' ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PrintMini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '8px 10px' }}>
      <p style={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 800, color: '#888' }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: 800, color: accent ?? '#111', marginTop: '4px' }}>{value}</p>
    </div>
  );
}

function CuentaBlock({
  cuenta,
  cuotas,
}: {
  cuenta: CuentaPorCobrar;
  cuotas: (Cuota & { id: string })[];
}) {
  return (
    <div className="rounded-2xl border bg-card/40 backdrop-blur-md p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-bold">{cuenta.descripcion}</p>
          <p className="text-xs text-muted-foreground">
            Estado: <span className="capitalize font-bold text-foreground">{cuenta.status}</span> ·{' '}
            {cuenta.cuotas_pagadas}/{cuenta.cuotas_total} cuotas
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Saldo</p>
          <p className="text-lg font-bold text-primary">
            {formatCurrency(cuenta.saldo_pendiente_usd, 'USD')}
          </p>
        </div>
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="text-left">
            <th className="py-1">#</th>
            <th className="py-1">Vence</th>
            <th className="py-1 text-right">Monto</th>
            <th className="py-1 text-right">Pagado</th>
            <th className="py-1 text-right">Saldo</th>
            <th className="py-1">Estado</th>
          </tr>
        </thead>
        <tbody>
          {cuotas.map((c: any) => (
            <tr key={c.id} className="border-t border-border/30">
              <td className="py-1.5 font-bold">{c.numero}</td>
              <td className="py-1.5">{c.fecha_vencimiento?.toDate?.()?.toLocaleDateString?.('es-VE') ?? '—'}</td>
              <td className="py-1.5 text-right">{formatCurrency(c.monto_usd, 'USD')}</td>
              <td className="py-1.5 text-right text-muted-foreground">{formatCurrency(c.paid_usd ?? 0, 'USD')}</td>
              <td className="py-1.5 text-right font-bold">{formatCurrency(c.saldo_usd, 'USD')}</td>
              <td className="py-1.5 capitalize">{c.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
