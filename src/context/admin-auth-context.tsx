'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { doc, type Firestore } from 'firebase/firestore';
import { signOut as firebaseSignOut, type User } from 'firebase/auth';
import { useAuth, useFirestore, useUser, useMemoFirebase, useDoc } from '@/firebase';
import type { AdminAuthStatus, AdminRole, SuperAdmin } from '@/lib/admin-types';

interface AdminAuthContextValue {
  status: AdminAuthStatus;
  user: User | null;
  /** The active super_admin record, or null if not authorized. */
  admin: SuperAdmin | null;
  role: AdminRole | null;
  isOwner: boolean;
  isModerator: boolean;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

/**
 * Resolves the current Firebase Auth user against the `super_admins` collection
 * and exposes role/status to the /admin subtree. It does NOT redirect — the
 * AdminLayout reads `status` and performs navigation.
 *
 * Mounted ONLY inside src/app/admin/layout.tsx so the rest of the site never
 * reads admin data.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const adminDocRef = useMemoFirebase(
    () => (user?.email ? doc(firestore as Firestore, 'super_admins', user.email.toLowerCase()) : null),
    [firestore, user?.email],
  );

  const { data, isLoading: isAdminLoading } = useDoc<SuperAdmin>(adminDocRef);

  const value = useMemo<AdminAuthContextValue>(() => {
    let status: AdminAuthStatus;
    if (isUserLoading || (user?.email && isAdminLoading)) {
      status = 'loading';
    } else if (!user) {
      status = 'unauthenticated';
    } else if (!data || data.activo !== true) {
      status = 'unauthorized';
    } else {
      status = 'authorized';
    }

    const admin = status === 'authorized' ? data ?? null : null;
    const role = admin?.role ?? null;

    return {
      status,
      user: user ?? null,
      admin,
      role,
      isOwner: role === 'owner',
      isModerator: role === 'moderator',
      signOut: () => firebaseSignOut(auth),
    };
  }, [auth, user, isUserLoading, data, isAdminLoading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (ctx === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider.');
  }
  return ctx;
}
