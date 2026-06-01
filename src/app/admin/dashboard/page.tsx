'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, collectionGroup } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useAdminAuth } from '@/context/admin-auth-context';
import type { Concesionario } from '@/lib/business-types';
import type { Vehicle } from '@/lib/types';
import { computeAdminMetrics } from '@/lib/analytics-helpers';
import { formatCurrency } from '@/lib/utils';
import { KpiCard, KpiCardSkeleton } from '@/components/business/dashboard/kpi-card';
import { GrowthProjectionCard } from '@/components/admin/growth-projection-card';
import { Loader2, LayoutDashboard, Building2, DollarSign, Car, CheckCircle2 } from 'lucide-react';

const countFmt = (n: number) => Math.round(n).toLocaleString('es-VE');
const usdFmt = (n: number) => formatCurrency(n, 'USD');

function trendLabel(growth: number | null): string | undefined {
  if (growth == null) return undefined;
  const pct = (growth * 100).toFixed(0);
  return `${growth >= 0 ? '+' : ''}${pct}% último mes`;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isOwner } = useAdminAuth();
  const firestore = useFirestore();

  // Owner-only route (defense in depth).
  useEffect(() => {
    if (!isOwner) router.replace('/admin/marketplace');
  }, [isOwner, router]);

  const dealersQuery = useMemoFirebase(() => collection(firestore, 'concesionarios'), [firestore]);
  const { data: dealers, isLoading: dealersLoading } = useCollection<Concesionario>(dealersQuery);

  const listingsQuery = useMemoFirebase(() => collectionGroup(firestore, 'vehicleListings'), [firestore]);
  const { data: listings, isLoading: listingsLoading } = useCollection<Vehicle>(listingsQuery);

  const isLoading = dealersLoading || listingsLoading;

  const metrics = useMemo(
    () => computeAdminMetrics(dealers ?? [], (listings ?? []) as Array<{ createdAt?: Vehicle['createdAt'] }>),
    [dealers, listings],
  );

  const activeDealers = useMemo(() => (dealers ?? []).filter((d) => d.plan_activo === true).length, [dealers]);

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Visión General</h1>
        </div>
        <p className="text-muted-foreground font-medium">
          Centro de mando de Zona Motores — métricas actuales y proyecciones a 6 meses.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
              icon={Building2}
              title="Concesionarios SaaS"
              value={countFmt(metrics.totals.dealerships)}
              description="Total de clientes registrados"
              variant="primary"
              trend={trendLabel(metrics.growth.dealerships)}
            />
            <KpiCard
              icon={CheckCircle2}
              title="Planes Activos"
              value={countFmt(activeDealers)}
              description="Concesionarios con plan activo"
              variant="success"
            />
            <KpiCard
              icon={DollarSign}
              title="MRR Actual"
              value={usdFmt(metrics.totals.mrr)}
              description="Ingreso mensual recurrente"
              variant="gradient"
              trend={trendLabel(metrics.growth.mrr)}
            />
            <KpiCard
              icon={Car}
              title="Vehículos Marketplace"
              value={countFmt(metrics.totals.vehicles)}
              description="Publicaciones totales en la web"
              variant="success"
              trend={trendLabel(metrics.growth.vehicles)}
            />
          </>
        )}
      </div>

      {/* Predictive projections */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Proyección a 6 meses (modelo compuesto)
        </p>
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GrowthProjectionCard
              title="Concesionarios"
              icon={Building2}
              projection={metrics.projection.dealerships}
              growth={metrics.growth.dealerships}
              format={countFmt}
            />
            <GrowthProjectionCard
              title="MRR"
              icon={DollarSign}
              projection={metrics.projection.mrr}
              growth={metrics.growth.mrr}
              format={usdFmt}
            />
            <GrowthProjectionCard
              title="Vehículos"
              icon={Car}
              projection={metrics.projection.vehicles}
              growth={metrics.growth.vehicles}
              format={countFmt}
            />
          </div>
        )}
      </div>
    </div>
  );
}
