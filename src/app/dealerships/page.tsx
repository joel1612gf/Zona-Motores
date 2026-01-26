
'use client';
import { useVehicles } from '@/context/vehicle-context';
import { Vehicle } from '@/lib/types';
import { DealershipCard } from '@/components/dealership-card';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

export default function DealershipsPage() {
  const { vehicles, isLoading } = useVehicles();

  const dealerships = React.useMemo(() => {
    if (!vehicles) return [];

    const dealers: { [key: string]: { seller: Vehicle['seller'], vehicles: Vehicle[] } } = {};

    vehicles.forEach(vehicle => {
      if (vehicle.seller.accountType === 'dealer') {
        if (!dealers[vehicle.sellerId]) {
          dealers[vehicle.sellerId] = {
            seller: vehicle.seller,
            vehicles: []
          };
        }
        dealers[vehicle.sellerId].vehicles.push(vehicle);
      }
    });

    return Object.values(dealers);
  }, [vehicles]);


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
