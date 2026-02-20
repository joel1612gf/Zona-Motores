'use client';

import React, { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { PlanTier, UserSubscription, PlanLimits } from '@/lib/types';
import { PLAN_CONFIG } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const ACTIVATION_CODE = '1612';

interface SubscriptionContextValue {
    plan: PlanTier;
    subscription: UserSubscription | null;
    isLoading: boolean;
    limits: PlanLimits;
    planName: string;
    planPrice: number;

    // Counters
    contactsUsed: number;
    contactsRemaining: number; // -1 = unlimited
    promotionsUsed: number;
    promotionsRemaining: number;
    listingsUsed: number; // not tracked here, passed externally

    // Checks
    canPublish: (currentListingCount: number) => boolean;
    canContact: () => boolean;
    canPromote: () => boolean;
    canAccessStats: () => boolean;
    isDealerEnabled: () => boolean;

    // Actions
    activatePlan: (plan: PlanTier, code: string) => Promise<boolean>;
    cancelPlan: () => Promise<boolean>;
    useContact: () => Promise<boolean>;
    usePromotion: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

function getCurrentMonth(): number {
    return new Date().getMonth() + 1; // 1-12
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const subscriptionRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid, 'subscription', 'current');
    }, [firestore, user]);

    const { data: rawSubscription, isLoading } = useDoc<UserSubscription>(subscriptionRef);

    // Reset monthly counters if month changed
    const subscription = useMemo((): UserSubscription | null => {
        if (!rawSubscription) return null;
        const currentMonth = getCurrentMonth();
        return {
            ...rawSubscription,
            contactsUsedThisMonth: rawSubscription.contactsResetMonth === currentMonth ? rawSubscription.contactsUsedThisMonth : 0,
            contactsResetMonth: currentMonth,
            promotionsUsedThisMonth: rawSubscription.promotionsResetMonth === currentMonth ? rawSubscription.promotionsUsedThisMonth : 0,
            promotionsResetMonth: currentMonth,
        };
    }, [rawSubscription]);

    const plan: PlanTier = subscription?.plan || 'basico';
    const config = PLAN_CONFIG[plan];
    const limits = config.limits;

    const contactsUsed = subscription?.contactsUsedThisMonth || 0;
    const contactsRemaining = limits.maxContactsPerMonth === -1 ? -1 : Math.max(0, limits.maxContactsPerMonth - contactsUsed);
    const promotionsUsed = subscription?.promotionsUsedThisMonth || 0;
    const promotionsRemaining = Math.max(0, limits.maxPromotionsPerMonth - promotionsUsed);

    const canPublish = useCallback((currentListingCount: number) => {
        return currentListingCount < limits.maxListings;
    }, [limits.maxListings]);

    const canContact = useCallback(() => {
        if (limits.maxContactsPerMonth === -1) return true;
        return contactsUsed < limits.maxContactsPerMonth;
    }, [limits.maxContactsPerMonth, contactsUsed]);

    const canPromote = useCallback(() => {
        return promotionsUsed < limits.maxPromotionsPerMonth;
    }, [limits.maxPromotionsPerMonth, promotionsUsed]);

    const canAccessStats = useCallback(() => {
        return limits.hasStats;
    }, [limits.hasStats]);

    const isDealerEnabled = useCallback(() => {
        return limits.hasDealerProfile;
    }, [limits.hasDealerProfile]);

    const activatePlan = useCallback(async (targetPlan: PlanTier, code: string): Promise<boolean> => {
        if (code !== ACTIVATION_CODE) {
            toast({
                title: 'Código inválido',
                description: 'El código de acceso no es correcto. Inténtalo de nuevo.',
                variant: 'destructive',
            });
            return false;
        }

        if (!user || !subscriptionRef) {
            toast({
                title: 'Error',
                description: 'Debes iniciar sesión para contratar un plan.',
                variant: 'destructive',
            });
            return false;
        }

        const currentMonth = getCurrentMonth();
        const newSubscription: Omit<UserSubscription, 'id'> = {
            plan: targetPlan,
            activatedAt: Timestamp.now(),
            contactsUsedThisMonth: 0,
            contactsResetMonth: currentMonth,
            promotionsUsedThisMonth: 0,
            promotionsResetMonth: currentMonth,
        };

        try {
            await setDoc(subscriptionRef, newSubscription);
            return true;
        } catch (error) {
            console.error('Error activating plan:', error);
            toast({
                title: 'Error al activar plan',
                description: 'No se pudo activar el plan. Inténtalo de nuevo.',
                variant: 'destructive',
            });
            return false;
        }
    }, [user, subscriptionRef, toast]);

    const cancelPlan = useCallback(async (): Promise<boolean> => {
        if (!user || !subscriptionRef) return false;

        try {
            await setDoc(subscriptionRef, {
                plan: 'basico',
                activatedAt: Timestamp.now(),
                contactsUsedThisMonth: 0,
                contactsResetMonth: getCurrentMonth(),
                promotionsUsedThisMonth: 0,
                promotionsResetMonth: getCurrentMonth(),
            });
            toast({
                title: 'Plan cancelado',
                description: 'Has vuelto al plan Básico gratuito.',
            });
            return true;
        } catch (error) {
            console.error('Error canceling plan:', error);
            toast({
                title: 'Error',
                description: 'No se pudo cancelar el plan.',
                variant: 'destructive',
            });
            return false;
        }
    }, [user, subscriptionRef, toast]);

    const useContact = useCallback(async (): Promise<boolean> => {
        if (!canContact()) {
            toast({
                title: 'Límite de contactos alcanzado',
                description: `Tu plan ${config.name} permite ${limits.maxContactsPerMonth} contactos al mes. Mejora tu plan para más.`,
            });
            return false;
        }

        if (!subscriptionRef) return false;

        try {
            const currentMonth = getCurrentMonth();
            await setDoc(subscriptionRef, {
                contactsUsedThisMonth: contactsUsed + 1,
                contactsResetMonth: currentMonth,
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('Error recording contact:', error);
            return false;
        }
    }, [canContact, subscriptionRef, contactsUsed, config.name, limits.maxContactsPerMonth, toast]);

    const usePromotion = useCallback(async (): Promise<boolean> => {
        if (!canPromote()) {
            toast({
                title: 'Sin promociones disponibles',
                description: `Ya usaste tus ${limits.maxPromotionsPerMonth} promociones de este mes.`,
            });
            return false;
        }

        if (!subscriptionRef) return false;

        try {
            const currentMonth = getCurrentMonth();
            await setDoc(subscriptionRef, {
                promotionsUsedThisMonth: promotionsUsed + 1,
                promotionsResetMonth: currentMonth,
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('Error recording promotion:', error);
            return false;
        }
    }, [canPromote, subscriptionRef, promotionsUsed, limits.maxPromotionsPerMonth, toast]);

    const value = useMemo((): SubscriptionContextValue => ({
        plan,
        subscription,
        isLoading,
        limits,
        planName: config.name,
        planPrice: config.price,
        contactsUsed,
        contactsRemaining,
        promotionsUsed,
        promotionsRemaining,
        listingsUsed: 0,
        canPublish,
        canContact,
        canPromote,
        canAccessStats,
        isDealerEnabled,
        activatePlan,
        cancelPlan,
        useContact,
        usePromotion,
    }), [plan, subscription, isLoading, limits, config, contactsUsed, contactsRemaining, promotionsUsed, promotionsRemaining, canPublish, canContact, canPromote, canAccessStats, isDealerEnabled, activatePlan, cancelPlan, useContact, usePromotion]);

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription(): SubscriptionContextValue {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
}
