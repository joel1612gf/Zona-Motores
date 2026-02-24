'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { useFavorites } from '@/context/favorites-context';
import { useVehicles, VehicleProvider } from '@/context/vehicle-context';
import { VehicleCard } from '@/components/vehicle-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart } from 'lucide-react';

function MyFavoritesPageContent() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  const { favoriteIds, isFavoritesLoading } = useFavorites();
  const { vehicles: allVehicles, isLoading: areVehiclesLoading } = useVehicles();

  const favoriteVehicles = useMemo(() => {
    if (!favoriteIds || !allVehicles) return [];
    const favoriteSet = new Set(favoriteIds);
    return allVehicles.filter(vehicle => favoriteSet.has(vehicle.id));
  }, [favoriteIds, allVehicles]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/');
    }
  }, [isAuthLoading, user, router]);

  const isLoading = isAuthLoading || isFavoritesLoading || areVehiclesLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container max-w-6xl mx-auto py-12">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="font-headline text-2xl sm:text-3xl font-bold">Mis Favoritos</h1>
        <Button asChild variant="outline">
          <Link href="/listings">
            Explorar vehículos
          </Link>
        </Button>
      </div>

      {favoriteVehicles.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favoriteVehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-card">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold font-headline">Aún no tienes favoritos</h2>
          <p className="text-muted-foreground mt-2 mb-6">Guarda los vehículos que te interesan para verlos aquí.</p>
          <Button asChild>
            <Link href="/listings">
              Buscar Vehículos
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function MyFavoritesPage() {
    return (
        <VehicleProvider>
            <MyFavoritesPageContent />
        </VehicleProvider>
    )
}

function LoadingSkeleton() {
    return (
        <div className="container max-w-6xl mx-auto py-12">
            <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-10 w-48" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                   <Skeleton key={i} className="h-[380px] w-full" />
                ))}
            </div>
        </div>
    );
}
