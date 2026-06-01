'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useMemoFirebase, useCollection, useFirebaseApp } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, doc as firestoreDoc, updateDoc, deleteField } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator, FileText, BookOpen, ArrowLeftRight, Layers, Download,
  Calendar, Receipt, TrendingUp, AlertCircle, RefreshCw, Info, Package, Lock, Unlock,
} from 'lucide-react';
import { cn, roundMoney } from '@/lib/utils';
import { format, eachMonthOfInterval, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Compra, Venta, Producto, KardexMovement, Proveedor } from '@/lib/business-types';
import {
  buildSeniatTxt,
  formatSeniatPeriod,
  rowsToCsv,
  downloadBlob,
  exchangeDifferential,
  isInPeriod,
  buildPeriodCode,
  isPeriodClosed,
  previousPeriod,
  type SeniatRetentionRow,
} from '@/lib/accounting-helpers';

/** Formats Bs amount with thousands separator and 2 decimals (Venezuelan accounting standard). */
function fmtBs(n: number): string {
  return `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Converts USD amount to Bs using the supplied rate (snapshot rate per Compra, or current BCV fallback). */
function toBs(usd: number, rate: number): number {
  return usd * rate;
}

/** Returns true if a document was issued in Bs (Venezuelan currency). */
function isVesDoc(doc: any): boolean {
  const m = (doc?.moneda_original || '').toString().toLowerCase();
  return m === 'bs' || m === 'ves';
}

/**
 * Resolves a financial amount in Bs without round-trip rounding.
 * If the document was issued in Bs, prefers the snapshot `_bs` field (operator's exact digits).
 * Otherwise converts USD → Bs with the supplied rate.
 */
function bsAmount(doc: any, usdValue: number, bsField: string, rate: number): number {
  if (isVesDoc(doc)) {
    const direct = Number(doc?.[bsField]);
    if (Number.isFinite(direct) && direct > 0) return direct;
  }
  return (usdValue || 0) * rate;
}

const ISLR_LABELS: Record<string, string> = {
  SERV: 'Servicios 2%',
  HPN: 'Honorarios PN 3%',
  HPJ: 'Honorarios PJ 5%',
  FLET: 'Fletes 3%',
  PUBL: 'Publicidad 5%',
};

export default function AccountingPage() {
  const router = useRouter();
  const { slug } = useParams();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const functions = useMemo(() => getFunctions(firebaseApp), [firebaseApp]);
  const { concesionario, hasPermission, currentRole, staff, isLoading: authLoading } = useBusinessAuth();
  const { bcvRate: globalBcvRate } = useCurrency();
  const { toast } = useToast();

  // Global period filter (Month + Year)
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;
  const periodLabel = format(selectedDate, "MMMM yyyy", { locale: es });

  const availableMonths = useMemo(() => {
    return eachMonthOfInterval({
      start: subMonths(new Date(), 23),
      end: new Date(),
    }).reverse();
  }, []);

  // --- FISCAL PERIOD LOCK STATE ---
  const ultimoCerrado = concesionario?.configuracion?.ultimo_periodo_cerrado;
  const currentPeriodCode = useMemo(() => buildPeriodCode(year, month), [year, month]);
  const isPeriodAlreadyClosed = useMemo(
    () => isPeriodClosed(currentPeriodCode, ultimoCerrado),
    [currentPeriodCode, ultimoCerrado],
  );
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [isClosingPeriod, setIsClosingPeriod] = useState(false);

  const handleClosePeriod = async () => {
    if (!concesionario?.id || isClosingPeriod) return;
    setIsClosingPeriod(true);
    try {
      await updateDoc(firestoreDoc(firestore, 'concesionarios', concesionario.id), {
        'configuracion.ultimo_periodo_cerrado': currentPeriodCode,
      });
      toast({
        title: 'Período cerrado',
        description: `${periodLabel} y períodos anteriores quedaron bloqueados fiscalmente.`,
      });
      setCloseDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al cerrar período', description: (e as Error).message });
    } finally {
      setIsClosingPeriod(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (!concesionario?.id || isClosingPeriod) return;
    setIsClosingPeriod(true);
    try {
      const prev = ultimoCerrado ? previousPeriod(ultimoCerrado) : null;
      await updateDoc(firestoreDoc(firestore, 'concesionarios', concesionario.id), {
        'configuracion.ultimo_periodo_cerrado': prev ?? deleteField(),
      });
      toast({
        title: 'Período reabierto',
        description: prev
          ? `Último período cerrado ahora es ${prev.slice(0, 4)}-${prev.slice(4)}.`
          : 'Todos los períodos quedaron abiertos.',
      });
      setReopenDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al reabrir período', description: (e as Error).message });
    } finally {
      setIsClosingPeriod(false);
    }
  };

  const bcvRate = useMemo(() => {
    if (concesionario?.configuracion?.tasa_cambio_manual && concesionario.configuracion.tasa_cambio_manual > 1) {
      return concesionario.configuracion.tasa_cambio_manual;
    }
    return globalBcvRate || 60;
  }, [concesionario, globalBcvRate]);

  // --- QUERIES ---
  const comprasQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'compras'),
      orderBy('created_at', 'desc')
    );
  }, [concesionario, firestore]);

  const ventasQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      orderBy('fecha', 'desc')
    );
  }, [concesionario, firestore]);

  const productosQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(collection(firestore, 'concesionarios', concesionario.id, 'productos'), orderBy('nombre'));
  }, [concesionario, firestore]);

  const notasQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales'),
      orderBy('created_at', 'desc'),
    );
  }, [concesionario, firestore]);

  const { data: compras, isLoading: comprasLoading } = useCollection<Compra>(comprasQuery);
  const { data: ventas, isLoading: ventasLoading } = useCollection<Venta>(ventasQuery);
  const { data: productos } = useCollection<Producto>(productosQuery);
  const { data: notas } = useCollection<any>(notasQuery);

  // --- FILTER COMPRAS BY PERIOD ---
  const comprasPeriod = useMemo(() => {
    if (!compras) return [];
    return compras.filter(c => isInPeriod(c.fecha_factura, year, month));
  }, [compras, year, month]);

  const ventasPeriod = useMemo(() => {
    if (!ventas) return [];
    return ventas.filter(v => {
      const d = (v as any).fecha?.toDate?.() || ((v as any).fecha ? new Date((v as any).fecha) : null);
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [ventas, year, month]);

  // Fiscal notes of the period with retention voucher (only fiscal ones with IVA retention go to TXT SENIAT).
  const notasPeriod = useMemo(() => {
    if (!notas) return [];
    return notas.filter((n: any) =>
      isInPeriod(n.date, year, month)
      && n.is_fiscal !== false
      && (n.iva_retention_number || (n.iva_amount || 0) > 0)
    );
  }, [notas, year, month]);

  // --- KPIS (in Bolívares — Venezuelan accounting standard) ---
  const kpis = useMemo(() => {
    // Each compra is converted with its OWN snapshot rate (tasa_cambio) for fiscal fidelity.
    // Falls back to current BCV if a legacy compra lacks tasa_cambio.
    const totalIvaRetBs = comprasPeriod.reduce((s, c) => {
      const rate = c.tasa_cambio > 0 ? c.tasa_cambio : bcvRate;
      return s + toBs(c.monto_retenido || 0, rate);
    }, 0);
    const totalIslrRetBs = comprasPeriod.reduce((s, c) => {
      const rate = c.tasa_cambio > 0 ? c.tasa_cambio : bcvRate;
      return s + toBs(c.islr_retenido || 0, rate);
    }, 0);
    // Differential is already a Bs amount (USD * delta-rate).
    const totalDiffBs = (compras || [])
      .filter(c => c.estado === 'pendiente' && c.moneda_original === 'usd' && c.tasa_cambio > 0)
      .reduce((s, c) => s + exchangeDifferential(c.saldo_pendiente || c.total_usd, bcvRate, c.tasa_cambio), 0);
    return { totalIvaRetBs, totalIslrRetBs, totalDiffBs };
  }, [comprasPeriod, compras, bcvRate]);

  // --- PERMISSION GUARD ---
  if (authLoading) {
    return <div className="p-20 text-center text-muted-foreground text-xs font-black uppercase tracking-widest">Cargando módulo contable…</div>;
  }
  if (!concesionario) {
    return null;
  }
  if (hasPermission('accounting') === false) {
    return (
      <div className="p-20 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Sin acceso a Contabilidad</p>
        <p className="text-xs text-muted-foreground">Tu rol ({currentRole}) no tiene permisos sobre este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Calculator className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Contabilidad</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Módulo fiscal y contable — <span className="text-foreground font-bold">{concesionario.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          {/* Global Period Selector */}
          <div className="flex items-stretch gap-px rounded-2xl border bg-background shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-muted/50 flex flex-col justify-center border-r min-w-[140px]">
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Tasa BCV</p>
              <p className="text-sm font-bold font-headline text-primary">Bs {bcvRate.toFixed(2)}</p>
            </div>
            <div className="min-w-[220px]">
              <Select value={selectedDate.toISOString()} onValueChange={(v) => setSelectedDate(new Date(v))}>
                <SelectTrigger className="h-full border-none rounded-none px-5 py-3 bg-card hover:bg-muted/30 focus:ring-0">
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-black text-primary tracking-widest mb-1 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" /> Período Contable
                    </p>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border shadow-2xl">
                  {availableMonths.map(m => (
                    <SelectItem key={m.toISOString()} value={m.toISOString()} className="font-bold text-xs uppercase py-3">
                      {format(m, 'MMMM yyyy', { locale: es })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fiscal Close / Reopen buttons (owner-only) */}
          {currentRole === 'dueno' && (
            isPeriodAlreadyClosed ? (
              <Button
                onClick={() => setReopenDialogOpen(true)}
                disabled={isClosingPeriod}
                className="rounded-2xl px-5 h-auto bg-amber-500/10 text-amber-700 border border-amber-500/30 hover:bg-amber-500/20 font-bold gap-2"
                variant="outline"
              >
                <Unlock className="h-4 w-4" />
                Reabrir Período
              </Button>
            ) : (
              <Button
                onClick={() => setCloseDialogOpen(true)}
                disabled={isClosingPeriod}
                className="rounded-2xl px-5 h-auto bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 font-bold gap-2"
                variant="outline"
              >
                <Lock className="h-4 w-4" />
                Cerrar Período Fiscal
              </Button>
            )
          )}
        </div>
      </div>

      {/* Locked-period badge */}
      {isPeriodAlreadyClosed && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-widest relative z-10">
          <Lock className="h-3.5 w-3.5" />
          Período cerrado fiscalmente — documentos inmutables (último cierre: {ultimoCerrado?.slice(0,4)}-{ultimoCerrado?.slice(4)})
        </div>
      )}

      {/* KPI Cards (Glassmorphism) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        <KPICard title="IVA Retenido" value={fmtBs(kpis.totalIvaRetBs)} description={`Período ${periodLabel}`} icon={Receipt} variant="primary" />
        <KPICard title="ISLR Retenido" value={fmtBs(kpis.totalIslrRetBs)} description="Sobre egresos del mes" icon={FileText} variant="success" />
        <KPICard title="Diferencial Cambiario" value={fmtBs(kpis.totalDiffBs)} description="Sobre CxP abiertas en divisas" icon={TrendingUp} variant={kpis.totalDiffBs >= 0 ? 'success' : 'danger'} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="retentions" className="w-full relative z-10">
        <TabsList className="bg-transparent h-auto p-0 gap-4 sm:gap-8 justify-start border-b w-full rounded-none mb-8 flex-wrap">
          <TabTrigger value="retentions" label="Retenciones SENIAT" icon={Receipt} />
          <TabTrigger value="books" label="Libros C/V" icon={BookOpen} />
          <TabTrigger value="exchange" label="Diferencial Cambiario" icon={ArrowLeftRight} />
          <TabTrigger value="kardex" label="Kárdex" icon={Layers} />
        </TabsList>

        <TabsContent value="retentions" className="outline-none mt-0">
          <RetentionsTab
            compras={comprasPeriod}
            notas={notasPeriod}
            rifAgente={concesionario.rif || ''}
            slug={String(slug)}
            year={year}
            month={month}
            periodLabel={periodLabel}
            bcvRate={bcvRate}
          />
        </TabsContent>

        <TabsContent value="books" className="outline-none mt-0">
          <BooksTab
            compras={comprasPeriod}
            ventas={ventasPeriod}
            slug={String(slug)}
            periodLabel={periodLabel}
            vehiclesExentos={concesionario.configuracion?.vehiculos_exentos_iva}
            bcvRate={bcvRate}
          />
        </TabsContent>

        <TabsContent value="exchange" className="outline-none mt-0">
          <ExchangeDiffTab compras={compras || []} bcvRate={bcvRate} slug={String(slug)} periodLabel={periodLabel} />
        </TabsContent>

        <TabsContent value="kardex" className="outline-none mt-0">
          <KardexTab
            concesionarioId={concesionario.id}
            productos={productos || []}
            currentRole={currentRole}
            staffId={staff?.id || null}
            functions={functions}
            toast={toast}
            slug={String(slug)}
            bcvRate={bcvRate}
          />
        </TabsContent>
      </Tabs>

      {/* CLOSE PERIOD CONFIRMATION */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-5 w-5" /> Cerrar Período Fiscal — {periodLabel}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed pt-2">
              Al cerrar el período de <strong className="text-foreground">{periodLabel}</strong>, el sistema bloqueará la edición, anulación o creación de cualquier documento fiscal (compras, ventas, notas) con fecha igual o anterior a este mes. Esta acción solo puede deshacerla el dueño.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClosePeriod}
              disabled={isClosingPeriod}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              {isClosingPeriod ? 'Cerrando…' : 'Confirmar cierre'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* REOPEN PERIOD CONFIRMATION */}
      <AlertDialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <Unlock className="h-5 w-5" /> Reabrir Período Fiscal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed pt-2">
              ⚠️ Reabrir el último período cerrado (<strong className="text-foreground">{ultimoCerrado ? `${ultimoCerrado.slice(0,4)}-${ultimoCerrado.slice(4)}` : '—'}</strong>) permitirá modificar documentos ya declarados al SENIAT. Esta acción queda registrada en el historial de Firestore. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReopenPeriod}
              disabled={isClosingPeriod}
              className="rounded-xl bg-amber-600 text-white hover:bg-amber-700 font-bold"
            >
              {isClosingPeriod ? 'Reabriendo…' : 'Confirmar reapertura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ==================== SHARED COMPONENTS ==================== */

function KPICard({ title, value, description, icon: Icon, variant }: any) {
  const styles: any = {
    primary: 'bg-primary text-primary-foreground shadow-primary/30',
    success: 'bg-card/60 backdrop-blur-md ring-1 ring-border border-l-4 border-l-emerald-500',
    warning: 'bg-card/60 backdrop-blur-md ring-1 ring-border border-l-4 border-l-amber-500',
    danger: 'bg-card/60 backdrop-blur-md ring-1 ring-border border-l-4 border-l-red-500',
  };
  const isLight = variant !== 'primary';
  return (
    <Card className={cn('border-none shadow-xl relative overflow-hidden group transition-all hover:-translate-y-1 rounded-[1.5rem]', styles[variant])}>
      <Icon className={cn('absolute -bottom-4 -right-4 h-28 w-28 transition-transform group-hover:scale-110', isLight ? 'opacity-[0.08]' : 'opacity-[0.15]')} />
      <CardHeader className="pb-2 space-y-0 relative z-10">
        <p className={cn('text-[10px] font-black uppercase tracking-[0.2em]', isLight ? 'text-muted-foreground' : 'text-primary-foreground/60')}>{title}</p>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-bold font-headline tracking-tighter leading-none">{value}</div>
        <p className={cn('text-xs mt-2.5 font-medium', isLight ? 'text-muted-foreground' : 'text-primary-foreground/80')}>{description}</p>
      </CardContent>
    </Card>
  );
}

function TabTrigger({ value, label, icon: Icon }: any) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2"
    >
      <Icon className="h-4 w-4" /> {label}
    </TabsTrigger>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-20 text-center flex flex-col items-center gap-2 opacity-30">
      <Info className="h-10 w-10" />
      <p className="text-sm font-bold uppercase tracking-widest italic px-10">{label}</p>
    </div>
  );
}

function SectionCard({ title, description, children, actions }: any) {
  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[1.5rem]">
      <CardHeader className="bg-muted/30 pb-4 border-b flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="text-lg font-headline">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

/* ==================== TAB: RETENTIONS SENIAT ==================== */

function RetentionsTab({ compras, notas, rifAgente, slug, year, month, periodLabel, bcvRate }: {
  compras: Compra[]; notas: any[]; rifAgente: string; slug: string; year: number; month: number; periodLabel: string; bcvRate: number;
}) {
  const rows = compras.filter(c => (c.monto_retenido || 0) > 0 || (c.islr_retenido || 0) > 0);
  const notasRet = notas.filter(n => (n.iva_amount || 0) > 0 && n.iva_retention_number);

  const rateOf = (c: Compra) => (c.tasa_cambio > 0 ? c.tasa_cambio : bcvRate);
  const rateOfNota = (n: any) => (n.exchange_rate > 0 ? n.exchange_rate : bcvRate);

  // Compute retenido USD on a nota: iva_amount × retention_iva_rate (rate stored as 75 / 100).
  const notaIvaRetenidoUsd = (n: any) => {
    const ivaUsd = n.currency === 'VES' ? (n.iva_amount || 0) / rateOfNota(n) : (n.iva_amount || 0);
    const pct = (n.retention_iva_rate || 75) / 100;
    return ivaUsd * pct;
  };

  const notaBaseImponibleUsd = (n: any) => {
    return n.currency === 'VES' ? (n.taxable_amount || 0) / rateOfNota(n) : (n.taxable_amount || 0);
  };

  const notaTotalUsd = (n: any) => Number(n.total_usd || 0);

  // Bs resolvers prefer direct _bs snapshots when nota was issued in VES.
  const notaBaseBs = (n: any) => bsAmount(
    { ...n, moneda_original: n.currency === 'VES' ? 'VES' : 'USD' },
    notaBaseImponibleUsd(n),
    'base_imponible_bs',
    rateOfNota(n),
  );
  const notaIvaRetBs = (n: any) => bsAmount(
    { ...n, moneda_original: n.currency === 'VES' ? 'VES' : 'USD' },
    notaIvaRetenidoUsd(n),
    'monto_retenido_bs',
    rateOfNota(n),
  );
  const notaTotalBs = (n: any) => bsAmount(
    { ...n, moneda_original: n.currency === 'VES' ? 'VES' : 'USD' },
    notaTotalUsd(n),
    'total_bs',
    rateOfNota(n),
  );

  const handleExportTxt = () => {
    // SENIAT TXT must be declared in Bolívares (legal tender). All numeric fields rounded to 2 decimals.
    const periodo = formatSeniatPeriod(year, month);
    const seniatCompras: SeniatRetentionRow[] = rows
      .filter(c => (c.monto_retenido || 0) > 0)
      .map(c => {
        const rate = rateOf(c);
        const baseImponibleUsd = (c.iva_monto || 0) > 0 ? c.iva_monto / 0.16 : c.subtotal_usd;
        const montoExentoUsd = Math.max(0, c.subtotal_usd - baseImponibleUsd);
        // Use Bs snapshots directly when the compra was issued in Bs (avoids round-trip rounding).
        const totalBs = bsAmount(c, c.total_usd, 'total_bs', rate);
        const baseBs = bsAmount(c, baseImponibleUsd, 'subtotal_bs', rate);
        const ivaRetBs = bsAmount(c, c.monto_retenido || 0, 'monto_retenido_bs', rate);
        const exentoBs = isVesDoc(c) && (c as any).subtotal_bs ? Math.max(0, totalBs - baseBs - bsAmount(c, c.iva_monto || 0, 'iva_monto_bs', rate)) : toBs(montoExentoUsd, rate);
        return {
          rifAgente,
          periodo,
          fechaFactura: c.fecha_factura || format(new Date(), 'yyyy-MM-dd'),
          tipoOperacion: 'C' as const,
          tipoDocumento: '01' as const,
          rifProveedor: c.proveedor_rif || '',
          numeroFactura: c.numero_factura || '',
          numeroControl: c.numero_control || '',
          montoTotal: roundMoney(totalBs),
          baseImponible: roundMoney(baseBs),
          ivaRetenido: roundMoney(ivaRetBs),
          docAfectado: '0',
          numeroComprobante: c.numero_comprobante || '0',
          montoExento: roundMoney(exentoBs),
          alicuota: 16.0,
          expediente: '0',
        };
      });

    const seniatNotas: SeniatRetentionRow[] = notasRet.map(n => {
      return {
        rifAgente,
        periodo,
        fechaFactura: n.date || format(new Date(), 'yyyy-MM-dd'),
        tipoOperacion: 'C' as const,
        // SENIAT: 02 = Nota de Débito, 03 = Nota de Crédito.
        tipoDocumento: (n.type === 'DEBIT' ? '02' : '03') as '02' | '03',
        rifProveedor: n.provider_rif || '',
        numeroFactura: n.note_number || '',
        numeroControl: n.note_number || '',
        montoTotal: roundMoney(notaTotalBs(n)),
        baseImponible: roundMoney(notaBaseBs(n)),
        ivaRetenido: roundMoney(notaIvaRetBs(n)),
        // Doc afectado: the original invoice number.
        docAfectado: n.invoice_number || '0',
        numeroComprobante: n.iva_retention_number || '0',
        montoExento: 0,
        alicuota: 16.0,
        expediente: '0',
      };
    });

    const body = buildSeniatTxt([...seniatCompras, ...seniatNotas]);
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8;' });
    downloadBlob(blob, `retenciones_iva_${slug}_${periodo}.txt`);
  };

  const handleExportCsv = () => {
    const headers = ['Tipo Doc', 'Fecha', 'RIF Proveedor', 'Proveedor', 'N° Documento', 'N° Control', 'Tasa BCV', 'Base Bs', 'IVA Bs', '% Ret IVA', 'IVA Retenido Bs', 'ISLR Concepto', 'ISLR %', 'ISLR Retenido Bs', 'N° Comprobante', 'Neto a Pagar Bs'];
    const dataCompras = rows.map(c => {
      const rate = rateOf(c);
      return [
        'Factura',
        c.fecha_factura || '',
        c.proveedor_rif || '',
        c.proveedor_nombre,
        c.numero_factura || '',
        c.numero_control || '',
        roundMoney(rate),
        roundMoney(bsAmount(c, c.subtotal_usd, 'subtotal_bs', rate)),
        roundMoney(bsAmount(c, c.iva_monto || 0, 'iva_monto_bs', rate)),
        c.porcentaje_retencion_aplicado || 0,
        roundMoney(bsAmount(c, c.monto_retenido || 0, 'monto_retenido_bs', rate)),
        c.islr_concept ? ISLR_LABELS[c.islr_concept] : '',
        c.islr_percentage ? c.islr_percentage * 100 : 0,
        roundMoney(bsAmount(c, c.islr_retenido || 0, 'islr_retenido_bs', rate)),
        c.numero_comprobante || '',
        roundMoney(bsAmount(c, c.neto_a_pagar || c.total_usd, 'neto_a_pagar_bs', rate)),
      ];
    });
    const dataNotas = notasRet.map(n => {
      const rate = rateOfNota(n);
      const ivaUsd = n.currency === 'VES' ? (n.iva_amount || 0) / rate : (n.iva_amount || 0);
      const ivaBs = isVesDoc({ moneda_original: n.currency }) && n.iva_monto_bs
        ? n.iva_monto_bs
        : toBs(ivaUsd, rate);
      return [
        n.type === 'DEBIT' ? 'Nota Débito' : 'Nota Crédito',
        n.date || '',
        n.provider_rif || '',
        n.provider_name || '',
        n.note_number || '',
        n.note_number || '',
        roundMoney(rate),
        roundMoney(notaBaseBs(n)),
        roundMoney(ivaBs),
        n.retention_iva_rate || 75,
        roundMoney(notaIvaRetBs(n)),
        '',
        0,
        0,
        n.iva_retention_number || '',
        roundMoney(notaTotalBs(n)),
      ];
    });
    downloadBlob(rowsToCsv(headers, [...dataCompras, ...dataNotas]), `retenciones_${slug}_${formatSeniatPeriod(year, month)}.csv`);
  };

  const totalDocs = rows.length + notasRet.length;

  return (
    <SectionCard
      title="Retenciones de IVA e ISLR"
      description={`${totalDocs} documento(s) en ${periodLabel} · ${rows.length} factura(s), ${notasRet.length} nota(s)`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!totalDocs} className="rounded-xl h-9 text-xs font-bold gap-2">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button onClick={handleExportTxt} disabled={!totalDocs} className="rounded-xl h-9 text-xs font-bold gap-2 bg-primary">
            <Download className="h-3.5 w-3.5" /> TXT SENIAT
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-muted/50 border-b">
              {['Tipo', 'Fecha', 'Proveedor', 'N° Doc', 'Base', 'IVA Ret.', 'ISLR Ret.', 'Comprobante', 'Neto'].map(h => (
                <th key={h} className="px-4 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(c => {
              const rate = rateOf(c);
              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3"><span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-primary/10 text-primary">Factura</span></td>
                  <td className="px-4 py-3 text-xs font-medium">{c.fecha_factura || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold">{c.proveedor_nombre}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{c.proveedor_rif}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-bold">{c.numero_factura || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">Ctrl: {c.numero_control || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{fmtBs(bsAmount(c, c.subtotal_usd, 'subtotal_bs', rate))}</td>
                  <td className="px-4 py-3 text-sm font-bold text-primary">{fmtBs(bsAmount(c, c.monto_retenido || 0, 'monto_retenido_bs', rate))}</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600">
                    {(c.islr_retenido || 0) > 0 ? fmtBs(bsAmount(c, c.islr_retenido!, 'islr_retenido_bs', rate)) : '—'}
                    {c.islr_concept && <p className="text-[9px] text-muted-foreground font-medium">{ISLR_LABELS[c.islr_concept]}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">{c.numero_comprobante || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">{fmtBs(bsAmount(c, c.neto_a_pagar || c.total_usd, 'neto_a_pagar_bs', rate))}</td>
                </tr>
              );
            })}
            {notasRet.map(n => {
              const isNd = n.type === 'DEBIT';
              return (
                <tr key={n.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
                      isNd ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700',
                    )}>{isNd ? 'ND' : 'NC'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">{n.date || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold">{n.provider_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{n.provider_rif}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-bold">{n.note_number || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">Afecta: {n.invoice_number || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{fmtBs(notaBaseBs(n))}</td>
                  <td className="px-4 py-3 text-sm font-bold text-primary">{fmtBs(notaIvaRetBs(n))}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-xs font-mono">{n.iva_retention_number || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">{fmtBs(notaTotalBs(n))}</td>
                </tr>
              );
            })}
            {!totalDocs && (
              <tr><td colSpan={9}><EmptyState label={`Sin retenciones en ${periodLabel}`} /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ==================== TAB: BOOKS (Compras + Ventas) ==================== */

/**
 * Splits a Venta into base imponible (gravable) + exento + IVA + total — USD-based.
 * Strategy: if Venta carries an `items` array (sale-by-products), iterate items honoring
 * each item's `aplica_iva` per-item flag. Otherwise (vehicle sale, single-line model),
 * fall back to extracting IVA inverse from `precio_venta`, or treat as exempt if the
 * concesionario flag `vehiculos_exentos_iva` is on.
 */
function splitVentaTax(v: any, vehiclesExentos: boolean): { base: number; exento: number; iva: number; total: number } {
  const items: Array<{ subtotal_usd?: number; aplica_iva?: boolean; precio_usd?: number; cantidad?: number }> | undefined = v.items;
  if (Array.isArray(items) && items.length > 0) {
    let base = 0;
    let exento = 0;
    for (const it of items) {
      const sub = Number(it.subtotal_usd ?? ((it.precio_usd ?? 0) * (it.cantidad ?? 1)));
      if (it.aplica_iva) base += sub;
      else exento += sub;
    }
    const iva = roundMoney(base * 0.16);
    return {
      base: roundMoney(base),
      exento: roundMoney(exento),
      iva,
      total: roundMoney(base + exento + iva),
    };
  }
  // Vehicle sale fallback — single-line precio_venta.
  const precio = Number(v.precio_venta || 0);
  if (vehiclesExentos) {
    return { base: 0, exento: roundMoney(precio), iva: 0, total: roundMoney(precio) };
  }
  // precio_venta historically includes IVA → inverse extraction.
  const base = roundMoney(precio / 1.16);
  const iva = roundMoney(precio - base);
  return { base, exento: 0, iva, total: roundMoney(precio) };
}

function BooksTab({ compras, ventas, slug, periodLabel, vehiclesExentos, bcvRate }: {
  compras: Compra[]; ventas: Venta[]; slug: string; periodLabel: string; vehiclesExentos?: boolean; bcvRate: number;
}) {
  // Fiscal books exclude non-fiscal documents (Notas de Entrega, ventas de mostrador no fiscales, etc.).
  // Legacy docs without is_fiscal flag are treated as fiscal (!== false admits undefined).
  const comprasFiscales = useMemo(() => compras.filter(c => c.is_fiscal !== false), [compras]);
  const ventasFiscales = useMemo(() => ventas.filter(v => (v as any).is_fiscal !== false), [ventas]);

  // Sale rate: vehicles store precio in USD; convert with the day's BCV (no per-sale snapshot exists).
  // TODO: when ventas start persisting tasa_cambio at sale time, prefer that.
  const rateCompra = (c: Compra) => (c.tasa_cambio > 0 ? c.tasa_cambio : bcvRate);

  const exportComprasCsv = () => {
    const headers = ['Fecha', 'RIF', 'Proveedor', 'N° Factura', 'N° Control', 'Tasa', 'Base Bs', 'Exento Bs', 'IVA Bs', 'Total Bs'];
    const rows = comprasFiscales.map(c => {
      const rate = rateCompra(c);
      const baseUsd = (c.iva_monto || 0) > 0 ? c.iva_monto / 0.16 : c.subtotal_usd;
      const exentoUsd = Math.max(0, c.subtotal_usd - baseUsd);
      // Bs precision: use snapshot _bs fields when the compra was issued in Bs.
      const totalBs = bsAmount(c, c.total_usd, 'total_bs', rate);
      const ivaBs = bsAmount(c, c.iva_monto || 0, 'iva_monto_bs', rate);
      const baseBs = bsAmount(c, baseUsd, 'subtotal_bs', rate);
      const exentoBs = isVesDoc(c) && (c as any).subtotal_bs ? Math.max(0, totalBs - baseBs - ivaBs) : toBs(exentoUsd, rate);
      return [
        c.fecha_factura || '',
        c.proveedor_rif || '',
        c.proveedor_nombre,
        c.numero_factura || '',
        c.numero_control || '',
        roundMoney(rate),
        roundMoney(baseBs),
        roundMoney(exentoBs),
        roundMoney(ivaBs),
        roundMoney(totalBs),
      ];
    });
    downloadBlob(rowsToCsv(headers, rows), `libro_compras_${slug}_${periodLabel.replace(' ', '_')}.csv`);
  };

  const exportVentasCsv = () => {
    const headers = ['Fecha', 'N° Factura', 'N° Control', 'Cliente', 'Tasa', 'Base Bs', 'Exento Bs', 'IVA Bs', 'Total Bs', 'Método Pago'];
    const rows = ventasFiscales.map(v => {
      const f = splitVentaTax(v, !!vehiclesExentos);
      return [
        (v as any).fecha?.toDate?.()?.toISOString?.()?.slice(0, 10) || '',
        (v as any).numero_factura_venta || '',
        (v as any).numero_control_venta || '',
        (v as any).cliente_nombre || '',
        roundMoney(bcvRate),
        roundMoney(toBs(f.base, bcvRate)),
        roundMoney(toBs(f.exento, bcvRate)),
        roundMoney(toBs(f.iva, bcvRate)),
        roundMoney(toBs(f.total, bcvRate)),
        (v as any).metodo_pago || '',
      ];
    });
    downloadBlob(rowsToCsv(headers, rows), `libro_ventas_${slug}_${periodLabel.replace(' ', '_')}.csv`);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Libro de Compras"
        description={`${comprasFiscales.length} documento(s) fiscal(es) en ${periodLabel} — montos en Bolívares`}
        actions={<Button variant="outline" size="sm" onClick={exportComprasCsv} disabled={!comprasFiscales.length} className="rounded-xl h-9 text-xs font-bold gap-2"><Download className="h-3.5 w-3.5" /> CSV</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {['Fecha', 'Proveedor', 'Factura', 'Tasa', 'Base Bs', 'IVA Bs', 'Total Bs'].map(h => (
                  <th key={h} className="px-4 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {comprasFiscales.map(c => {
                const rate = rateCompra(c);
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs">{c.fecha_factura || '—'}</td>
                    <td className="px-4 py-3"><p className="text-sm font-bold">{c.proveedor_nombre}</p><p className="text-[10px] text-muted-foreground font-mono">{c.proveedor_rif}</p></td>
                    <td className="px-4 py-3 text-xs"><p className="font-bold">{c.numero_factura || '—'}</p><p className="text-[10px] text-muted-foreground">Ctrl: {c.numero_control || '—'}</p></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{rate.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">{fmtBs(bsAmount(c, c.subtotal_usd, 'subtotal_bs', rate))}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{fmtBs(bsAmount(c, c.iva_monto || 0, 'iva_monto_bs', rate))}</td>
                    <td className="px-4 py-3 text-sm font-bold">{fmtBs(bsAmount(c, c.total_usd, 'total_bs', rate))}</td>
                  </tr>
                );
              })}
              {!comprasFiscales.length && <tr><td colSpan={7}><EmptyState label={`Sin compras fiscales en ${periodLabel}`} /></td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Libro de Ventas"
        description={`${ventasFiscales.length} venta(s) fiscal(es) en ${periodLabel} — convertidas a Bs con BCV actual`}
        actions={<Button variant="outline" size="sm" onClick={exportVentasCsv} disabled={!ventasFiscales.length} className="rounded-xl h-9 text-xs font-bold gap-2"><Download className="h-3.5 w-3.5" /> CSV</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {['Factura', 'Cliente', 'Base Bs', 'Exento Bs', 'IVA Bs', 'Total Bs'].map(h => (
                  <th key={h} className="px-4 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {ventasFiscales.map(v => {
                const f = splitVentaTax(v, !!vehiclesExentos);
                return (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs"><p className="font-bold">{(v as any).numero_factura_venta || '—'}</p><p className="text-[10px] text-muted-foreground">Ctrl: {(v as any).numero_control_venta || '—'}</p></td>
                    <td className="px-4 py-3 text-sm font-bold">{(v as any).cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 text-sm">{fmtBs(toBs(f.base, bcvRate))}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{fmtBs(toBs(f.exento, bcvRate))}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{fmtBs(toBs(f.iva, bcvRate))}</td>
                    <td className="px-4 py-3 text-sm font-bold">{fmtBs(toBs(f.total, bcvRate))}</td>
                  </tr>
                );
              })}
              {!ventasFiscales.length && <tr><td colSpan={6}><EmptyState label={`Sin ventas fiscales en ${periodLabel}`} /></td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ==================== TAB: EXCHANGE DIFFERENTIAL ==================== */

function ExchangeDiffTab({ compras, bcvRate, slug, periodLabel }: { compras: Compra[]; bcvRate: number; slug: string; periodLabel: string }) {
  const items = useMemo(() => {
    return compras
      .filter(c => c.estado === 'pendiente' && c.moneda_original === 'usd' && c.tasa_cambio > 0)
      .map(c => {
        const balance = c.saldo_pendiente ?? c.total_usd;
        const diff = exchangeDifferential(balance, bcvRate, c.tasa_cambio);
        return { ...c, _balance: balance, _diff: diff };
      });
  }, [compras, bcvRate]);

  const total = items.reduce((s, i) => s + i._diff, 0);

  const exportCsv = () => {
    const headers = ['Proveedor', 'RIF', 'N° Factura', 'Saldo Bs (Origen)', 'Saldo Bs (Hoy)', 'Tasa Origen', 'Tasa Actual BCV', 'Diferencial Bs'];
    const rows = items.map(i => [
      i.proveedor_nombre,
      i.proveedor_rif || '',
      i.numero_factura || '',
      toBs(i._balance, i.tasa_cambio),
      toBs(i._balance, bcvRate),
      i.tasa_cambio,
      bcvRate,
      i._diff,
    ]);
    downloadBlob(rowsToCsv(headers, rows), `diferencial_cambiario_${slug}_${periodLabel.replace(' ', '_')}.csv`);
  };

  return (
    <SectionCard
      title="Diferencial Cambiario — Cuentas por Pagar USD"
      description="Utilidad o pérdida cambiaria sobre saldos abiertos en divisas"
      actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!items.length} className="rounded-xl h-9 text-xs font-bold gap-2"><Download className="h-3.5 w-3.5" /> CSV</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              {['Proveedor', 'Factura', 'Saldo Bs (Origen)', 'Saldo Bs (Hoy)', 'Tasa Origen', 'Tasa Actual', 'Diferencial Bs'].map(h => (
                <th key={h} className="px-4 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(i => (
              <tr key={i.id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><p className="text-sm font-bold">{i.proveedor_nombre}</p><p className="text-[10px] text-muted-foreground font-mono">{i.proveedor_rif}</p></td>
                <td className="px-4 py-3 text-xs">{i.numero_factura || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{fmtBs(toBs(i._balance, i.tasa_cambio))}</td>
                <td className="px-4 py-3 text-sm">{fmtBs(toBs(i._balance, bcvRate))}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{i.tasa_cambio.toFixed(2)}</td>
                <td className="px-4 py-3 text-xs">{bcvRate.toFixed(2)}</td>
                <td className={cn('px-4 py-3 text-sm font-bold', i._diff >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {fmtBs(i._diff)}
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7}><EmptyState label="Sin saldos en divisas abiertos" /></td></tr>}
            {items.length > 0 && (
              <tr className="bg-muted/40 font-bold">
                <td colSpan={6} className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Diferencial</td>
                <td className={cn('px-4 py-4 text-base font-bold', total >= 0 ? 'text-emerald-600' : 'text-red-600')}>{fmtBs(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ==================== TAB: KARDEX ==================== */

function KardexTab({ concesionarioId, productos, currentRole, staffId, functions, toast, slug, bcvRate }: any) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isRebuilding, setIsRebuilding] = useState(false);
  const firestore = useFirestore();

  const movementsQuery = useMemoFirebase(() => {
    if (!selectedProductId) return null;
    return query(
      collection(firestore, 'concesionarios', concesionarioId, 'kardex_movements'),
      where('producto_id', '==', selectedProductId),
      orderBy('fecha', 'asc')
    );
  }, [selectedProductId, concesionarioId, firestore]);

  const { data: movements, isLoading } = useCollection<KardexMovement>(movementsQuery);

  const handleRebuild = async () => {
    if (!confirm('¿Reconstruir el kárdex histórico? Esto borrará la colección actual y la regenerará desde compras+ventas.')) return;
    setIsRebuilding(true);
    try {
      const callable = httpsCallable(functions, 'backfillKardex');
      const result = await callable({ concesionarioId, staffId });
      const data = result.data as any;
      toast({ title: 'Kárdex reconstruido', description: `${data.processedCompras || 0} compras + ${data.processedVentas || 0} ventas procesadas.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al reconstruir', description: err.message || 'Verifique permisos y deploy de Cloud Functions.' });
    } finally {
      setIsRebuilding(false);
    }
  };

  const exportCsv = () => {
    if (!movements?.length) return;
    const headers = ['Fecha', 'Tipo', 'Origen', 'Doc ID', 'Cantidad', 'Costo Unit Bs', 'Valor Total Bs', 'Saldo Qty', 'Saldo Costo Prom Bs', 'Saldo Valor Bs'];
    const rows = movements.map(m => [
      m.fecha?.toDate?.()?.toISOString?.()?.slice(0, 10) || '',
      m.tipo, m.origen, m.origen_doc_id,
      m.cantidad,
      toBs(m.costo_unitario, bcvRate),
      toBs(m.valor_total, bcvRate),
      m.saldo_cantidad,
      toBs(m.saldo_costo_promedio, bcvRate),
      toBs(m.saldo_valor_total, bcvRate),
    ]);
    const producto = productos.find((p: Producto) => p.id === selectedProductId);
    downloadBlob(rowsToCsv(headers, rows), `kardex_${producto?.codigo || selectedProductId}.csv`);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Kárdex de Inventario (Costo Promedio Ponderado)"
        description="Movimientos contables de entrada y salida con valoración CPP"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!movements?.length} className="rounded-xl h-9 text-xs font-bold gap-2">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            {currentRole === 'dueno' && (
              <Button size="sm" variant="outline" onClick={handleRebuild} disabled={isRebuilding} className="rounded-xl h-9 text-xs font-bold gap-2 border-amber-500/50 text-amber-700">
                <RefreshCw className={cn('h-3.5 w-3.5', isRebuilding && 'animate-spin')} /> Recalcular Kárdex
              </Button>
            )}
          </div>
        }
      >
        <div className="p-6 border-b bg-muted/20">
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="max-w-md rounded-xl h-11">
              <SelectValue placeholder="Selecciona un producto…" />
            </SelectTrigger>
            <SelectContent>
              {productos.map((p: Producto) => (
                <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left align-bottom">Fecha</th>
                <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-left align-bottom">Concepto</th>
                <th colSpan={2} className="px-4 py-2 text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center border-l">Entradas</th>
                <th colSpan={2} className="px-4 py-2 text-[10px] font-black text-red-700 uppercase tracking-widest text-center border-l">Salidas</th>
                <th colSpan={3} className="px-4 py-2 text-[10px] font-black text-primary uppercase tracking-widest text-center border-l">Saldos</th>
              </tr>
              <tr className="bg-muted/30 border-b">
                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase border-l">Qty</th>
                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase">Valor</th>
                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase border-l">Qty</th>
                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase">Valor</th>
                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase border-l">Qty</th>
                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase">Costo Prom</th>
                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(movements || []).map(m => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs">{m.fecha?.toDate?.()?.toISOString?.()?.slice(0, 10) || '—'}</td>
                  <td className="px-4 py-3 text-xs font-bold uppercase tracking-tight">{m.origen}</td>
                  <td className="px-3 py-3 text-xs text-emerald-600 border-l">{m.tipo === 'entrada' ? m.cantidad : '—'}</td>
                  <td className="px-3 py-3 text-xs text-emerald-600">{m.tipo === 'entrada' ? fmtBs(toBs(m.valor_total, bcvRate)) : '—'}</td>
                  <td className="px-3 py-3 text-xs text-red-600 border-l">{m.tipo === 'salida' ? m.cantidad : '—'}</td>
                  <td className="px-3 py-3 text-xs text-red-600">{m.tipo === 'salida' ? fmtBs(toBs(m.valor_total, bcvRate)) : '—'}</td>
                  <td className="px-3 py-3 text-xs font-bold border-l">{m.saldo_cantidad}</td>
                  <td className="px-3 py-3 text-xs">{fmtBs(toBs(m.saldo_costo_promedio, bcvRate))}</td>
                  <td className="px-3 py-3 text-xs font-bold">{fmtBs(toBs(m.saldo_valor_total, bcvRate))}</td>
                </tr>
              ))}
              {!selectedProductId && <tr><td colSpan={9}><EmptyState label="Selecciona un producto" /></td></tr>}
              {selectedProductId && !isLoading && !movements?.length && <tr><td colSpan={9}><EmptyState label="Sin movimientos registrados" /></td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
