'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Concesionario, StaffMember, BusinessRole, BusinessModule, PermissionLevel } from '@/lib/business-types';
import { ROLE_PERMISSIONS, CAN_SEE_PURCHASE_COSTS, verifySHA256 } from '@/lib/business-types';

// ==================== TYPES ====================

interface BusinessSession {
  concesionarioId: string;
  slug: string;
  validado: boolean;
  timestamp: number;
}

interface StaffSession {
  staffId: string;
  rol: BusinessRole;
  nombre: string;
}

interface BusinessAuthContextValue {
  // State
  concesionario: Concesionario | null;
  staff: StaffMember | null;
  staffList: StaffMember[];
  isLoading: boolean;
  isAuthenticated: boolean; // Step 1 done (enterprise validated)
  isStaffLoggedIn: boolean; // Step 2 done (staff selected + PIN verified)

  // Permissions
  currentRole: BusinessRole | null;
  hasPermission: (module: BusinessModule) => PermissionLevel;
  canSeeCosts: boolean;

  // Actions
  validateEnterprise: (slug: string, masterKey: string) => Promise<boolean>;
  validateStaffPin: (staffId: string, pin: string) => Promise<boolean>;
  switchUser: () => void;
  logout: () => void;
  loadConcesionario: (slug: string) => Promise<boolean>;
}

const BusinessAuthContext = createContext<BusinessAuthContextValue | undefined>(undefined);

// ==================== STORAGE KEYS ====================

const BUSINESS_SESSION_KEY = 'zm_business_session';
const STAFF_SESSION_KEY = 'zm_staff_session';

// ==================== PROVIDER ====================

