'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { Vehicle } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
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
    return query(collection(firestore, 'vehicle_listings'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data, isLoading, error } = useCollection<Vehicle>(vehiclesQuery);
  
  if (error) {
      console.error("Error fetching vehicles:", error);
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
