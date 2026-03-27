
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
import { Concesionario } from '@/lib/business-types';
import { Building2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';


function DealershipsPageContent() {
  const { vehicles, isLoading: areVehiclesLoading } = useVehicles();
  const firestore = useFirestore();

  const dealersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('accountType', '==', 'dealer'));
  }, [firestore]);

  const { data: dealerProfiles, isLoading: areDealersLoading } = useCollection<UserProfile>(dealersQuery);

  const concesionariosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'concesionarios'), where('plan_activo', '==', true));
  }, [firestore]);

  const { data: concesionarios, isLoading: areConcesionariosLoading } = useCollection<Concesionario>(concesionariosQuery);

  const dealerships = React.useMemo(() => {
    if (!dealerProfiles || !vehicles || (concesionarios === undefined)) return [];

    let allDealers: UserProfile[] = [...dealerProfiles];
    
    if (concesionarios) {
      concesionarios.forEach(c => {
         const isAlreadyThere = allDealers.find(d => d.uid === c.owner_uid);
         if (!isAlreadyThere) {
           allDealers.push({
             uid: c.owner_uid,
             displayName: c.nombre_empresa,
             isVerified: true,
             accountType: 'dealer',
             logoUrl: c.logo_url || '',
             heroUrl: c.banner_url || '',
             address: c.direccion,
             isSaaSBusiness: true,
             saasSlug: c.slug
           });
         } else {
           isAlreadyThere.isSaaSBusiness = true;
           isAlreadyThere.saasSlug = c.slug;
           if (c.logo_url) isAlreadyThere.logoUrl = c.logo_url;
           if (c.banner_url) isAlreadyThere.heroUrl = c.banner_url;
         }
      });
    }

    return allDealers.map(dealerProfile => {
      const dealerVehicles = vehicles.filter(v => v.sellerId === dealerProfile.uid);
      return {
        seller: dealerProfile,
        vehicles: dealerVehicles,
      };
    }).filter(d => d.vehicles.length > 0);
  }, [dealerProfiles, concesionarios, vehicles]);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredDealerships = React.useMemo(() => {
    if (!searchTerm.trim()) return dealerships;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return dealerships.filter(d => 
      (d.seller.displayName || '').toLowerCase().includes(lowerCaseSearch) ||
      (d.seller.address || '').toLowerCase().includes(lowerCaseSearch)
    );
  }, [dealerships, searchTerm]);

  const isLoading = areVehiclesLoading || areDealersLoading || areConcesionariosLoading;


  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen">
      {/* Mobile Hero Section */}
      <div className="md:hidden bg-gradient-to-b from-primary to-primary/80 text-primary-foreground py-10 px-4 text-center">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-80" />
        <h1 className="font-headline text-3xl font-bold mb-2">Concesionarios</h1>
        <p className="text-primary-foreground/80 text-sm max-w-xs mx-auto mb-6">
          Encuentra los mejores concesionarios y explora sus catálogos de vehículos
        </p>
        <div className="relative max-w-sm mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-70" />
          <Input 
            placeholder="Buscar concesionario..." 
            className="pl-9 bg-background text-foreground border-none h-11 rounded-full shadow-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="container mx-auto max-w-6xl py-6 md:py-12 px-4 md:px-6">
        <div className="hidden md:flex justify-between items-center mb-10">
          <h1 className="font-headline text-4xl font-bold">Concesionarios</h1>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Nombre o ubicación..." 
              className="pl-9 h-11 rounded-xl shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredDealerships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl bg-card">
            <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h2 className="font-headline text-2xl font-semibold">No se encontraron resultados</h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              {searchTerm 
                ? `No hay concesionarios que coincidan con "${searchTerm}"`
                : "Los concesionarios que publiquen vehículos aparecerán aquí."}
            </p>
            {searchTerm && (
              <Button 
                variant="outline" 
                className="mt-6 rounded-full"
                onClick={() => setSearchTerm('')}
              >
                Limpiar búsqueda
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8 md:space-y-12">
            {filteredDealerships.map(dealership => (
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
