'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';

export type MakesAndModels = {
  [make: string]: string[];
};

export type MakesByType = {
  [type: string]: MakesAndModels;
};

type MakesContextType = {
  makesByType: MakesByType | null;
  isLoading: boolean;
};

// Example data as a fallback if the Firestore document doesn't exist.
// This structure is now categorized by vehicle type.
const fallbackData: MakesByType = {
  Carro: {
    Toyota: ['Corolla', 'Yaris', 'Etios'],
    Mitsubishi: ['Lancer'],
    Fiat: ['Uno', 'Palio', 'Siena'],
    Ford: ['Fiesta', 'Focus'],
    Chevrolet: ['Aveo', 'Cruze', 'Spark'],
    Honda: ['Civic', 'Fit'],
    Hyundai: ['Elantra', 'Accent', 'Getz'],
  },
  Camioneta: {
    Toyota: ['Hilux', 'Fortuner', 'Land Cruiser', '4Runner', 'RAV4'],
    Mitsubishi: ['Montero', 'L200'],
    Jeep: ['Grand Cherokee', 'Wrangler', 'Cherokee'],
    Ford: ['Explorer', 'F-150', 'Bronco', 'Escape'],
    Chevrolet: ['Silverado', 'Tahoe', 'Trailblazer'],
  },
  Moto: {
    Kawasaki: ['Ninja 400', 'KLR 650', 'Versys'],
    Yamaha: ['R6', 'MT-03', 'XT660'],
    Honda: ['CBR600', 'Africa Twin'],
    Suzuki: ['V-Strom 650', 'DR-650'],
    KTM: ['Duke 200', '390 Adventure'],
    Benelli: ['TRK 502', 'Leoncino 500'],
  },
};

const MakesContext = createContext<MakesContextType | undefined>(undefined);

export function MakesProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();

  const makesDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'vehicle_meta', 'makes_and_models');
  }, [firestore]);

  const { data: fetchedData, isLoading, error } = useDoc<{ makesByType: MakesByType }>(makesDocRef);

  if (error) {
      console.error("Error fetching vehicle makes and models:", error);
  }

  const makesByType = useMemo(() => {
    if (isLoading) {
      return null;
    }
    if (fetchedData?.makesByType) {
      return fetchedData.makesByType;
    }
    return fallbackData;

  }, [fetchedData, isLoading]);


  const value = useMemo(() => ({ makesByType, isLoading }), [makesByType, isLoading]);

  return (
    <MakesContext.Provider value={value}>
      {children}
    </MakesContext.Provider>
  );
}

export function useMakes() {
  const context = useContext(MakesContext);
  if (context === undefined) {
    throw new Error('useMakes must be used within a MakesProvider');
  }
  return context;
}
