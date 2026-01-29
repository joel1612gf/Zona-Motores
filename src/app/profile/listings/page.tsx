'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useUser, useMemoFirebase, useCollection, useStorage } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import type { Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MyListingCard } from '@/components/my-listing-card';
import { PlusCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function MyListingsPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

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
  
  useEffect(() => {
    if (!listings || !user || !firestore || !storage) return;

    const now = new Date();
    const processListings = async () => {
        let pausedCount = 0;
        let deletedCount = 0;
        let demotedCount = 0;
        
        const PAUSE_THRESHOLD_DAYS = 7;
        const DELETE_THRESHOLD_DAYS = 14;

        const maintenancePromises = listings.map(async (listing) => {
            const vehicleRef = doc(firestore, 'users', user.uid, 'vehicleListings', listing.id);

            // Check for expired promotions
            if (listing.promotionExpiresAt && listing.promotionExpiresAt.toDate() < now) {
                demotedCount++;
                return updateDoc(vehicleRef, { promotionExpiresAt: null });
            }

            if (!listing.createdAt) return; // Skip if no createdAt
            const createdAtDate = listing.createdAt.toDate();
            const daysSinceCreation = (now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24);

            // Auto-pause active listings older than PAUSE_THRESHOLD_DAYS
            if (listing.status === 'active' && daysSinceCreation > PAUSE_THRESHOLD_DAYS) {
                pausedCount++;
                return updateDoc(vehicleRef, { status: 'paused' });
            } 
            // Auto-delete paused listings older than DELETE_THRESHOLD_DAYS
            else if (listing.status === 'paused' && daysSinceCreation > DELETE_THRESHOLD_DAYS) {
                deletedCount++;
                try {
                    const imageDeletePromises = listing.images.map(image => {
                        const imageRef = ref(storage, image.url);
                        return deleteObject(imageRef);
                    });
                    await Promise.all(imageDeletePromises);
                } catch (imageError) {
                    console.error(`Failed to delete images for ${listing.id}`, imageError);
                }
                return deleteDoc(vehicleRef);
            }
        });

        await Promise.all(maintenancePromises.filter(Boolean));

        if (demotedCount > 0) {
             toast({
                title: "Mantenimiento Automático",
                description: `${demotedCount} promoción(es) han expirado y vuelto a ser anuncios normales.`,
            });
        }
        if (pausedCount > 0) {
            toast({
                title: "Mantenimiento Automático",
                description: `${pausedCount} publicación(es) fueron pausadas por inactividad.`,
            });
        }
        if (deletedCount > 0) {
            toast({
                title: "Mantenimiento Automático",
                description: `${deletedCount} publicación(es) pausadas fueron eliminadas por inactividad prolongada.`,
            });
        }
    };

    processListings().catch(err => {
        console.error("Error during automatic listing maintenance:", err);
        toast({
            variant: 'destructive',
            title: "Error de Mantenimiento",
            description: "Ocurrió un error al actualizar el estado de tus publicaciones.",
        });
    });

  }, [listings, user, firestore, storage, toast]);


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
