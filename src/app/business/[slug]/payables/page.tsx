'use client';

import { useMemo, useState } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, orderBy, limit
} from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/utils';
import type { Compra, StockVehicle } from '@/lib/business-types';
import type { PayableRow } from '@/lib/payable-schemas';
import { PayablePaymentDialog } from '@/components/business/payable-payment-dialog';
import {
  FileWarning, AlertCircle, Clock, CheckCircle2,
  ChevronRight, Loader2, FileText, Car, ArrowUpDown,
  TrendingDown, Calendar, Wallet, Search, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

// ─── Helpers ────────────────────────────────────────────────────────────────

function ageInDays(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

type AgingBucket = '0-7' | '8-15' | '16-30' | '31-60' | '+60' | 'todas';

function matchesAging(row: PayableRow, bucket: AgingBucket): boolean {
  if (bucket === 'todas') return true;
  const days = ageInDays(row.fecha_emision);
  if (bucket === '0-7') return days <= 7;
  if (bucket === '8-15') return days > 7 && days <= 15;
  if (bucket === '16-30') return days > 15 && days <= 30;
  if (bucket === '31-60') return days > 30 && days <= 60;
  return days > 60;
}

function statusBadge(estado: PayableRow['estado']) {
  if (estado === 'pagada') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
        Pagada
      </Badge>
    );
  }
  if (estado === 'parcial') {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
        Parcial
      </Badge>
    );
  }
  return null;
}

function origenLabel(origen: string): string {
  const map: Record<string, string> = {
    compra_factura: 'Factura',
    compra_nota_entrega: 'Nota Entrega',
    consignacion: 'Consignación',
    nota_debito: 'Nota Débito',
    gasto: 'Gasto Operativo',
    vehiculo: 'Vehículo',
  };
  return map[origen] || 'Otros';
}

function origenIcon(origen: string) {
  if (origen === 'compra_factura') return <FileText className="h-5 w-5 text-primary" />;
  if (origen === 'compra_nota_entrega') return <FileText className="h-5 w-5 text-slate-400" />;
  if (origen === 'consignacion' || origen === 'vehiculo') return <Car className="h-5 w-5 text-indigo-500" />;
  if (origen === 'gasto') return <TrendingDown className="h-5 w-5 text-rose-500" />;
  return <ArrowUpDown className="h-5 w-5 text-amber-500" />;
}