export function BusinessAuthProvider({ children, slug }: { children: ReactNode; slug: string }) {
  const firestore = useFirestore();

  const [concesionario, setConcesionario] = useState<Concesionario | null>(null);
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isStaffLoggedIn, setIsStaffLoggedIn] = useState(false);

  // Restore session from storage on mount
  useEffect(() => {
    const restoreSession = async () => {
      setIsLoading(true);
      try {
        // Check sessionStorage for enterprise session
        const savedSession = sessionStorage.getItem(BUSINESS_SESSION_KEY);
        if (savedSession) {
          let session: BusinessSession | null = null;
          try {
            session = JSON.parse(savedSession);
          } catch (e) {
            sessionStorage.removeItem(BUSINESS_SESSION_KEY);
          }
          
          if (session) {
            // Only restore if slug matches and session is less than 24h old
            const isValid = session.slug === slug && session.validado &&
              (Date.now() - session.timestamp < 24 * 60 * 60 * 1000);

            if (isValid) {
              const loaded = await loadConcesionarioData(session.concesionarioId);
              if (loaded) {
                setIsAuthenticated(true);
                const savedStaff = sessionStorage.getItem(STAFF_SESSION_KEY);
                if (savedStaff) {
                  try {
                    const staffSession: StaffSession = JSON.parse(savedStaff);
                    const staffDoc = await getDoc(
                      doc(firestore, 'concesionarios', session.concesionarioId, 'staff', staffSession.staffId)
                    );
                    if (staffDoc.exists() && (staffDoc.data() as StaffMember).activo) {
                      const staffData = { id: staffDoc.id, ...staffDoc.data() } as StaffMember;
                      setStaff(staffData);
                      setIsStaffLoggedIn(true);
                    }
                  } catch (e) {
                    sessionStorage.removeItem(STAFF_SESSION_KEY);
                  }
                }
              }
            } else {
              sessionStorage.removeItem(BUSINESS_SESSION_KEY);
            }
          }
        }

        // If not authenticated yet, try to load concesionario by slug for the login page
        if (!isAuthenticated) {
          await loadConcesionarioBySlug(slug);
        }
      } catch (error) {
        console.error('[BusinessAuth] Error restoring session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadConcesionarioData = async (concesionarioId: string): Promise<boolean> => {
    try {
      const docRef = doc(firestore, 'concesionarios', concesionarioId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Concesionario;
        setConcesionario(data);

        // Load staff list
        const staffRef = collection(firestore, 'concesionarios', concesionarioId, 'staff');
        const staffQuery = query(staffRef, where('activo', '==', true));
        const staffSnap = await getDocs(staffQuery);
        const staffMembers = staffSnap.docs.map(d => ({ id: d.id, ...d.data() } as StaffMember));
        setStaffList(staffMembers);

        return true;
      }
      return false;
    } catch (error) {
      console.error('[BusinessAuth] Error loading concesionario:', error);
      return false;
    }
  };

  const loadConcesionarioBySlug = async (targetSlug: string): Promise<boolean> => {
    try {
      const q = query(
        collection(firestore, 'concesionarios'),
        where('slug', '==', targetSlug)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as Concesionario;
        setConcesionario(data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[BusinessAuth] Error loading by slug:', error);
      return false;
    }
  };

  const loadConcesionario = useCallback(async (targetSlug: string): Promise<boolean> => {
    return loadConcesionarioBySlug(targetSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore]);

  const validateEnterprise = useCallback(async (targetSlug: string, masterKey: string): Promise<boolean> => {
    if (!concesionario || concesionario.slug !== targetSlug) {
      const found = await loadConcesionarioBySlug(targetSlug);
      if (!found) return false;
    }

    // Need to re-read concesionario after possible load
    const currentConcesionario = concesionario;
    if (!currentConcesionario) return false;

    // Check if plan is active
    if (!currentConcesionario.plan_activo) {
      return false;
    }

    // Validate master key
    const isValid = await verifySHA256(masterKey, currentConcesionario.clave_maestra_hash);
    if (!isValid) return false;

    // Load staff
    await loadConcesionarioData(currentConcesionario.id);

    // Save session
    const session: BusinessSession = {
      concesionarioId: currentConcesionario.id,
      slug: targetSlug,
      validado: true,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(BUSINESS_SESSION_KEY, JSON.stringify(session));
    setIsAuthenticated(true);

    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concesionario, firestore]);

  const validateStaffPin = useCallback(async (staffId: string, pin: string): Promise<boolean> => {
    const staffMember = staffList.find(s => s.id === staffId);
    if (!staffMember || !staffMember.activo) return false;

    const isValid = await verifySHA256(pin, staffMember.pin_hash);
    if (!isValid) return false;

    setStaff(staffMember);
    setIsStaffLoggedIn(true);

    // Save staff session
    const session: StaffSession = {
      staffId: staffMember.id,
      rol: staffMember.rol,
      nombre: staffMember.nombre,
    };
    sessionStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));

    return true;
  }, [staffList]);

  const switchUser = useCallback(() => {
    setStaff(null);
    setIsStaffLoggedIn(false);
    sessionStorage.removeItem(STAFF_SESSION_KEY);
  }, []);

  const logout = useCallback(() => {
    setConcesionario(null);
    setStaff(null);
    setStaffList([]);
    setIsAuthenticated(false);
    setIsStaffLoggedIn(false);
    sessionStorage.removeItem(BUSINESS_SESSION_KEY);
    sessionStorage.removeItem(STAFF_SESSION_KEY);
  }, []);

  const currentRole = staff?.rol ?? null;

  const hasPermission = useCallback((module: BusinessModule): PermissionLevel => {
    if (!currentRole) return false;
    return ROLE_PERMISSIONS[currentRole][module];
  }, [currentRole]);

  const canSeeCosts = currentRole ? CAN_SEE_PURCHASE_COSTS[currentRole] : false;

  const value = useMemo((): BusinessAuthContextValue => ({
    concesionario,
    staff,
    staffList,
    isLoading,
    isAuthenticated,
    isStaffLoggedIn,
    currentRole,
    hasPermission,
    canSeeCosts,
    validateEnterprise,
    validateStaffPin,
    switchUser,
    logout,
    loadConcesionario,
  }), [concesionario, staff, staffList, isLoading, isAuthenticated, isStaffLoggedIn, currentRole, hasPermission, canSeeCosts, validateEnterprise, validateStaffPin, switchUser, logout, loadConcesionario]);

  return (
    <BusinessAuthContext.Provider value={value}>
      {children}
    </BusinessAuthContext.Provider>
  );
}

// ==================== HOOKS ====================

export function useBusinessAuth(): BusinessAuthContextValue {
  const context = useContext(BusinessAuthContext);
  if (context === undefined) {
    throw new Error('useBusinessAuth must be used within a BusinessAuthProvider');
  }
  return context;
}
