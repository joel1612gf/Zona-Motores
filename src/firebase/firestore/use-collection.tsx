'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  onSnapshot,
  type Query,
  type DocumentData,
} from 'firebase/firestore';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useCollection<T>(query: Query<DocumentData> | null) {
  const [data, setData] = useState<(T & { id: string })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const queryKey = useMemo(() => {
      if (!query) return null;
      try {
          return JSON.stringify((query as any)._query);
      } catch (e) {
          return String(Date.now());
      }
  }, [query]);

  useEffect(() => {
    if (!query) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const result = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id } as T & { id: string })
        );
        setData(result);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const path = (query as any)?._query?.path?.canonicalId ?? 'unknown path';
        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return { data, loading, error };
}
