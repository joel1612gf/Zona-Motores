'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';

export type MakesAndModels = {
  [make: string]: string[];
};

type MakesContextType = {
  makesAndModels: MakesAndModels | null;
  isLoading: boolean;
};

// Example data as a fallback if the Firestore document doesn't exist.
// This is what the user requested to see.
const fallbackData: MakesAndModels = {
  "Toyota": ["Corolla", "Hilux"],
  "Mitsubishi": ["Lancer", "Montero"]
};

const MakesContext = createContext<MakesContextType | undefined>(undefined);

export function MakesProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();

  const makesDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    // The document ID is fixed to 'makes_and_models'
    return doc(firestore, 'vehicle_meta', 'makes_and_models');
  }, [firestore]);

  const { data: fetchedData, isLoading, error } = useDoc<{ makes: MakesAndModels }>(makesDocRef);

  if (error) {
      console.error("Error fetching vehicle makes and models:", error);
  }

  const makesAndModels = useMemo(() => {
    if (isLoading) {
      return null; // Let the UI know we are loading
    }
    // If we are done loading and have data, use it.
    if (fetchedData?.makes) {
      return fetchedData.makes;
    }
    // If we are done loading and have NO data (or an error), use the fallback.
    // This makes the app usable immediately.
    return fallbackData;

  }, [fetchedData, isLoading]);


  const value = useMemo(() => ({ makesAndModels, isLoading }), [makesAndModels, isLoading]);

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
