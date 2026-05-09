'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard, KpiCardSkeleton } from './kpi-card';
import { Shortcuts } from './shortcuts';
import {
  LayoutDashboard,
  Award,
  ShoppingCart,
  Receipt,
  Handshake,
  Plus,
  ChevronRight,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { startOfDay, startOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import type { Venta } from '@/lib/business-types';

export function SellerOverview() {
  const router = useRouter();
  const { slug } = useParams();
  const { concesionario, staff } = useBusinessAuth();
  const firestore = useFirestore();

  const todayStart = useMemo(() => Timestamp.fromDate(startOfDay(new Date())), []);
  const monthStart = useMemo(() => Timestamp.fromDate(startOfMonth(new Date())), []);

  // Ventas hoy del vendedor
  const ventasHoyQuery = useMemoFirebase(() => {
    if (!concesionario?.id || !staff?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      where('vendedor_staff_id', '==', staff.id),
      where('fecha', '>=', todayStart)
    );
  }, [concesionario?.id, staff?.id, firestore, todayStart]);

  // Ventas del mes (para calcular comisiones acumuladas)
  const ventasMesQuery = useMemoFirebase(() => {
    if (!concesionario?.id || !staff?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      where('vendedor_staff_id', '==', staff.id),
      where('fecha', '>=', monthStart)
    );
  }, [concesionario?.id, staff?.id, firestore, monthStart]);

  // Prefacturas activas creadas por el vendedor
  const preInvoicesQuery = useMemoFirebase(() => {
    if (!concesionario?.id || !staff?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'pre_invoices'),
      where('vendedor_id', '==', staff.id),
      where('estado', '==', 'pendiente')
    );
  }, [concesionario?.id, staff?.id, firestore]);

  // Leads de consignación asignados al vendedor (si existe el campo) — fallback: estados activos
  const leadsQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'consignaciones_leads'),
      where('estado', 'in', ['contacto_inicial', 'cita_agendada'])
    );
  }, [concesionario?.id, firestore]);

  const { data: ventasHoy, isLoading: vhLoading } = useCollection<Venta>(ventasHoyQuery);
  const { data: ventasMes, isLoading: vmLoading } = useCollection<Venta>(ventasMesQuery);
  const { data: preInvoices, isLoading: piLoading } = useCollection<any>(preInvoicesQuery);
  const { data: leads, isLoading: leadsLoading } = useCollection<any>(leadsQuery);

  const isLoading = vhLoading || vmLoading || piLoading || leadsLoading;

  const ventasHoyTotal = useMemo(
    () => (ventasHoy || []).reduce((s, v) => s + (v.precio_venta || 0), 0),
    [ventasHoy]
  );

  const comisionesMesTotal = useMemo(
    () => (ventasMes || []).reduce((s, v) => s + (v.comision_vendedor || 0), 0),
    [ventasMes]
  );

  const prefacturasTotal = useMemo(
    () =>
      (preInvoices || []).reduce(
        (s, pi: any) => s + (pi.precio_negociado ?? pi.total_usd ?? pi.precio_total ?? 0),
        0
      ),
    [preInvoices]
  );

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
            Hola, <span className="text-foreground font-bold">{staff?.nombre}</span> — tu día de ventas en{' '}
            <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            className="rounded-2xl h-12 px-6 border-primary/20 hover:bg-primary/5 gap-2 font-bold flex-1 md:flex-none"
            onClick={() => router.push(`/business/${slug}/calendar`)}
          >
            <Calendar className="h-5 w-5 text-primary" /> Calendario
          </Button>
          <Button
            className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold flex-1 md:flex-none"
            onClick={() => router.push(`/business/${slug}/sales`)}
          >
            <Plus className="h-5 w-5" /> Nueva prefactura
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
              title="Tus comisiones del mes"
              value={formatCurrency(comisionesMesTotal, 'USD')}
              description={`${ventasMes?.length || 0} venta${ventasMes?.length === 1 ? '' : 's'} cerradas`}
              icon={Award}
              variant="primary"
              trend="Acumulado"
            />
            <KpiCard
              title="Tus ventas hoy"
              value={`${ventasHoy?.length || 0}`}
              description={formatCurrency(ventasHoyTotal, 'USD')}
              icon={ShoppingCart}
              variant="success"
            />
            <KpiCard
              title="Prefacturas activas"
              value={`${preInvoices?.length || 0}`}
              description={
                preInvoices?.length === 0
                  ? 'Sin pendientes'
                  : `${formatCurrency(prefacturasTotal, 'USD')} en cola`
              }
              icon={Receipt}
              variant={preInvoices && preInvoices.length > 0 ? 'warning' : 'success'}
            />
            <KpiCard
              title="Leads activos"
              value={`${leads?.length || 0}`}
              description="Prospectos por atender"
              icon={Handshake}
              variant="success"
            />
          </>
        )}
      </div>

      {/* Lista de prefacturas activas del vendedor */}
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[2rem] relative z-10">
        <CardHeader className="bg-muted/30 border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-headline tracking-tight">Tus prefacturas pendientes</CardTitle>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                Esperando cobro en caja
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2].map((i) => (
                <div key={i} className="p-4 px-6 animate-pulse">
                  <div className="h-3 w-1/2 bg-muted/50 rounded mb-2" />
                  <div className="h-2 w-1/3 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
          ) : !preInvoices || preInvoices.length === 0 ? (
            <div className="py-16 px-6">
              <div className="border-dashed border-2 border-muted-foreground/20 rounded-[2rem] py-12 flex flex-col items-center text-center gap-3">
                <div className="p-4 bg-emerald-500/10 rounded-full">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <p className="text-lg font-bold font-headline">Sin prefacturas pendientes</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Crea una nueva prefactura cuando cierres una negociación.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {preInvoices.slice(0, 6).map((pi: any) => (
                <Link
                  key={pi.id}
                  href={`/business/${slug}/sales`}
                  className="flex items-center gap-4 p-4 px-6 hover:bg-muted/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                    <Receipt className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{pi.item_nombre || 'Prefactura'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(pi.precio_negociado ?? pi.total_usd ?? pi.precio_total ?? 0, 'USD')}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shortcuts */}
      <div className="relative z-10">
        <Shortcuts
          items={[
            { href: `/business/${slug}/sales`, label: 'Nueva prefactura', description: 'Cerrar una venta', icon: Receipt },
            { href: `/business/${slug}/commissions`, label: 'Mis comisiones', description: 'Ver mi historial', icon: Award },
            { href: `/business/${slug}/consignment`, label: 'Mis leads', description: 'Prospectos activos', icon: Handshake },
            { href: `/business/${slug}/clients`, label: 'Clientes', description: 'Cartera asignada', icon: ShoppingCart },
          ]}
        />
      </div>
    </div>
  );
}
