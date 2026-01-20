'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { vehicles as allVehicles } from '@/lib/data';
import { VehicleCard } from '@/components/vehicle-card';
import { Filters, type FilterState } from '@/components/filters';
import { Button } from '@/components/ui/button';
import { Grid, List } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function ListingsPageContent() {
  const searchParams = useSearchParams();
  const initialSearchTerm = searchParams.get('search') || '';

  const [filters, setFilters] = useState<FilterState>({
    searchTerm: initialSearchTerm,
    make: 'all',
    minPrice: 0,
    maxPrice: 100000,
    location: null,
  });
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  
  const filteredVehicles = useMemo(() => {
    return allVehicles.filter(vehicle => {
      const { searchTerm, make, minPrice, maxPrice } = filters;
      
      const searchMatch = searchTerm.trim() === '' ||
        vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const makeMatch = make === 'all' || vehicle.make === make;
      
      const priceMatch = vehicle.priceUSD >= minPrice && (maxPrice >= 100000 ? true : vehicle.priceUSD <= maxPrice);

      // A real implementation would use the location filter to sort or filter by distance.
      // This is a placeholder for that functionality.

      return searchMatch && makeMatch && priceMatch;
    });
  }, [filters]);

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <Filters filters={filters} onFilterChange={setFilters} initialSearchTerm={initialSearchTerm}/>
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <h1 className="font-headline text-3xl font-bold">All Listings ({filteredVehicles.length})</h1>
            <div className="hidden sm:flex items-center gap-2">
              <Button variant={layout === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('grid')} aria-label="Grid view">
                <Grid className="h-4 w-4" />
              </Button>
              <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('list')} aria-label="List view">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {filteredVehicles.length > 0 ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col'}`}>
              {filteredVehicles.map(vehicle => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-lg bg-card">
              <h2 className="text-2xl font-semibold font-headline">No vehicles found</h2>
              <p className="text-muted-foreground mt-2">Try adjusting your search filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1">
          <div className="sticky top-20">
             <Skeleton className="h-[700px] w-full" />
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-48" />
            <div className="hidden sm:flex items-center gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
           <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
             {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
           </div>
        </div>
      </div>
    </div>
  )
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ListingsPageContent />
    </Suspense>
  )
}
