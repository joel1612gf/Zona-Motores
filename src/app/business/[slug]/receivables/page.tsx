'use client';

import { useMemo, useState } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, collectionGroup } from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';
import { cn, formatCurrency } from '@/lib/utils';
import type { Cliente, CuentaPorCobrar, Cuota } from '@/lib/business-types';
import type { ReceivableRow } from '@/lib/receivable-schemas';
import { ReceivableRowCard } from '@/components/business/receivable-row-card';
import { ReceivablePaymentDialog } from '@/components/business/receivable-payment-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  HandCoins,
  Loader2,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────

type AgingBucket = '0-15' | '16-30' | '31-60' | '+60' | 'todas';

function daysOverdue(date: Date | null | undefined): number {
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function matchesAging(row: ReceivableRow, bucket: AgingBucket): boolean {
  if (bucket === 'todas') return true;
  const venc = row.fecha_vencimiento ?? row.fecha_emision;
  const days = daysOverdue(venc);
  if (days <= 0) return false; // Only overdue rows fall in buckets
  if (bucket === '0-15') return days <= 15;
  if (bucket === '16-30') return days > 15 && days <= 30;
  if (bucket === '31-60') return days > 30 && days <= 60;
  return days > 60;
}

function toDateSafe(value: any): Date {
  if (!value) return new Date();
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

// ─── Premium KPI Card (mirror of CXP) ───────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  variant = 'primary',
}: {
  title: string;
  value: string;
  sub?: string;
  icon: any;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-primary/30',
    success: 'bg-card border-l-4 border-l-emerald-500 shadow-sm',
    warning: 'bg-card border-l-4 border-l-amber-500 shadow-sm',
    danger: 'bg-card border-l-4 border-l-red-500 shadow-sm',
  };
  const isLight = variant !== 'primary';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[2rem] transition-all hover:-translate-y-1 border-none group',
        styles[variant]
      )}
    >
      <Icon
        className={cn(
          'absolute -bottom-4 -right-4 h-28 w-28 opacity-[0.08] group-hover:scale-110 transition-transform',
          !isLight && 'opacity-[0.15]'
        )}
      />
      <div className="p-6 relative z-10">
        <p
          className={cn(
            'text-[10px] font-black uppercase tracking-[0.2em] mb-1',
            isLight ? 'text-muted-foreground' : 'text-primary-foreground/60'
          )}
        >
          {title}
        </p>
        <h3 className="text-3xl font-bold tracking-tighter leading-none">{value}</h3>
        {sub && (
          <p
            className={cn(
              'text-xs mt-2.5 font-medium',
              isLight ? 'text-muted-foreground' : 'text-primary-foreground/80'
            )}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

const ROW_LIMIT = 100;

export default function ReceivablesPage() {
  const { concesionario, hasPermission } = useBusinessAuth();
  const { bcvRate } = useCurrency();
  const firestore = useFirestore();
  const concId = concesionario?.id;

  const [aging, setAging] = useState<AgingBucket>('todas');
  const [search, setSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState<ReceivableRow[] | null>(null);

  const canWrite = hasPermission('receivables') === 'full';

  // ── Queries ──────────────────────────────────────────────────────────────
  const cuentasQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'cuentas_por_cobrar'),
      where('status', '!=', 'pagado'),
      orderBy('status'),
      orderBy('fecha_emision', 'desc'),
      limit(ROW_LIMIT)
    );
  }, [concId, firestore]);

  // Cuotas are stored under cuentas_por_cobrar/{id}/cuotas. We use collectionGroup
  // and filter by denormalized concesionario_id so reads stay scoped to this dealership.
  const cuotasQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collectionGroup(firestore, 'cuotas'),
      where('concesionario_id', '==', concId),
      where('estado', 'in', ['pendiente', 'parcial', 'vencida']),
      orderBy('fecha_vencimiento', 'asc'),
      limit(ROW_LIMIT)
    );
  }, [concId, firestore]);

  const notasQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'notas_fiscales'),
      where('type', '==', 'DEBIT_CLIENT'),
      orderBy('created_at', 'desc'),
      limit(50)
    );
  }, [concId, firestore]);

  const clientesQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'clientes'),
      orderBy('updated_at', 'desc'),
      limit(ROW_LIMIT)
    );
  }, [concId, firestore]);

  const { data: cuentas, isLoading: l1 } = useCollection<CuentaPorCobrar>(cuentasQuery);
  const { data: cuotas, isLoading: l2 } = useCollection<Cuota & { id: string }>(cuotasQuery);
  const { data: notas, isLoading: l3 } = useCollection<any>(notasQuery);
  const { data: clientes } = useCollection<Cliente>(clientesQuery);
  const isLoading = l1 || l2 || l3;

  const cuentasById = useMemo(() => {
    const map = new Map<string, CuentaPorCobrar>();
    (cuentas ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [cuentas]);

  const clientesById = useMemo(() => {
    const map = new Map<string, Cliente>();
    (clientes ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [clientes]);

  // ── Normalize ────────────────────────────────────────────────────────────

  const allRows = useMemo<ReceivableRow[]>(() => {
    const rows: ReceivableRow[] = [];
    const now = Date.now();

    (cuotas ?? []).forEach((c: any) => {
      const parentId: string = c.cuenta_cobrar_id;
      const cuenta = parentId ? cuentasById.get(parentId) : undefined;
      if (!cuenta) return; // Parent not loaded (out of limit window)

      const fechaVenc = toDateSafe(c.fecha_vencimiento);
      const isOverdue = fechaVenc.getTime() < now;
      const estado: ReceivableRow['estado'] =
        c.saldo_usd <= 0.001
          ? 'pagada'
          : isOverdue
          ? 'vencida'
          : (c.paid_usd ?? 0) > 0
          ? 'parcial'
          : 'pendiente';

      const cliente = cuenta.cliente_id ? clientesById.get(cuenta.cliente_id) : undefined;

      rows.push({
        id: `${cuenta.id}_${c.id}`,
        origen: cuenta.origen,
        cuenta_cobrar_id: cuenta.id,
        cuota_id: c.id,
        venta_id: cuenta.venta_id,
        cliente_id: cuenta.cliente_id,
        cliente_nombre: cuenta.cliente_nombre,
        cliente_telefono: cliente?.telefono ?? cuenta.cliente_telefono,
        descripcion: `${cuenta.descripcion} — Cuota ${c.numero}/${cuenta.cuotas_total}`,
        numero_cuota: c.numero,
        cuotas_total: cuenta.cuotas_total,
        is_fiscal: !!cuenta.is_fiscal,
        monto_original: c.monto_usd ?? 0,
        saldo_pendiente: c.saldo_usd ?? 0,
        fecha_emision: toDateSafe(cuenta.fecha_emision),
        fecha_vencimiento: fechaVenc,
        estado,
        parentCuentaId: cuenta.id,
      });
    });

    (notas ?? []).forEach((n: any) => {
      const saldo = n.saldo_pendiente ?? n.total_usd ?? 0;
      if (saldo <= 0.001) return;
      const cliente = n.cliente_id ? clientesById.get(n.cliente_id) : undefined;
      const fecha = toDateSafe(n.created_at);
      const isOverdue = false;
      rows.push({
        id: n.id,
        origen: 'nota_debito_cliente',
        nota_id: n.id,
        cliente_id: n.cliente_id,
        cliente_nombre: n.cliente_nombre ?? cliente ? `${cliente?.nombre} ${cliente?.apellido}` : 'Cliente',
        cliente_telefono: cliente?.telefono,
        descripcion: `ND ${n.note_number ?? n.id.slice(0, 6).toUpperCase()}`,
        is_fiscal: true,
        monto_original: n.total_usd ?? 0,
        saldo_pendiente: saldo,
        fecha_emision: fecha,
        fecha_vencimiento: fecha,
        estado: isOverdue ? 'vencida' : 'pendiente',
      });
    });

    return rows.sort((a, b) => {
      const va = (a.fecha_vencimiento ?? a.fecha_emision).getTime();
      const vb = (b.fecha_vencimiento ?? b.fecha_emision).getTime();
      return va - vb;
    });
  }, [cuotas, cuentasById, clientesById, notas]);

  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return allRows.filter((r) => {
      const matchSearch =
        !s ||
        r.cliente_nombre.toLowerCase().includes(s) ||
        r.descripcion.toLowerCase().includes(s);
      const matchAging = aging === 'todas' ? true : matchesAging(r, aging);
      return matchSearch && matchAging;
    });
  }, [allRows, search, aging]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const now = Date.now();
  const totalSaldo = allRows.reduce((s, r) => s + r.saldo_pendiente, 0);
  const totalVencido = allRows
    .filter((r) => r.estado === 'vencida')
    .reduce((s, r) => s + r.saldo_pendiente, 0);
  const proximos7d = allRows
    .filter((r) => {
      const venc = r.fecha_vencimiento ?? r.fecha_emision;
      const days = Math.ceil((venc.getTime() - now) / 86_400_000);
      return r.estado !== 'pagada' && days >= 0 && days <= 7;
    })
    .reduce((s, r) => s + r.saldo_pendiente, 0);

  // Cobrado este mes: aproximamos sumando paid_usd de CuentaPorCobrar cuyo updated_at cae en mes actual.
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const cobradoMes = (cuentas ?? [])
    .filter((c) => {
      const upd: any = (c as any).updated_at;
      if (!upd?.toDate) return false;
      return upd.toDate() >= inicioMes;
    })
    .reduce((s, c) => s + (c.paid_usd ?? 0), 0);

  const showingHint = (cuotas?.length ?? 0) >= ROW_LIMIT || (cuentas?.length ?? 0) >= ROW_LIMIT;
  const empresaNombre = concesionario?.nombre_empresa ?? 'Zona Motores';

  return (
    <div className="flex flex-col min-h-screen gap-10 pb-12 relative animate-in fade-in duration-500">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <HandCoins className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
              Cuentas por Cobrar
            </h1>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            Panel de{' '}
            <span className="text-foreground font-bold">{empresaNombre}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-px rounded-2xl border bg-background shadow-sm overflow-hidden backdrop-blur-sm w-full sm:w-auto">
          <div className="px-5 py-3 bg-muted/50 flex flex-col justify-center border-b sm:border-b-0 sm:border-r min-w-0 sm:min-w-[140px]">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">
              Tasa BCV (vivo)
            </p>
            <p className="text-sm font-bold font-headline text-emerald-700">
              Bs {bcvRate?.toFixed(2) ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        <KpiCard
          title="Total por Cobrar"
          value={formatCurrency(totalSaldo, 'USD')}
          sub={bcvRate ? `≈ Bs ${(totalSaldo * bcvRate).toLocaleString('es-VE')}` : ''}
          icon={Wallet}
          variant="primary"
        />
        <KpiCard
          title="Vencido"
          value={formatCurrency(totalVencido, 'USD')}
          sub="Cuotas con fecha pasada"
          icon={AlertCircle}
          variant="danger"
        />
        <KpiCard
          title="Cobrado este mes"
          value={formatCurrency(cobradoMes, 'USD')}
          sub="Pagos aplicados desde el 1ro"
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          title="Próximos 7 días"
          value={formatCurrency(proximos7d, 'USD')}
          sub="Por vencer pronto"
          icon={CalendarClock}
          variant="warning"
        />
      </div>

      {/* ── Aging + Search ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'todas', label: 'Todas' },
            { id: '0-15', label: '0-15 d' },
            { id: '16-30', label: '16-30 d' },
            { id: '31-60', label: '31-60 d' },
            { id: '+60', label: '+60 d' },
          ].map((bucket) => (
            <button
              key={bucket.id}
              onClick={() => setAging(bucket.id as AgingBucket)}
              className={cn(
                'h-10 rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 border shadow-sm',
                aging === bucket.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:bg-muted'
              )}
            >
              {bucket.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Buscar cliente o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 rounded-[1.2rem] bg-card border-border pl-11 text-sm font-medium focus:ring-primary/20 shadow-sm"
          />
        </div>
      </div>

      {showingHint && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/5 ring-1 ring-amber-500/20 text-xs font-medium text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" />
          Mostrando los primeros {ROW_LIMIT} registros más recientes. Ajusta filtros o búsqueda
          para refinar.
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="todas" className="w-full space-y-8 relative z-10">
        <TabsList className="bg-transparent h-auto p-0 gap-4 sm:gap-8 justify-start border-b w-full rounded-none mb-8 flex-wrap">
          {(
            [
              { v: 'todas', label: 'Todas' },
              { v: 'financiamientos', label: 'Financiamientos' },
              { v: 'comerciales', label: 'Créditos Comerciales' },
              { v: 'notas_debito', label: 'N. Débito' },
            ] as { v: string; label: string }[]
          ).map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-[400px]">
          <TabsContent
            value="todas"
            className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <RowsList
              isLoading={isLoading}
              rows={filteredRows}
              onPay={(r) => setSelectedRows([r])}
              canWrite={canWrite}
              empresaNombre={empresaNombre}
            />
          </TabsContent>
          <TabsContent value="financiamientos" className="m-0 space-y-4">
            <RowsList
              isLoading={isLoading}
              rows={filteredRows.filter((r) => r.origen === 'venta_credito_vehiculo')}
              onPay={(r) => setSelectedRows([r])}
              canWrite={canWrite}
              empresaNombre={empresaNombre}
            />
          </TabsContent>
          <TabsContent value="comerciales" className="m-0 space-y-4">
            <RowsList
              isLoading={isLoading}
              rows={filteredRows.filter((r) => r.origen === 'venta_credito_producto')}
              onPay={(r) => setSelectedRows([r])}
              canWrite={canWrite}
              empresaNombre={empresaNombre}
            />
          </TabsContent>
          <TabsContent value="notas_debito" className="m-0 space-y-4">
            <RowsList
              isLoading={isLoading}
              rows={filteredRows.filter((r) => r.origen === 'nota_debito_cliente')}
              onPay={(r) => setSelectedRows([r])}
              canWrite={canWrite}
              empresaNombre={empresaNombre}
            />
          </TabsContent>
        </div>
      </Tabs>

      {selectedRows && selectedRows.length > 0 && (
        <ReceivablePaymentDialog
          open={!!selectedRows}
          rows={selectedRows}
          onOpenChange={(o) => !o && setSelectedRows(null)}
          onSuccess={() => setSelectedRows(null)}
        />
      )}
    </div>
  );
}

function RowsList({
  isLoading,
  rows,
  onPay,
  canWrite,
  empresaNombre,
}: {
  isLoading: boolean;
  rows: ReceivableRow[];
  onPay: (row: ReceivableRow) => void;
  canWrite: boolean;
  empresaNombre: string;
}) {
  if (isLoading) return <LoadingState />;
  if (rows.length === 0) return <EmptyState />;
  return (
    <>
      {rows.map((r) => (
        <ReceivableRowCard
          key={r.id}
          row={r}
          onPay={onPay}
          canWrite={canWrite}
          empresaNombre={empresaNombre}
        />
      ))}
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4 opacity-50">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Cargando cobranzas...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-80 w-full flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-white/5 bg-card/10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mb-6">
        <CheckCircle2 className="h-10 w-10 text-emerald-600/60" />
      </div>
      <h3 className="text-xl font-black tracking-tight text-foreground/60">Sin pendientes</h3>
      <p className="mt-2 text-xs font-medium text-muted-foreground/40 max-w-[260px]">
        No se encontraron cuentas por cobrar que coincidan con los filtros aplicados.
      </p>
    </div>
  );
}

// Silence unused import warnings for symbols referenced indirectly.
void Clock;
