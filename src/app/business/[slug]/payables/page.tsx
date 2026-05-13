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
import { PayableDocumentSelectorDialog } from '@/components/business/payable-document-selector-dialog';
import {
  FileWarning, AlertCircle, Clock, CheckCircle2,
  ChevronRight, Loader2, FileText, Car, ArrowUpDown,
  TrendingDown, Calendar, Wallet, Search, Filter, Layers
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
    compra_factura: 'Factura Fiscal',
    compra_nota_entrega: 'Nota de Entrega',
    consignacion: 'Consignación',
    nota_debito: 'Nota de Débito',
    gasto: 'Gasto Operativo',
    vehiculo: 'Vehículo',
  };
  return map[origen] || 'Otros';
}

function origenIcon(origen: string) {
  if (origen === 'compra_factura') return <FileText className="h-5 w-5 text-primary" />;
  if (origen === 'compra_nota_entrega') return <FileText className="h-5 w-5 text-slate-400" />;
  if (origen === 'consignacion' || origen === 'vehiculo') return <Car className="h-5 w-5 text-primary" />;
  if (origen === 'gasto' || origen === 'nota_debito') return <TrendingDown className="h-5 w-5 text-rose-500" />;
  return <ArrowUpDown className="h-5 w-5 text-amber-500" />;
}

