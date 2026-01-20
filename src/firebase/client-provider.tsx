'use client';

import { ReactNode } from 'react';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { app } from './config';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const initializeFirebase = () => {
    const firebaseApp = app;
    const auth = getAuth(firebaseApp);
    const firestore = getFirestore(firebaseApp);
  
    return { firebaseApp, auth, firestore };
};

// Initialize Firebase on the client
const { firebaseApp, auth, firestore } = initializeFirebase();

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
      {children}
      <FirebaseErrorListener />
    </FirebaseProvider>
  );
}
