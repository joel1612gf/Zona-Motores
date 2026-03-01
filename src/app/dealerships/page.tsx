
'use client';
import { useVehicles, VehicleProvider } from '@/context/vehicle-context';
import { Vehicle } from '@/lib/types';
import { DealershipCard } from '@/components/dealership-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { query, collection, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { UserProfile } from '@/lib/types';
import { Building2 } from 'lucide-react';


function DealershipsPageContent() {
  const { vehicles, isLoading: areVehiclesLoading } = useVehicles();
  const firestore = useFirestore();

  const dealersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('accountType', '==', 'dealer'));
  }, [firestore]);

  const { data: dealerProfiles, isLoading: areDealersLoading } = useCollection<UserProfile>(dealersQuery);

  const dealerships = React.useMemo(() => {
    if (!dealerProfiles || !vehicles) return [];

    return dealerProfiles.map(dealerProfile => {
      const dealerVehicles = vehicles.filter(v => v.sellerId === dealerProfile.uid);
      return {
        seller: dealerProfile,
        vehicles: dealerVehicles,
      };
    }).filter(d => d.vehicles.length > 0);

  }, [dealerProfiles, vehicles]);

  const isLoading = areVehiclesLoading || areDealersLoading;


  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen">
      {/* Mobile Hero Section */}
      <div className="md:hidden bg-gradient-to-b from-primary to-primary/80 text-primary-foreground py-10 px-4 text-center">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-80" />
        <h1 className="font-headline text-3xl font-bold mb-2">Concesionarios</h1>
        <p className="text-primary-foreground/80 text-sm max-w-xs mx-auto">
          Encuentra los mejores concesionarios y explora sus catálogos de vehículos
        </p>
      </div>
      <div className="container mx-auto max-w-6xl py-6 md:py-12 px-4 md:px-6">
        <div className="hidden md:flex justify-between items-center mb-8">
          <h1 className="font-headline text-4xl font-bold">Concesionarios</h1>
        </div>

        {dealerships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-lg bg-card">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="font-headline text-2xl font-semibold">Aún no hay concesionarios activos</h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              Los concesionarios que publiquen vehículos aparecerán aquí.
            </p>
            <Button asChild className="mt-6">
              <Link href="/listings">Explorar Vehículos</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8 md:space-y-12">
            {dealerships.map(dealership => (
              <DealershipCard key={dealership.seller.uid} dealership={dealership} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DealershipsPage() {
  return (
    <VehicleProvider>
      <DealershipsPageContent />
    </VehicleProvider>
  )
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl py-12">
      <Skeleton className="h-10 w-72 mb-8" />
      <div className="space-y-12">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
