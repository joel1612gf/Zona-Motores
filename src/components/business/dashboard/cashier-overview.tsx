'use client';

import { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard, KpiCardSkeleton } from './kpi-card';
import { Shortcuts } from './shortcuts';
import {
  LayoutDashboard,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  Plus,
  Lock,
  History,
} from 'lucide-react';
import { startOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import type { RegistroCaja, CierreCaja } from '@/lib/business-types';

export function CashierOverview() {
  const router = useRouter();
  const { slug } = useParams();
  const { concesionario, staff } = useBusinessAuth();
  const firestore = useFirestore();

  const todayStart = useMemo(() => Timestamp.fromDate(startOfDay(new Date())), []);

  // Movimientos de caja de hoy
  const cajaHoyQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'caja'),
      where('fecha', '>=', todayStart),
      orderBy('fecha', 'desc')
    );
  }, [concesionario?.id, firestore, todayStart]);

  // Último cierre de caja
  const ultimoCierreQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'cierres_caja'),
      orderBy('fecha', 'desc'),
      limit(1)
    );
  }, [concesionario?.id, firestore]);

  const { data: cajaHoy, isLoading: cajaLoading } = useCollection<RegistroCaja>(cajaHoyQuery);
  const { data: cierres, isLoading: cierreLoading } = useCollection<CierreCaja>(ultimoCierreQuery);

  const isLoading = cajaLoading || cierreLoading;

  const stats = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    cajaHoy?.forEach((c) => {
      if (c.tipo === 'ingreso') ingresos += c.monto || 0;
      else egresos += c.monto || 0;
    });
    return {
      balance: ingresos - egresos,
      ingresos,
      egresos,
      count: cajaHoy?.length || 0,
    };
  }, [cajaHoy]);

  const ultimoCierre = cierres?.[0];

  return (
    <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
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
            Hola, <span className="text-foreground font-bold">{staff?.nombre}</span> — tu turno en caja de{' '}
            <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            className="rounded-2xl h-12 px-6 border-primary/20 hover:bg-primary/5 gap-2 font-bold flex-1 md:flex-none"
            onClick={() => router.push(`/business/${slug}/cash-register`)}
          >
            <History className="h-5 w-5 text-primary" /> Historial
          </Button>
          <Button
            className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold flex-1 md:flex-none"
            onClick={() => router.push(`/business/${slug}/cash-register`)}
          >
            <Plus className="h-5 w-5" /> Registrar movimiento
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {isLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Caja del día"
              value={formatCurrency(stats.balance, 'USD')}
              description={`${stats.count} movimiento${stats.count === 1 ? '' : 's'} hoy`}
              icon={Wallet}
              variant="primary"
              trend="En vivo"
            />
            <KpiCard
              title="Ingresos hoy"
              value={formatCurrency(stats.ingresos, 'USD')}
              description="Cobranzas registradas"
              icon={ArrowDownCircle}
              variant="success"
            />
            <KpiCard
              title="Egresos hoy"
              value={formatCurrency(stats.egresos, 'USD')}
              description="Pagos y devoluciones"
              icon={ArrowUpCircle}
              variant={stats.egresos > 0 ? 'warning' : 'success'}
            />
            <KpiCard
              title="Último cierre"
              value={
                ultimoCierre?.fecha
                  ? format(ultimoCierre.fecha.toDate(), "d MMM", { locale: es })
                  : '—'
              }
              description={
                ultimoCierre
                  ? `${ultimoCierre.cajero_nombre} · Cierre #${ultimoCierre.numero_cierre}`
                  : 'Sin cierres registrados'
              }
              icon={ClipboardCheck}
              variant="success"
            />
          </>
        )}
      </div>

      {/* Tabla de últimos movimientos */}
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[2rem] relative z-10">
        <CardHeader className="bg-muted/30 border-b pb-5 flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-headline tracking-tight">Movimientos de hoy</CardTitle>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                Últimos registros del día
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 px-6 animate-pulse">
                  <div className="h-3 w-1/2 bg-muted/50 rounded mb-2" />
                  <div className="h-2 w-1/3 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
          ) : !cajaHoy || cajaHoy.length === 0 ? (
            <div className="py-16 px-6">
              <div className="border-dashed border-2 border-muted-foreground/20 rounded-[2rem] py-12 flex flex-col items-center text-center gap-3">
                <div className="p-4 bg-muted/50 rounded-full">
                  <Wallet className="h-10 w-10 text-muted-foreground opacity-60" />
                </div>
                <p className="text-lg font-bold font-headline">Caja sin movimientos</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Aún no se ha registrado ningún ingreso o egreso hoy.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {cajaHoy.slice(0, 10).map((mov) => {
                const isIngreso = mov.tipo === 'ingreso';
                return (
                  <div
                    key={mov.id}
                    className="flex items-center gap-4 p-4 px-6 hover:bg-muted/30 transition-all"
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0',
                        isIngreso
                          ? 'bg-emerald-500/5 border-emerald-500/10'
                          : 'bg-red-500/5 border-red-500/10'
                      )}
                    >
                      {isIngreso ? (
                        <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <ArrowUpCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{mov.descripcion}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                        {mov.metodo_pago} · {format(mov.fecha.toDate(), "HH:mm", { locale: es })}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'font-bold font-headline tabular-nums shrink-0',
                        isIngreso ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {isIngreso ? '+' : '-'}
                      {formatCurrency(mov.monto || 0, 'USD')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shortcuts */}
      <div className="relative z-10">
        <Shortcuts
          items={[
            { href: `/business/${slug}/cash-register`, label: 'Registrar movimiento', description: 'Ingreso o egreso', icon: Plus },
            { href: `/business/${slug}/cash-register`, label: 'Cerrar caja', description: 'Hacer arqueo', icon: Lock },
            { href: `/business/${slug}/cash-register`, label: 'Historial', description: 'Cierres anteriores', icon: History },
            { href: `/business/${slug}/sales`, label: 'Ventas', description: 'Cobros pendientes', icon: ClipboardCheck },
          ]}
        />
      </div>
    </div>
  );
}
