'use client';

import { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render
    setIsClient(true);
  }, []);

  const vehiclesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // TEMPORARY: Querying the whole collection group without filters/ordering
    // while the composite index is building in Firebase.
    // This avoids the "index is building" error.
    return query(
      collectionGroup(firestore, 'vehicleListings')
    );
  }, [firestore]);

  const { data: firestoreVehicles, isLoading: isFirestoreLoading, error } = useCollection<Vehicle>(vehiclesQuery);
  
  if (error) {
      // The permission error will be thrown by the hook, this is for console logging.
      console.error("Error fetching vehicles via collectionGroup:", error);
  }

  const vehicles = useMemo(() => {
    let liveVehicles: Vehicle[] = [];
    if (isClient && firestoreVehicles) {
      liveVehicles = firestoreVehicles;
    }
    
    return liveVehicles
      .filter(v => (v.status || 'active') === 'active' && !v.seller.isBlocked)
      .sort((a, b) => { // Sort by creation date, descending
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
    throw new Error('useVehicles must be used within a VehicleProvider');
  }
  return context;
}
