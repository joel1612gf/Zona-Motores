'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { Vehicle } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collectionGroup, query, orderBy, where } from 'firebase/firestore';
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
    // Use a collectionGroup query to fetch all vehicle listings from all users.
    // This now filters for active listings and uses the composite index created
    // in the Firebase console to sort by creation date.
    return query(
      collectionGroup(firestore, 'vehicleListings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data, isLoading, error } = useCollection<Vehicle>(vehiclesQuery);
  
  if (error) {
      // The permission error will be thrown by the hook, this is for console logging.
      console.error("Error fetching vehicles via collectionGroup:", error);
  }

  const vehicles = useMemo(() => (data || []).map(v => ({...v, id: v.id})), [data]);

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
