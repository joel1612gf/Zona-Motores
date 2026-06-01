'use client';

import { doc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import type { AdminRole, SuperAdmin } from '@/lib/admin-types';

export interface UseIsSuperAdminResult {
  /** True only if a super_admins doc exists for this email AND activo === true. */
  isSuperAdmin: boolean;
  role: AdminRole | null;
  isLoading: boolean;
}

/**
 * Standalone (context-free) check of whether a Firebase Auth user is an active
 * platform administrator. Reads `super_admins/{email}` (doc id = lowercased email),
 * so it works anywhere — including the public /listings pages that are NOT wrapped
 * by AdminAuthProvider.
 *
 * Replaces the legacy hardcoded `user.email === ADMIN_EMAIL` check.
 */
export function useIsSuperAdmin(user: User | null | undefined): UseIsSuperAdminResult {
  const firestore = useFirestore();

  const adminDocRef = useMemoFirebase(
    () => (user?.email ? doc(firestore, 'super_admins', user.email.toLowerCase()) : null),
    [firestore, user?.email],
  );

  const { data, isLoading } = useDoc<SuperAdmin>(adminDocRef);

  const isSuperAdmin = !!data && data.activo === true;

  return {
    isSuperAdmin,
    role: isSuperAdmin ? data!.role : null,
    isLoading: !!user?.email && isLoading,
  };
}
