'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { Vehicle } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collectionGroup, query } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';

type VehicleContextType = {
  vehicles: Vehicle[];
  isLoading: boolean;
};

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export function VehicleProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();

  const vehiclesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // TEMPORARY: Querying the whole collection group without filters/ordering
    // while the composite index is building in Firebase.
    // This avoids the "index is building" error.
    return query(
      collectionGroup(firestore, 'vehicleListings')
    );
  }, [firestore]);

  const { data, isLoading, error } = useCollection<Vehicle>(vehiclesQuery);
  
  if (error) {
      // The permission error will be thrown by the hook, this is for console logging.
      console.error("Error fetching vehicles via collectionGroup:", error);
  }

  // Client-side filtering and sorting as a temporary measure.
  // This will be reverted once the Firebase index is confirmed to be ready.
  const vehicles = useMemo(() => {
    if (!data) return [];
    return data
      .filter(v => v.status === 'active') // Show only active listings
      .sort((a, b) => { // Sort by creation date, descending
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      })
      .map(v => ({...v, id: v.id}));
  }, [data]);

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
    throw new Error('useVehicles must be used within a VehicleProvider');
  }
  return context;
}
