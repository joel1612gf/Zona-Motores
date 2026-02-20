'use client';

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { doc, setDoc, deleteDoc, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type FavoritesContextType = {
  favoriteIds: string[];
  isFavoritesLoading: boolean;
  addFavorite: (vehicleId: string) => void;
  removeFavorite: (vehicleId: string) => void;
  isFavorite: (vehicleId: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const favoritesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'favorites');
  }, [user, firestore]);

  const { data: favorites, isLoading: isFavoritesLoading } = useCollection<{ vehicleId: string }>(favoritesQuery);

  const favoriteIds = useMemo(() => favorites?.map(f => f.vehicleId) || [], [favorites]);

  const addFavorite = useCallback((vehicleId: string) => {
    if (!user || !firestore) {
        toast({
            title: "Debes iniciar sesión",
            description: "Para guardar un vehículo en favoritos, necesitas una cuenta.",
            variant: "destructive"
        });
      return;
    }
    const favRef = doc(firestore, 'users', user.uid, 'favorites', vehicleId);
    const favoriteData = { 
        vehicleId: vehicleId,
        createdAt: serverTimestamp() 
    };

    setDoc(favRef, favoriteData)
        .catch(error => {
            errorEmitter.emit(
                'permission-error',
                new FirestorePermissionError({
                    path: favRef.path,
                    operation: 'create',
                    requestResourceData: favoriteData,
                }, error)
            );
        });
  }, [user, firestore, toast]);

  const removeFavorite = useCallback((vehicleId: string) => {
    if (!user || !firestore) return;
    const favRef = doc(firestore, 'users', user.uid, 'favorites', vehicleId);
    
    deleteDoc(favRef)
        .catch(error => {
            errorEmitter.emit(
                'permission-error',
                new FirestorePermissionError({
                    path: favRef.path,
                    operation: 'delete',
                }, error)
            );
        });
  }, [user, firestore]);

  const isFavorite = useCallback((vehicleId: string) => {
      return favoriteIds.includes(vehicleId);
  }, [favoriteIds]);

  const value = useMemo(() => ({ favoriteIds, isFavoritesLoading, addFavorite, removeFavorite, isFavorite }), [favoriteIds, isFavoritesLoading, addFavorite, removeFavorite, isFavorite]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
