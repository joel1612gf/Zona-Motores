'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MyListingCard } from '@/components/my-listing-card';
import { PlusCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function MyListingsPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const myListingsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'vehicleListings'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: listings, isLoading: areListingsLoading } = useCollection<Vehicle>(myListingsQuery);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/');
    }
  }, [isAuthLoading, user, router]);




  if (isAuthLoading || areListingsLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container max-w-6xl mx-auto py-12">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="font-headline text-2xl sm:text-3xl font-bold">Mis Publicaciones</h1>
        <Button asChild>
          <Link href="/listings/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Publicar Nuevo Vehículo
          </Link>
        </Button>
      </div>

      {listings && listings.length > 0 ? (
        <div className="space-y-6">
          {listings.map((vehicle) => (
            <MyListingCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-card">
          <h2 className="text-2xl font-semibold font-headline">Aún no tienes publicaciones</h2>
          <p className="text-muted-foreground mt-2 mb-6">¿Qué esperas para vender tu vehículo?</p>
          <Button asChild>
            <Link href="/listings/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear mi primera publicación
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}


function LoadingSkeleton() {
  return (
    <div className="container max-w-6xl mx-auto py-12">
      <div className="flex justify-between items-center mb-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex gap-6 border rounded-lg p-4">
      <Skeleton className="h-32 w-48 rounded-md" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  )
}
