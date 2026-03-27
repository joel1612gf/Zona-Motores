'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, collectionGroup, where } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, PhoneForwarded, Car, LineChart } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { useSubscription } from '@/context/subscription-context';
import { Crown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function StatsPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { limits, planName } = useSubscription();

  const profileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profileData } = useDoc(profileRef);
  const isDealer = (profileData as any)?.accountType === 'dealer';
  const businessId = (profileData as any)?.businessId;

  const myListingsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;

    if (profileData && isDealer && businessId) {
      return query(
        collectionGroup(firestore, 'vehicleListings'),
        where('seller.businessId', '==', businessId),
        orderBy('createdAt', 'desc')
      );
    }

    return query(
      collection(firestore, 'users', user.uid, 'vehicleListings'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore, profileData, isDealer, businessId]);

  const { data: listings, isLoading: areListingsLoading } = useCollection<Vehicle>(myListingsQuery);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/');
    }
  }, [isAuthLoading, user, router]);

  const stats = useMemo(() => {
    if (!listings) return { totalListings: 0, totalViews: 0, totalContacts: 0, averagePrice: 0 };

    const activeListings = listings.filter(l => l.status === 'active');
    const totalViews = activeListings.reduce((sum, l) => sum + (l.viewCount || 0), 0);
    const totalContacts = activeListings.reduce((sum, l) => sum + (l.contactRequests || 0), 0);
    const totalValue = activeListings.reduce((sum, l) => sum + l.priceUSD, 0);
    const averagePrice = activeListings.length > 0 ? totalValue / activeListings.length : 0;

    return {
      totalListings: activeListings.length,
      totalViews,
      totalContacts,
      averagePrice
    };
  }, [listings]);

  const topListingsByViews = useMemo(() => {
    if (!listings) return [];
    return [...listings]
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 5);
  }, [listings]);

  const chartData = useMemo(() => {
    if (!listings) return [];
    return listings
      .filter(l => (l.viewCount || 0) > 0)
      .map(l => ({
        name: `${l.year} ${l.model}`,
        views: l.viewCount || 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [listings]);

  const isLoading = isAuthLoading || areListingsLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  if (!limits.hasStats) {
    return (
      <div className="container max-w-3xl mx-auto py-12">
        <Card className="p-8 text-center">
          <Crown className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h1 className="font-headline text-3xl font-bold">Estadísticas no disponibles</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Tu plan <strong>{planName}</strong> no incluye acceso a estadísticas.
          </p>
          <p className="mt-2 text-muted-foreground">
            Mejora tu plan para ver visualizaciones, contactos y el rendimiento de tus anuncios.
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link href="/pricing">Ver Planes Disponibles</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="container max-w-6xl mx-auto py-12">
        <h1 className="font-headline text-2xl sm:text-3xl font-bold mb-8">Mis Estadísticas</h1>
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-card">
          <BarChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold font-headline">Aún no tienes datos</h2>
          <p className="text-muted-foreground mt-2 mb-6">
            {isDealer ? 'Las estadísticas de tus vehículos aparecerán aquí una vez que reciban visualizaciones o contactos.' : 'Publica un vehículo para empezar a ver tus estadísticas.'}
          </p>
          {!isDealer && (
            <Button asChild>
              <Link href="/listings/new">
                Publicar un Vehículo
              </Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto py-12">
      <h1 className="font-headline text-2xl sm:text-3xl font-bold mb-8">Mis Estadísticas</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anuncios Activos</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalListings}</div>
            <p className="text-xs text-muted-foreground">de un total de {listings.length} publicaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizaciones Totales</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">en tus anuncios activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitudes de Contacto</CardTitle>
            <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Clics en "ver teléfono"</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Promedio Activo</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.averagePrice)}</div>
            <p className="text-xs text-muted-foreground">Precio promedio de tus vehículos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Visualizaciones por Vehículo</CardTitle>
            <CardDescription>Top 10 de tus vehículos más vistos.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No hay suficientes datos de visualización para mostrar el gráfico.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tus Anuncios Más Populares</CardTitle>
            <CardDescription>
              Los 5 anuncios con más visualizaciones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead className="text-right">Vistas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topListingsByViews.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <div className="font-medium">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</div>
                      <div className="text-sm text-muted-foreground">{formatCurrency(vehicle.priceUSD)}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{(vehicle.viewCount || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function LoadingSkeleton() {
  return (
    <div className="container max-w-6xl mx-auto py-12">
      <Skeleton className="h-9 w-64 mb-8" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-8 lg:grid-cols-5">
        <Skeleton className="lg:col-span-3 h-[420px]" />
        <Skeleton className="lg:col-span-2 h-[420px]" />
      </div>
    </div>
  );
}
