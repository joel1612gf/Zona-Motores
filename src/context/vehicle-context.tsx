'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { Vehicle } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collectionGroup, query } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { vehicles as initialVehicles } from '@/lib/data';

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

  const { data: firestoreVehicles, isLoading, error } = useCollection<Vehicle>(vehiclesQuery);
  
  if (error) {
      // The permission error will be thrown by the hook, this is for console logging.
      console.error("Error fetching vehicles via collectionGroup:", error);
  }

  // Combine initial data with Firestore data for demonstration purposes
  const vehicles = useMemo(() => {
    const vehicleMap = new Map<string, Vehicle>();

    // Add initial mock data for demonstration
    initialVehicles.forEach(mockVehicle => {
      vehicleMap.set(mockVehicle.id, mockVehicle);
    });

    // Overwrite with live data from Firestore if it exists
    if (firestoreVehicles) {
      firestoreVehicles.forEach(firestoreVehicle => {
        vehicleMap.set(firestoreVehicle.id, firestoreVehicle);
      });
    }
    
    const combinedVehicles = Array.from(vehicleMap.values());

    return combinedVehicles
      .filter(v => (v.status || 'active') === 'active') // Handle initial data not having status
      .sort((a, b) => { // Sort by creation date, descending
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [firestoreVehicles]);


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
