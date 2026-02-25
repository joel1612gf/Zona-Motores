'use client';

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { collection, doc, query, orderBy, limit, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Notification } from '@/lib/types';

type NotificationContextType = {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useUser();
    const firestore = useFirestore();

    const notificationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
    }, [user, firestore]);

    const { data: rawNotifications, isLoading } = useCollection<Notification>(notificationsQuery);

    const notifications = useMemo(() => {
        if (!rawNotifications) return [];
        return rawNotifications;
    }, [rawNotifications]);

    const unreadCount = useMemo(() => {
        return notifications.filter(n => !n.read).length;
    }, [notifications]);

    const markAsRead = useCallback(async (notificationId: string) => {
        if (!user || !firestore) return;
        const notifRef = doc(firestore, 'users', user.uid, 'notifications', notificationId);
        await updateDoc(notifRef, { read: true });
    }, [user, firestore]);

    const markAllAsRead = useCallback(async () => {
        if (!user || !firestore || notifications.length === 0) return;
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;

        const batch = writeBatch(firestore);
        for (const notif of unread) {
            const notifRef = doc(firestore, 'users', user.uid, 'notifications', notif.id);
            batch.update(notifRef, { read: true });
        }
        await batch.commit();
    }, [user, firestore, notifications]);

    const deleteNotification = useCallback(async (notificationId: string) => {
        if (!user || !firestore) return;
        const notifRef = doc(firestore, 'users', user.uid, 'notifications', notificationId);
        await deleteDoc(notifRef);
    }, [user, firestore]);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    }), [notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        return {
            notifications: [] as Notification[],
            unreadCount: 0,
            isLoading: false,
            markAsRead: async () => { },
            markAllAsRead: async () => { },
            deleteNotification: async () => { },
        };
    }
    return context;
}