// ─── Premium KPI Card ────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, variant = 'primary'
}: {
  title: string;
  value: string;
  sub?: string;
  icon: any;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground shadow-primary/30",
    success: "bg-card border-l-4 border-l-emerald-500 shadow-sm",
    warning: "bg-card border-l-4 border-l-amber-500 shadow-sm",
    danger: "bg-card border-l-4 border-l-red-500 shadow-sm"
  };
  const isLight = variant !== 'primary';

  return (
    <div className={cn("relative overflow-hidden rounded-[2rem] transition-all hover:-translate-y-1 border-none group", styles[variant])}>
      <Icon className={cn("absolute -bottom-4 -right-4 h-28 w-28 opacity-[0.08] group-hover:scale-110 transition-transform", !isLight && "opacity-[0.15]")} />
      <div className="p-6 relative z-10">
        <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-1", isLight ? "text-muted-foreground" : "text-primary-foreground/60")}>
          {title}
        </p>
        <h3 className="text-3xl font-bold tracking-tighter leading-none">
          {value}
        </h3>
        <p className={cn("text-xs mt-2.5 font-medium", isLight ? "text-muted-foreground" : "text-primary-foreground/80")}>
          {sub}
        </p>
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
  const linkedNotesTotal = (row.linkedNotes ?? []).reduce((acc, n) => acc + (n.saldo_pendiente || 0), 0);
  const hasLinkedNotes = (row.linkedNotes?.length ?? 0) > 0;

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
            <h4 className="text-lg font-bold tracking-tight truncate">{row.proveedor_nombre}</h4>
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
              {hasLinkedNotes && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {row.linkedNotes!.length} {row.linkedNotes!.length === 1 ? 'nota vinculada' : 'notas vinculadas'} (+{formatCurrency(linkedNotesTotal, 'USD')})
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
                  "text-xl font-bold tracking-tighter font-headline",
                  row.saldo_pendiente > 0 ? "text-primary" : "text-emerald-500"
                )}>
                  {formatCurrency(row.saldo_pendiente, row.moneda_original === 'bs' ? 'VES' : 'USD')}
                </p>
                {row.moneda_original === 'bs' && row.tasa_cambio && row.saldo_pendiente > 0 && (
                  <p className="text-[10px] font-bold text-primary/50 mt-0.5">
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
  const [selectorRow, setSelectorRow] = useState<PayableRow | null>(null);
  const [selectedRows, setSelectedRows] = useState<PayableRow[] | null>(null);

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
    const rows: PayableRow[] = [];

    // Index DEBIT notes by parent invoice_id so they can be attached to their parent.
    const debitNotesByInvoice = new Map<string, PayableRow[]>();
    const standaloneDebitNotes: PayableRow[] = [];

    if (notasDebito) {
      notasDebito
        .filter((n: any) => n.status !== 'ANULADO' && (n.saldo_pendiente ?? n.total_usd ?? 0) > 0.001)
        .forEach((n: any) => {
          const noteRow: PayableRow = {
            id: n.id,
            origen: 'nota_debito',
            nota_id: n.id,
            compra_id: n.invoice_id,
            proveedor_nombre: n.provider_name || 'Proveedor',
            descripcion: `ND ${n.note_number || n.id.slice(0, 6).toUpperCase()}`,
            is_fiscal: true,
            monto_original: n.total_usd || 0,
            saldo_pendiente: n.saldo_pendiente ?? n.total_usd ?? 0,
            moneda_original: 'usd',
            fecha_emision: n.created_at ? (n.created_at as any).toDate?.() ?? new Date() : new Date(),
            estado: ((n.saldo_pendiente ?? n.total_usd ?? 0) <= 0.001 ? 'pagada' : 'pendiente') as any,
          };
          if (n.invoice_id) {
            const list = debitNotesByInvoice.get(n.invoice_id) ?? [];
            list.push(noteRow);
            debitNotesByInvoice.set(n.invoice_id, list);
          } else {
            standaloneDebitNotes.push(noteRow);
          }
        });
    }

    const consumedNoteInvoiceIds = new Set<string>();

    if (compras) {
      compras.forEach(c => {
        const linked = debitNotesByInvoice.get(c.id);
        if (linked) consumedNoteInvoiceIds.add(c.id);
        // Fallback for legacy purchases that never persisted is_fiscal:
        // if the document carries a numero_factura it was created as a fiscal invoice.
        const isFiscal = (c as any).is_fiscal !== undefined ? !!(c as any).is_fiscal : !!c.numero_factura;
        rows.push({
          id: c.id,
          origen: isFiscal ? 'compra_factura' : 'compra_nota_entrega',
          compra_id: c.id,
          proveedor_nombre: c.proveedor_nombre,
          descripcion: c.numero_factura || 'Compra Crédito',
          is_fiscal: isFiscal,
          monto_original: c.moneda_original === 'bs' ? (c.total_bs ?? 0) : (c.total_usd || 0),
          saldo_pendiente: c.moneda_original === 'bs' ? (c.saldo_pendiente ?? c.total_bs ?? 0) : (c.saldo_pendiente ?? c.neto_a_pagar ?? c.total_usd ?? 0),
          moneda_original: c.moneda_original || 'usd',
          tasa_cambio: c.tasa_cambio,
          fecha_emision: c.created_at ? (c.created_at as any).toDate?.() ?? new Date() : new Date(),
          estado: (c.estado as any) ?? 'pendiente',
          linkedNotes: linked,
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

    // Notas de Débito huérfanas (cuya factura origen ya está pagada / no aparece) → fila independiente
    debitNotesByInvoice.forEach((list, invoiceId) => {
      if (!consumedNoteInvoiceIds.has(invoiceId)) {
        list.forEach(n => rows.push(n));
      }
    });
    standaloneDebitNotes.forEach(n => rows.push(n));

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
    <div className="flex flex-col min-h-screen gap-10 pb-12 relative animate-in fade-in duration-500">

      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Header Area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Cuentas por Pagar</h1>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            Panel de <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-px rounded-2xl border bg-background shadow-sm overflow-hidden backdrop-blur-sm w-full sm:w-auto">
          <div className="px-5 py-3 bg-muted/50 flex flex-col justify-center border-b sm:border-b-0 sm:border-r min-w-0 sm:min-w-[140px]">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Referencia BCV</p>
            <p className="text-sm font-bold font-headline text-primary">Bs {bcvRate?.toFixed(2) || '—'}</p>
          </div>
        </div>
      </div>

      {/* ── KPI Dashboard ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        <KpiCard
          title="Total Deuda"
          value={formatCurrency(totalSaldo, 'USD')}
          sub={bcvRate ? `≈ Bs ${(totalSaldo * bcvRate).toLocaleString('es-VE')}` : 'Sincronizando tasa...'}
          icon={Wallet}
          variant="primary"
        />
        <KpiCard
          title="Mora Crítica"
          value={formatCurrency(totalOverdue, 'USD')}
          sub="Facturas con +30 días de antigüedad"
          icon={AlertCircle}
          variant="danger"
        />
        <KpiCard
          title="Documentos"
          value={String(activeDocs)}
          sub="Pasivos por liquidar actualmente"
          icon={Clock}
          variant="success"
        />
      </div>

      {/* ── Control Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
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
                "h-10 rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 border shadow-sm",
                aging === bucket.id
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:bg-muted"
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
            className="h-12 rounded-[1.2rem] bg-card border-border pl-11 text-sm font-medium focus:ring-primary/20 shadow-sm"
          />
        </div>
      </div>

      {/* ── Main List Area ─────────────────────────────────────────────────── */}
      <Tabs defaultValue="todas" className="w-full space-y-8 relative z-10">
        <TabsList className="bg-transparent h-auto p-0 gap-4 sm:gap-8 justify-start border-b w-full rounded-none mb-8 flex-wrap">
          <TabsTrigger value="todas" className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">Todas</TabsTrigger>
          <TabsTrigger value="compras" className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">Compras</TabsTrigger>
          <TabsTrigger value="vehiculos" className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">Vehículos</TabsTrigger>
          <TabsTrigger value="consignaciones" className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">Consignaciones</TabsTrigger>
          <TabsTrigger value="gastos" className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">Gastos</TabsTrigger>
          <TabsTrigger value="notas_debito" className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">N. Débito</TabsTrigger>
        </TabsList>

        <div className="min-h-[400px]">
          <TabsContent value="todas" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isLoading ? <LoadingState /> : (
              filteredRows.length > 0 ? filteredRows.map(r => (
                <PayableRowCard key={r.id} row={r} onPay={(r) => r.linkedNotes?.length ? setSelectorRow(r) : setSelectedRows([r])} canWrite={canWrite} />
              )) : <EmptyState />
            )}
          </TabsContent>

          <TabsContent value="compras" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen.includes('compra')).map(r => (
              <PayableRowCard key={r.id} row={r} onPay={(r) => r.linkedNotes?.length ? setSelectorRow(r) : setSelectedRows([r])} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen.includes('compra')).length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="vehiculos" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'vehiculo').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={(r) => r.linkedNotes?.length ? setSelectorRow(r) : setSelectedRows([r])} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'vehiculo').length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="consignaciones" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'consignacion').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={(r) => r.linkedNotes?.length ? setSelectorRow(r) : setSelectedRows([r])} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'consignacion').length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="gastos" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'gasto').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={(r) => r.linkedNotes?.length ? setSelectorRow(r) : setSelectedRows([r])} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'gasto').length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="notas_debito" className="m-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredRows.filter(r => r.origen === 'nota_debito').map(r => (
              <PayableRowCard key={r.id} row={r} onPay={(r) => r.linkedNotes?.length ? setSelectorRow(r) : setSelectedRows([r])} canWrite={canWrite} />
            ))}
            {filteredRows.filter(r => r.origen === 'nota_debito').length === 0 && <EmptyState />}
          </TabsContent>
        </div>
      </Tabs>

      {/* ── Document Selector (factura + notas vinculadas) ──────────────── */}
      {selectorRow && (
        <PayableDocumentSelectorDialog
          open={!!selectorRow}
          parentRow={selectorRow}
          onOpenChange={open => !open && setSelectorRow(null)}
          onConfirm={(rows) => {
            setSelectorRow(null);
            setSelectedRows(rows);
          }}
        />
      )}

      {/* ── Payment Dialog ─────────────────────────────────────────────────── */}
      {selectedRows && selectedRows.length > 0 && (
        <PayablePaymentDialog
          open={!!selectedRows}
          rows={selectedRows}
          onOpenChange={open => !open && setSelectedRows(null)}
          onSuccess={() => setSelectedRows(null)}
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
