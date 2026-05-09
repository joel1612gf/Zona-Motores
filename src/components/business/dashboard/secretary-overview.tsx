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
  Users,
  UserPlus,
  FileText,
  Globe,
  Plus,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { startOfWeek, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Cliente } from '@/lib/business-types';

export function SecretaryOverview() {
  const router = useRouter();
  const { slug } = useParams();
  const { concesionario, staff } = useBusinessAuth();
  const firestore = useFirestore();

  const weekStart = useMemo(
    () => Timestamp.fromDate(startOfWeek(new Date(), { weekStartsOn: 1 })),
    []
  );

  // Clientes nuevos esta semana
  const clientesNuevosQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'clientes'),
      where('created_at', '>=', weekStart)
    );
  }, [concesionario?.id, firestore, weekStart]);

  // Traspasos pendientes
  const traspasosQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'clientes'),
      where('traspaso_pendiente', '==', true)
    );
  }, [concesionario?.id, firestore]);

  // Leads de consignación activos
  const leadsQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'consignaciones_leads'),
      where('estado', 'in', ['contacto_inicial', 'cita_agendada'])
    );
  }, [concesionario?.id, firestore]);

  const { data: clientesNuevos, isLoading: cnLoading } = useCollection<Cliente>(clientesNuevosQuery);
  const { data: traspasos, isLoading: trLoading } = useCollection<Cliente>(traspasosQuery);
  const { data: leads, isLoading: leadsLoading } = useCollection<any>(leadsQuery);

  const isLoading = cnLoading || trLoading || leadsLoading;

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
            Hola, <span className="text-foreground font-bold">{staff?.nombre}</span> — gestión administrativa de{' '}
            <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            className="rounded-2xl h-12 px-6 border-primary/20 hover:bg-primary/5 gap-2 font-bold flex-1 md:flex-none"
            onClick={() => router.push(`/business/${slug}/calendar`)}
          >
            <CalendarDays className="h-5 w-5 text-primary" /> Calendario
          </Button>
          <Button
            className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold flex-1 md:flex-none"
            onClick={() => router.push(`/business/${slug}/clients`)}
          >
            <Plus className="h-5 w-5" /> Nuevo cliente
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
              title="Clientes nuevos"
              value={`${clientesNuevos?.length || 0}`}
              description="Esta semana"
              icon={UserPlus}
              variant="primary"
              trend="En vivo"
            />
            <KpiCard
              title="Traspasos pendientes"
              value={`${traspasos?.length || 0}`}
              description={
                traspasos?.length === 0
                  ? 'Todo en regla'
                  : 'Documentos por procesar'
              }
              icon={FileText}
              variant={traspasos && traspasos.length > 0 ? 'warning' : 'success'}
            />
            <KpiCard
              title="Leads activos"
              value={`${leads?.length || 0}`}
              description="Consignaciones a contactar"
              icon={Users}
              variant="success"
            />
            <KpiCard
              title="Total clientes"
              value={`${clientesNuevos?.length || 0}+`}
              description="Cartera de la semana"
              icon={Users}
              variant="success"
            />
          </>
        )}
      </div>

      {/* Lista de traspasos pendientes */}
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[2rem] relative z-10">
        <CardHeader className="bg-muted/30 border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-headline tracking-tight">Traspasos pendientes</CardTitle>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                Clientes con documentación incompleta
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
          ) : !traspasos || traspasos.length === 0 ? (
            <div className="py-16 px-6">
              <div className="border-dashed border-2 border-muted-foreground/20 rounded-[2rem] py-12 flex flex-col items-center text-center gap-3">
                <div className="p-4 bg-emerald-500/10 rounded-full">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <p className="text-lg font-bold font-headline">Sin traspasos pendientes</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Toda la documentación de los clientes está al día.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {traspasos.slice(0, 6).map((cliente) => {
                const limite = cliente.traspaso_fecha_limite?.toDate?.();
                const daysLeft = limite ? differenceInDays(limite, new Date()) : null;
                const isOverdue = daysLeft !== null && daysLeft < 0;
                const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;
                return (
                  <Link
                    key={cliente.id}
                    href={`/business/${slug}/clients`}
                    className="flex items-center gap-4 p-4 px-6 hover:bg-muted/30 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">
                        {cliente.nombre} {cliente.apellido}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cliente.cedula_rif}
                        {limite && (
                          <span
                            className={
                              isOverdue
                                ? ' · text-red-600 font-bold'
                                : isUrgent
                                ? ' · text-amber-600 font-bold'
                                : ''
                            }
                          >
                            {' '}
                            ·{' '}
                            {isOverdue
                              ? `Vencido hace ${Math.abs(daysLeft!)}d`
                              : `${daysLeft}d restantes`}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </Link>
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
            { href: `/business/${slug}/clients`, label: 'Nuevo cliente', description: 'Registrar persona', icon: UserPlus },
            { href: `/business/${slug}/calendar`, label: 'Calendario', description: 'Citas y eventos', icon: CalendarDays },
            { href: `/business/${slug}/web-sync`, label: 'Web pública', description: 'Publicaciones', icon: Globe },
            { href: `/business/${slug}/clients`, label: 'Clientes', description: 'Cartera completa', icon: Users },
          ]}
        />
      </div>
    </div>
  );
}
