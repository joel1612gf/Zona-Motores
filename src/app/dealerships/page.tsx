
'use client';
import { useVehicles } from '@/context/vehicle-context';
import { Vehicle } from '@/lib/types';
import { DealershipCard } from '@/components/dealership-card';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { query, collection, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { UserProfile } from '@/lib/types';

export default function DealershipsPage() {
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
    <div className="container mx-auto max-w-6xl py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-headline text-4xl font-bold">Concesionarios</h1>
      </div>

      <div className="space-y-12">
        {dealerships.map(dealership => (
          <DealershipCard key={dealership.seller.uid} dealership={dealership} />
        ))}
      </div>
    </div>
  );
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