// ─── Premium KPI Card ────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon, accentColor, trend
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accentColor: string;
  trend?: { label: string; value: string; isPositive: boolean };
}) {
  return (
    <div className="relative group overflow-hidden rounded-[2.5rem] bg-card/40 backdrop-blur-xl border border-white/10 p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1">
      {/* Decorative Gradient Background */}
      <div className={cn("absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl transition-all duration-500 group-hover:scale-150", accentColor)} />
      
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-foreground shadow-inner", accentColor.replace('bg-', 'text-'))}>
            {icon}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tight",
              trend.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            )}>
              {trend.value}
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{title}</p>
          <h3 className="mt-1 text-3xl font-black tracking-tight text-foreground">{value}</h3>
          {sub && <p className="mt-1 text-xs font-medium text-muted-foreground/60">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Premium Row Card ────────────────────────────────────────────────────────

function PayableRowCard({
  row, onPay, canWrite
}: {
  row: PayableRow;
  onPay: (row: PayableRow) => void;
  canWrite: boolean;
}) {
  const days = ageInDays(row.fecha_emision);
  const isOverdue = days > 30;

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-[2rem] border bg-card/30 backdrop-blur-md p-5 transition-all duration-300 hover:bg-card/50",
      isOverdue && row.estado !== 'pagada' ? "border-red-500/20" : "border-white/5"
    )}>
      {/* Glow Effect */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-background/50 border border-white/5 shadow-inner">
            {origenIcon(row.origen)}
          </div>
          <div className="min-w-0">
            <h4 className="text-lg font-black tracking-tight truncate">{row.proveedor_nombre}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                {origenLabel(row.origen)}
              </span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
              <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {row.fecha_emision.toLocaleDateString('es-VE')}
              </span>
              {isOverdue && row.estado !== 'pagada' && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {days} días vencido
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 md:justify-end">
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Total</p>
              <div className="flex flex-col items-end">
                <p className="text-base font-bold text-muted-foreground/80">
                  {formatCurrency(row.monto_original, row.moneda_original === 'bs' ? 'VES' : 'USD')}
                </p>
                {row.moneda_original === 'bs' && row.tasa_cambio && (
                  <p className="text-[10px] font-bold text-muted-foreground/50 mt-0.5">
                    ≈ {formatCurrency(row.monto_original / row.tasa_cambio, 'USD')}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Saldo Pendiente</p>
              <div className="flex flex-col items-end">
                <p className={cn(
                  "text-xl font-black tracking-tight",
                  row.saldo_pendiente > 0 ? "text-amber-500" : "text-emerald-500"
                )}>
                  {formatCurrency(row.saldo_pendiente, row.moneda_original === 'bs' ? 'VES' : 'USD')}
                </p>
                {row.moneda_original === 'bs' && row.tasa_cambio && row.saldo_pendiente > 0 && (
                  <p className="text-[10px] font-bold text-amber-500/50 mt-0.5">
                    ≈ {formatCurrency(row.saldo_pendiente / row.tasa_cambio, 'USD')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {statusBadge(row.estado)}
            {canWrite && row.estado !== 'pagada' && (
              <Button
                onClick={() => onPay(row)}
                className="h-11 rounded-2xl px-6 font-bold shadow-lg shadow-primary/20 transition-transform active:scale-95"
              >
                Pagar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────

export default function PayablesPage() {
  const { concesionario, hasPermission } = useBusinessAuth();
  const { bcvRate } = useCurrency();
  const firestore = useFirestore();
  const concId = concesionario?.id;

  const [aging, setAging] = useState<AgingBucket>('todas');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<PayableRow | null>(null);

  const canWrite = hasPermission('payables') === 'full';

  // ── Queries (Purchases, Consignments, Expenses) ─────────────────────────
  const comprasQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'compras'),
      where('estado', '!=', 'pagada'),
      orderBy('estado'),
      orderBy('created_at', 'desc'),
      limit(100)
    );
  }, [concId, firestore]);

  const consignacionesQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'consignaciones_por_pagar'),
      where('estado', '!=', 'pagada'),
      orderBy('estado'),
      orderBy('created_at', 'desc'),
      limit(50)
    );
  }, [concId, firestore]);

  const gastosQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'gastos'),
      where('status', '==', 'PENDIENTE'),
      orderBy('created_at', 'desc'),
      limit(50)
    );
  }, [concId, firestore]);

  const notasDebitoQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'notas_fiscales'),
      where('type', '==', 'DEBIT'),
      orderBy('created_at', 'desc'),
      limit(50)
    );
  }, [concId, firestore]);

  const vehiculosQuery = useMemoFirebase(() => {
    if (!concId) return null;
    return query(
      collection(firestore, 'concesionarios', concId, 'inventario'),
      where('estado_pago', '==', 'pendiente'),
      orderBy('created_at', 'desc'),
      limit(50)
    );
  }, [concId, firestore]);

  const { data: compras, isLoading: l1 } = useCollection<Compra>(comprasQuery);
  const { data: consignaciones, isLoading: l2 } = useCollection<any>(consignacionesQuery);
  const { data: gastos, isLoading: l3 } = useCollection<any>(gastosQuery);
  const { data: notasDebito, isLoading: l4 } = useCollection<any>(notasDebitoQuery);
  const { data: vehiculos, isLoading: l5 } = useCollection<StockVehicle>(vehiculosQuery);

  const isLoading = l1 || l2 || l3 || l4 || l5;

  // ── Normalization ─────────────────────────────────────────────────────────

  const allRows = useMemo(() => {
    const rows: any[] = [];

    if (compras) {
      compras.forEach(c => {
        rows.push({
          id: c.id,
          origen: c.is_fiscal ? 'compra_factura' : 'compra_nota_entrega',
          compra_id: c.id,
          proveedor_nombre: c.proveedor_nombre,
          descripcion: c.numero_factura || 'Compra Crédito',
          is_fiscal: !!c.is_fiscal,
          monto_original: c.moneda_original === 'bs' ? c.total_bs : (c.total_usd || 0),
          saldo_pendiente: c.moneda_original === 'bs' ? (c.saldo_pendiente ?? c.total_bs) : (c.saldo_pendiente ?? c.neto_a_pagar ?? c.total_usd ?? 0),
          moneda_original: c.moneda_original || 'usd',
          tasa_cambio: c.tasa_cambio,
          fecha_emision: c.created_at ? (c.created_at as any).toDate?.() ?? new Date() : new Date(),
          estado: (c.estado as any) ?? 'pendiente',
        });
      });
    }

    if (consignaciones) {
      consignaciones.forEach(c => {
        rows.push({
          id: c.id,
          origen: 'consignacion',
          consignacion_id: c.id,
          proveedor_nombre: c.propietario_nombre || 'Particular',
          descripcion: c.vehiculo_nombre || 'Vehículo en Consignación',
          is_fiscal: false,
          monto_original: c.monto_a_pagar || 0,
          saldo_pendiente: c.saldo_pendiente || 0,
          fecha_emision: c.created_at ? (c.created_at as any).toDate?.() ?? new Date() : new Date(),
          estado: c.estado ?? 'pendiente',
        });
      });
    }

    if (gastos) {
      gastos.forEach(g => {
        rows.push({
          id: g.id,
          origen: 'gasto',
          gasto_id: g.id,
          proveedor_nombre: g.provider_name || 'Gasto Operativo',
          descripcion: g.invoice_number || g.description || 'Gasto Pendiente',
          is_fiscal: !!g.invoice_number,
          monto_original: g.total_usd || 0,
          saldo_pendiente: g.saldo_pendiente || g.total_usd || 0,
          fecha_emision: g.created_at ? (g.created_at as any).toDate?.() ?? new Date() : new Date(),
          estado: (g.status?.toLowerCase() === 'pendiente' ? 'pendiente' : 'parcial') as any,
        });
      });
    }

    // Notas de Débito — filter out cancelled and already-settled
    if (notasDebito) {
      notasDebito
        .filter((n: any) => n.status !== 'ANULADO' && (n.saldo_pendiente ?? n.total_usd ?? 0) > 0.001)
        .forEach((n: any) => {
          rows.push({
            id: n.id,
            origen: 'nota_debito',
            nota_id: n.id,
            compra_id: n.invoice_id,
            proveedor_nombre: n.provider_name || 'Proveedor',
            descripcion: `ND ${n.note_number || n.id.slice(0, 6).toUpperCase()}`,
            is_fiscal: true,
            monto_original: n.total_usd || 0,
            saldo_pendiente: n.saldo_pendiente ?? n.total_usd ?? 0,
            fecha_emision: n.created_at ? (n.created_at as any).toDate?.() ?? new Date() : new Date(),
            estado: ((n.saldo_pendiente ?? n.total_usd ?? 0) <= 0.001 ? 'pagada' : 'pendiente') as any,
          });
        });
    }

    if (vehiculos) {
      vehiculos.forEach(v => {
        rows.push({
          id: v.id,
          origen: 'vehiculo',
          compra_id: v.id, // we map to compra_id or we can handle it specifically
          proveedor_nombre: 'Proveedor de Vehículo',
          descripcion: `${v.make} ${v.model} ${v.year}`,
          is_fiscal: false,
          monto_original: v.costo_compra || 0,
          saldo_pendiente: v.saldo_pendiente ?? v.costo_compra ?? 0,
          moneda_original: 'usd',
          fecha_emision: v.created_at ? (v.created_at as any).toDate?.() ?? new Date() : new Date(),
          estado: v.estado_pago ?? 'pendiente',
        });
      });
    }

    return rows.sort((a, b) => b.fecha_emision.getTime() - a.fecha_emision.getTime());
  }, [compras, consignaciones, gastos, notasDebito, vehiculos]);

  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      const matchSearch = r.proveedor_nombre.toLowerCase().includes(search.toLowerCase()) ||
                          r.descripcion.toLowerCase().includes(search.toLowerCase());
      return matchSearch && matchesAging(r, aging);
    });
  }, [allRows, search, aging]);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const totalSaldo = allRows.reduce((s, r) => s + r.saldo_pendiente, 0);
  const totalOverdue = allRows.filter(r => ageInDays(r.fecha_emision) > 30).reduce((s, r) => s + r.saldo_pendiente, 0);
  const activeDocs = allRows.length;

  return (
    <div className="flex flex-col min-h-screen gap-10 p-6 md:p-10 bg-transparent">
      
      {/* ── Header Area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-primary/10 text-primary shadow-inner">
              <Wallet className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">Cuentas x Pagar</h1>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Centraliza tus pasivos, compras y consignaciones en tiempo real.</p>
        </div>

        <div className="flex items-center gap-4 rounded-3xl bg-card/40 backdrop-blur-md border border-white/5 p-2 px-6 shadow-sm">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Referencia BCV</span>
            <span className="text-sm font-black text-primary">Bs {bcvRate?.toFixed(2) || '—'}</span>
          </div>
        </div>
      </div>

      {/* ── KPI Dashboard ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Total Deuda"
          value={formatCurrency(totalSaldo, 'USD')}
          sub={bcvRate ? `≈ Bs ${(totalSaldo * bcvRate).toLocaleString('es-VE')}` : 'Sincronizando tasa...'}
          icon={<Wallet className="h-6 w-6" />}
          accentColor="bg-primary"
          trend={{ label: "mensual", value: "Salida", isPositive: false }}
        />
        <KpiCard
          title="Mora Crítica"
          value={formatCurrency(totalOverdue, 'USD')}
          sub="Facturas con +30 días de antigüedad"
          icon={<AlertCircle className="h-6 w-6" />}
          accentColor="bg-red-500"
        />
        <KpiCard
          title="Documentos"
          value={String(activeDocs)}
          sub="Pasivos por liquidar actualmente"
          icon={<Clock className="h-6 w-6" />}
          accentColor="bg-indigo-500"
        />
      </div>

      {/* ── Control Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'todas', label: 'Todas' },
            { id: '0-7', label: '0-7 d' },
            { id: '8-15', label: '8-15 d' },
            { id: '16-30', label: '16-30 d' },
            { id: '31-60', label: '31-60 d' },
            { id: '+60', label: '+60 d' },
          ].map(bucket => (
            <button
              key={bucket.id}
              onClick={() => setAging(bucket.id as AgingBucket)}
              className={cn(
                "h-10 rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 border",
                aging === bucket.id 
                  ? "bg-foreground text-background border-foreground shadow-lg shadow-foreground/10" 
                  : "bg-card/40 text-muted-foreground/60 border-white/5 hover:border-white/20 hover:text-foreground"
              )}
            >
              {bucket.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input 
            placeholder="Buscar proveedor o Nº factura..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-[1.2rem] bg-card/40 border-white/5 pl-11 text-sm font-medium focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── Main List Area ─────────────────────────────────────────────────── */}
      <Tabs defaultValue="todas" className="w-full space-y-8">
        <TabsList className="h-14 w-full justify-start gap-2 rounded-[1.5rem] bg-card/20 border border-white/5 p-1.5 backdrop-blur-sm md:w-max">
          <TabsTrigger value="todas" className="rounded-xl px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Todas</TabsTrigger>
          <TabsTrigger value="compras" className="rounded-xl px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Compras</TabsTrigger>
          <TabsTrigger value="vehiculos" className="rounded-xl px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Vehículos</TabsTrigger>
          <TabsTrigger value="consignaciones" className="rounded-xl px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Consignaciones</TabsTrigger>
          <TabsTrigger value="gastos" className="rounded-xl px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Gastos</TabsTrigger>
          <TabsTrigger value="notas_debito" className="rounded-xl px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">N. Débito</TabsTrigger>
        </TabsList>

        <div className="min-h-[400px]">
          <TabsContent value="todas" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isLoading ? <LoadingState /> : (
              filteredRows.length > 0 ? filteredRows.map(r => (
                <PayableRowCard key={r.id} row={r} onPay={setSelectedRow} canWrite={canWrite} />
              )) : <EmptyState />
            )}
          </TabsContent>

          <TabsContent value="compras" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen.includes('compra')).map(r => (
              <PayableRowCard key={r.id} row={r} onPay={setSelectedRow} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen.includes('compra')).length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="vehiculos" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'vehiculo').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={setSelectedRow} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'vehiculo').length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="consignaciones" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'consignacion').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={setSelectedRow} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'consignacion').length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="gastos" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'gasto').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={setSelectedRow} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'gasto').length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="notas_debito" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'nota_debito').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={setSelectedRow} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'nota_debito').length === 0 && <EmptyState />}
          </TabsContent>
        </div>
      </Tabs>

      {/* ── Payment Dialog ─────────────────────────────────────────────────── */}
      {selectedRow && (
        <PayablePaymentDialog
          open={!!selectedRow}
          row={selectedRow}
          onOpenChange={open => !open && setSelectedRow(null)}
          onSuccess={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-4 opacity-50">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Cargando pasivos...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-80 w-full flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-white/5 bg-card/10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 mb-6">
        <CheckCircle2 className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <h3 className="text-xl font-black tracking-tight text-foreground/60">Todo al día</h3>
      <p className="mt-2 text-xs font-medium text-muted-foreground/40 max-w-[240px]">No se encontraron deudas pendientes que coincidan con los filtros aplicados.</p>
    </div>
  );
}
