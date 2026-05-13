'use client';

import { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { KpiCard, KpiCardSkeleton } from './kpi-card';
import { ActionCenter } from './action-center';
import { PulseChart } from './pulse-chart';
import { Shortcuts } from './shortcuts';
import {
  LayoutDashboard,
  Wallet,
  ShoppingCart,
  Receipt,
  AlertCircle,
  RefreshCw,
  Calendar,
  Plus,
  FileWarning,
} from 'lucide-react';
import { startOfDay, subDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { Venta, RegistroCaja, Producto, Compra, CuentaPorCobrar, Cuota } from '@/lib/business-types';

type OwnerOverviewProps = {
  /** Encargado is read-only on creation flows but sees the same dashboard */
  isReadOnly?: boolean;
};

export function OwnerOverview({ isReadOnly = false }: OwnerOverviewProps) {
  const router = useRouter();
  const { slug } = useParams();
  const { concesionario, staff } = useBusinessAuth();
  const firestore = useFirestore();

  const todayStart = useMemo(() => Timestamp.fromDate(startOfDay(new Date())), []);
  const yesterdayStart = useMemo(() => Timestamp.fromDate(startOfDay(subDays(new Date(), 1))), []);

  // ── KPI 1: Caja del día (caja collection, fecha >= startOfDay)
  const cajaHoyQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'caja'),
      where('fecha', '>=', todayStart)
    );
  }, [concesionario?.id, firestore, todayStart]);

  // ── KPI 2: Ventas hoy
  const ventasHoyQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      where('fecha', '>=', todayStart)
    );
  }, [concesionario?.id, firestore, todayStart]);

  // ── KPI 2 sub: Ventas ayer (para "vs ayer")
  const ventasAyerQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      where('fecha', '>=', yesterdayStart),
      where('fecha', '<', todayStart)
    );
  }, [concesionario?.id, firestore, yesterdayStart, todayStart]);

  // ── KPI 3: Prefacturas pendientes
  const preInvoicesQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'pre_invoices'),
      where('estado', '==', 'pendiente')
    );
  }, [concesionario?.id, firestore]);

  // ── KPI 4 (alertas): productos bajo stock + compras pendientes
  const productosQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(collection(firestore, 'concesionarios', concesionario.id, 'productos'));
  }, [concesionario?.id, firestore]);

  const comprasPendQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'compras'),
      where('estado', 'in', ['pendiente', 'parcial'])
    );
  }, [concesionario?.id, firestore]);

  // CxP: notas de débito pendientes
  const notasDebitoPendQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales'),
      where('type', '==', 'DEBIT')
    );
  }, [concesionario?.id, firestore]);

  // CxP: consignaciones por pagar
  const consignacionesPendQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'consignaciones_por_pagar'),
      where('estado', 'in', ['pendiente', 'parcial'])
    );
  }, [concesionario?.id, firestore]);

  // CxP: gastos pendientes
  const gastosPendQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'gastos'),
      where('status', '==', 'PENDIENTE')
    );
  }, [concesionario?.id, firestore]);

  // CxP: vehiculos con saldo pendiente
  const vehiculosPendQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'inventario'),
      where('estado_pago', '==', 'pendiente')
    );
  }, [concesionario?.id, firestore]);

  // CXC: cuentas por cobrar activas + cuotas vencidas
  const cxcActiveQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'cuentas_por_cobrar'),
      where('status', '!=', 'pagado'),
      orderBy('status'),
      orderBy('fecha_emision', 'desc'),
      limit(100)
    );
  }, [concesionario?.id, firestore]);

  const cxcVencidasQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collectionGroup(firestore, 'cuotas'),
      where('concesionario_id', '==', concesionario.id),
      where('estado', '==', 'vencida'),
      limit(50)
    );
  }, [concesionario?.id, firestore]);

  const { data: cajaHoy, isLoading: cajaLoading } = useCollection<RegistroCaja>(cajaHoyQuery);
  const { data: ventasHoy, isLoading: ventasLoading } = useCollection<Venta>(ventasHoyQuery);
  const { data: ventasAyer } = useCollection<Venta>(ventasAyerQuery);
  const { data: preInvoices, isLoading: piLoading } = useCollection<any>(preInvoicesQuery);
  const { data: productos, isLoading: prodLoading } = useCollection<Producto>(productosQuery);
  const { data: comprasPend, isLoading: cxpLoading } = useCollection<Compra>(comprasPendQuery);
  const { data: notasDebitoPend } = useCollection<any>(notasDebitoPendQuery);
  const { data: consignacionesPend } = useCollection<any>(consignacionesPendQuery);
  const { data: gastosPend } = useCollection<any>(gastosPendQuery);
  const { data: vehiculosPend } = useCollection<any>(vehiculosPendQuery);
  const { data: cxcActive } = useCollection<CuentaPorCobrar>(cxcActiveQuery);
  const { data: cuotasVencidas } = useCollection<Cuota>(cxcVencidasQuery);

  const cajaBalance = useMemo(() => {
    if (!cajaHoy) return { balance: 0, count: 0 };
    let balance = 0;
    cajaHoy.forEach((c) => {
      balance += c.tipo === 'ingreso' ? c.monto || 0 : -(c.monto || 0);
    });
    return { balance, count: cajaHoy.length };
  }, [cajaHoy]);

  const ventasStats = useMemo(() => {
    const todayTotal = (ventasHoy || []).reduce((s, v) => s + (v.precio_venta || 0), 0);
    const yesterdayTotal = (ventasAyer || []).reduce((s, v) => s + (v.precio_venta || 0), 0);
    const diff = todayTotal - yesterdayTotal;
    return {
      count: ventasHoy?.length || 0,
      total: todayTotal,
      diff,
      hasYesterday: (ventasAyer?.length || 0) > 0 || yesterdayTotal > 0,
    };
  }, [ventasHoy, ventasAyer]);

  const preInvoicesStats = useMemo(() => {
    const total = (preInvoices || []).reduce(
      (s, pi: any) => s + (pi.precio_negociado ?? pi.total_usd ?? pi.precio_total ?? 0),
      0
    );
    return { count: preInvoices?.length || 0, total };
  }, [preInvoices]);

  // CXC stats: total saldo + cuotas vencidas + prefacturas
  const cxcStats = useMemo(() => {
    const totalSaldoCxc = (cxcActive || []).reduce(
      (s, c) => s + (c.saldo_pendiente_usd ?? 0),
      0
    );
    const vencidasCount = cuotasVencidas?.length ?? 0;
    const docs = cxcActive?.length ?? 0;
    const combinedTotal = totalSaldoCxc + preInvoicesStats.total;
    return {
      totalSaldoCxc,
      vencidasCount,
      docs,
      combinedTotal,
    };
  }, [cxcActive, cuotasVencidas, preInvoicesStats]);

  const alertasStats = useMemo(() => {
    const stockBajo = (productos || []).filter((p) => p.stock_actual <= p.stock_minimo).length;
    const now = new Date();
    const cxpUrgentes = (comprasPend || []).filter((c) => {
      const venc = c.fecha_vencimiento?.toDate?.();
      if (!venc) return false;
      const daysLeft = Math.floor((venc.getTime() - now.getTime()) / 86_400_000);
      return daysLeft <= 7;
    }).length;
    return { count: stockBajo + cxpUrgentes, stockBajo, cxpUrgentes };
  }, [productos, comprasPend]);

  // ── Deuda CxP total (suma saldo_pendiente USD de TODOS los pasivos)
  const cxpStats = useMemo(() => {
    let totalUsd = 0;
    let docs = 0;
    const safeRate = (concesionario as any)?.tasa_actual_bcv || 1;

    (comprasPend || []).forEach((c: any) => {
      const saldo = c.saldo_pendiente ?? c.neto_a_pagar ?? c.total_usd ?? 0;
      if (saldo <= 0.001) return;
      const usd = c.moneda_original === 'bs' ? saldo / safeRate : saldo;
      totalUsd += usd;
      docs += 1;
    });
    (notasDebitoPend || []).forEach((n: any) => {
      if (n.status === 'ANULADO') return;
      const saldo = n.saldo_pendiente ?? n.total_usd ?? 0;
      if (saldo <= 0.001) return;
      totalUsd += saldo;
      docs += 1;
    });
    (consignacionesPend || []).forEach((c: any) => {
      const saldo = c.saldo_pendiente ?? c.monto_a_pagar ?? 0;
      if (saldo <= 0.001) return;
      totalUsd += saldo;
      docs += 1;
    });
    (gastosPend || []).forEach((g: any) => {
      const saldo = g.saldo_pendiente ?? g.total_usd ?? 0;
      if (saldo <= 0.001) return;
      totalUsd += saldo;
      docs += 1;
    });
    (vehiculosPend || []).forEach((v: any) => {
      const saldo = v.saldo_pendiente ?? v.costo_compra ?? 0;
      if (saldo <= 0.001) return;
      totalUsd += saldo;
      docs += 1;
    });

    return { totalUsd, docs };
  }, [comprasPend, notasDebitoPend, consignacionesPend, gastosPend, vehiculosPend, concesionario]);

  const isLoading = cajaLoading || ventasLoading || piLoading || prodLoading || cxpLoading;

  const handleRefresh = () => router.refresh();

  return (
    <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
      {/* Blob decorativo §14 */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header §3 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Visión General</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Hola, <span className="text-foreground font-bold">{staff?.nombre}</span> — el estado actual de{' '}
            <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl h-12 w-12 border-primary/20 hover:bg-primary/5"
            onClick={handleRefresh}
            aria-label="Refrescar"
          >
            <RefreshCw className="h-5 w-5 text-primary" />
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl h-12 px-6 border-primary/20 hover:bg-primary/5 gap-2 font-bold flex-1 md:flex-none"
            onClick={() => router.push(`/business/${slug}/calendar`)}
          >
            <Calendar className="h-5 w-5 text-primary" /> Calendario
          </Button>
          {!isReadOnly && (
            <Button
              className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold flex-1 md:flex-none"
              onClick={() => router.push(`/business/${slug}/sales`)}
            >
              <Plus className="h-5 w-5" /> Nueva venta
            </Button>
          )}
        </div>
      </div>

      {/* KPIs §5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
        {isLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Caja del día"
              value={formatCurrency(cajaBalance.balance, 'USD')}
              description={`${cajaBalance.count} movimiento${cajaBalance.count === 1 ? '' : 's'} hoy`}
              icon={Wallet}
              variant="primary"
              trend="En vivo"
            />
            <KpiCard
              title="Ventas hoy"
              value={`${ventasStats.count}`}
              description={
                ventasStats.hasYesterday
                  ? `${formatCurrency(ventasStats.total, 'USD')} · ${ventasStats.diff >= 0 ? '+' : ''}${formatCurrency(
                      ventasStats.diff,
                      'USD'
                    )} vs ayer`
                  : `${formatCurrency(ventasStats.total, 'USD')} facturado`
              }
              icon={ShoppingCart}
              variant="success"
            />
            <KpiCard
              title="Por cobrar"
              value={formatCurrency(cxcStats.totalSaldoCxc, 'USD')}
              description={
                cxcStats.docs === 0 && preInvoicesStats.count === 0
                  ? 'Sin cuentas activas'
                  : `${cxcStats.docs} CXC · ${cxcStats.vencidasCount} vencida${cxcStats.vencidasCount === 1 ? '' : 's'}${preInvoicesStats.count > 0 ? ` · ${preInvoicesStats.count} prefactura(s)` : ''}`
              }
              icon={Receipt}
              variant={cxcStats.vencidasCount > 0 ? 'danger' : cxcStats.totalSaldoCxc > 0 ? 'warning' : 'success'}
            />
            <KpiCard
              title="Alertas activas"
              value={`${alertasStats.count}`}
              description={
                alertasStats.count === 0
                  ? 'Todo en orden'
                  : `${alertasStats.stockBajo} stock bajo · ${alertasStats.cxpUrgentes} CxP urgente${
                      alertasStats.cxpUrgentes === 1 ? '' : 's'
                    }`
              }
              icon={AlertCircle}
              variant={alertasStats.count > 0 ? 'danger' : 'success'}
            />
            <KpiCard
              title="Deuda CxP"
              value={formatCurrency(cxpStats.totalUsd, 'USD')}
              description={
                cxpStats.docs === 0
                  ? 'Sin pasivos pendientes'
                  : `${cxpStats.docs} documento${cxpStats.docs === 1 ? '' : 's'} por pagar`
              }
              icon={FileWarning}
              variant={cxpStats.totalUsd > 0 ? 'warning' : 'success'}
            />
          </>
        )}
      </div>

      {/* Action Center + Pulse Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        <ActionCenter />
        <PulseChart />
      </div>

      {/* Shortcuts */}
      <div className="relative z-10">
        <Shortcuts />
      </div>
    </div>
  );
}
