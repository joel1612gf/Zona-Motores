'use client';

import type { Timestamp } from 'firebase/firestore';

// ==================== SUPER ADMIN (GOD-MODE) ====================

export type AdminRole = 'owner' | 'moderator';

/**
 * Global platform administrator. Stored in the `super_admins` collection.
 * Document ID is the lowercased email for deterministic lookups in security
 * rules (exists()/get()) and in the client hook (no query needed).
 */
export type SuperAdmin = {
  email: string;
  role: AdminRole;
  activo: boolean;
  created_at: Timestamp;
};

/**
 * Resolution state of the current Firebase Auth user against `super_admins`.
 * - loading:         still resolving auth + the admin doc.
 * - unauthenticated: no Firebase Auth user.
 * - unauthorized:    signed in, but no active super_admin doc.
 * - authorized:      signed in with an active super_admin doc.
 */
export type AdminAuthStatus = 'loading' | 'unauthenticated' | 'unauthorized' | 'authorized';

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'Propietario',
  moderator: 'Moderador',
};
