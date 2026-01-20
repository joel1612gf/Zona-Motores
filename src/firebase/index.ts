import { app } from './config';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { FirebaseProvider, useAuth, useFirebase, useFirebaseApp, useFirestore } from './provider';
import { FirebaseClientProvider } from './client-provider';

import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';

import { useUser } from './auth/use-user';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

const initializeFirebase = () => {
  const firebaseApp = app;
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  return { firebaseApp, auth, firestore };
};

export { initializeFirebase, FirebaseProvider, FirebaseClientProvider, FirebaseErrorListener };

export { useCollection, useDoc, useUser };

export { useFirebase, useFirebaseApp, useFirestore, useAuth };
