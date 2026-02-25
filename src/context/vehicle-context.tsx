'use client';

import { createContext, useContext, ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { Vehicle } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collectionGroup, query, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useFirestore, useMemoFirebase, useStorage } from '@/firebase';

type VehicleContextType = {
  vehicles: Vehicle[];
  isLoading: boolean;
};

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

const PAUSE_THRESHOLD_DAYS = 7;
const DELETE_THRESHOLD_DAYS = 14;

export function VehicleProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const storage = useStorage();
  const [isClient, setIsClient] = useState(false);
  const maintenanceRan = useRef(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render
    setIsClient(true);
  }, []);

  const vehiclesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collectionGroup(firestore, 'vehicleListings')
    );
  }, [firestore]);

  const { data: firestoreVehicles, isLoading: isFirestoreLoading, error } = useCollection<Vehicle>(vehiclesQuery);

  if (error) {
    console.error("Error fetching vehicles via collectionGroup:", error);
  }

  // Global automatic maintenance — runs once per session
  useEffect(() => {
    if (!firestoreVehicles || !firestore || !storage || maintenanceRan.current) return;
    maintenanceRan.current = true;

    const now = new Date();

    const runMaintenance = async () => {
      const promises: Promise<void>[] = [];

      for (const listing of firestoreVehicles) {
        if (!listing.createdAt || !listing.sellerId) continue;
        const vehicleRef = doc(firestore, 'users', listing.sellerId, 'vehicleListings', listing.id);
        const createdAtDate = listing.createdAt.toDate();
        const daysSinceCreation = (now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24);

        // Clear expired promotions
        if (listing.promotionExpiresAt && listing.promotionExpiresAt.toDate() < now && listing.promotionExpiresAt.toDate().getTime() !== 0) {
          promises.push(updateDoc(vehicleRef, { promotionExpiresAt: Timestamp.fromDate(new Date(0)) }));
          continue;
        }

        // Auto-delete paused listings older than DELETE_THRESHOLD_DAYS
        if (listing.status === 'paused' && daysSinceCreation > DELETE_THRESHOLD_DAYS) {
          promises.push(
            (async () => {
              try {
                const imageDeletePromises = listing.images.map(image => {
                  const imageRef = ref(storage, image.url);
                  return deleteObject(imageRef);
                });
                await Promise.all(imageDeletePromises);
              } catch (e) {
                console.error(`Failed to delete images for ${listing.id}`, e);
              }
              await deleteDoc(vehicleRef);
            })()
          );
          continue;
        }

        // Auto-pause active listings older than PAUSE_THRESHOLD_DAYS
        if (listing.status === 'active' && daysSinceCreation > PAUSE_THRESHOLD_DAYS) {
          promises.push(updateDoc(vehicleRef, { status: 'paused' }));
        }
      }

      if (promises.length > 0) {
        try {
          await Promise.all(promises);
          console.log(`[Maintenance] Processed ${promises.length} stale listing(s).`);
        } catch (e) {
          console.error('[Maintenance] Error processing listings:', e);
        }
      }
    };

    runMaintenance();
  }, [firestoreVehicles, firestore, storage]);

  const vehicles = useMemo(() => {
    let liveVehicles: Vehicle[] = [];
    if (isClient && firestoreVehicles) {
      liveVehicles = firestoreVehicles;
    }

    return liveVehicles
      .filter(v => (v.status || 'active') === 'active' && !v.seller.isBlocked)
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [firestoreVehicles, isClient]);

  const isLoading = isFirestoreLoading && isClient;

  const value = useMemo(() => ({ vehicles, isLoading }), [vehicles, isLoading]);

  return (
    <VehicleContext.Provider value={value}>
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicles() {
  const context = useContext(VehicleContext);
  if (context === undefined) {
    return { vehicles: [] as Vehicle[], isLoading: true };
  }
  return context;
}

