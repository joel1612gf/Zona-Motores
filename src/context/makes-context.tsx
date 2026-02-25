'use client';

import { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
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

const MakesContext = createContext<MakesContextType | undefined>(undefined);

export function MakesProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const [localFallback, setLocalFallback] = useState<MakesByType | null>(null);

  const makesDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'vehicle_meta', 'makes_and_models');
  }, [firestore]);

  const { data: fetchedData, isLoading, error } = useDoc<{ makesByType: MakesByType }>(makesDocRef);

  if (error) {
    console.error("Error fetching vehicle makes and models:", error);
  }

  // Lazy-load fallback data only when fetch fails or returns empty
  useEffect(() => {
    if (!isLoading && !fetchedData?.makesByType && !localFallback) {
      import('@/lib/makes-fallback-data').then(mod => {
        setLocalFallback(mod.fallbackData);
      });
    }
  }, [isLoading, fetchedData, localFallback]);

  const makesByType = useMemo(() => {
    if (isLoading) {
      return null;
    }
    if (fetchedData?.makesByType) {
      return fetchedData.makesByType;
    }
    return localFallback;

  }, [fetchedData, isLoading, localFallback]);


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
