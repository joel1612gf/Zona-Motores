'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Pause, Clock, Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/context/notification-context';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/lib/types';

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Ahora';
    if (diffMinutes < 60) return `hace ${diffMinutes} min`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `hace ${diffDays} días`;
    return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

function getNotificationIcon(type: NotificationType) {
    switch (type) {
        case 'listing_expiring_soon':
            return <Clock className="h-5 w-5 text-amber-500" />;
        case 'listing_paused':
            return <Pause className="h-5 w-5 text-orange-500" />;
        case 'listing_deleted':
            return <Trash2 className="h-5 w-5 text-red-500" />;
        case 'listing_promoted':
            return <Megaphone className="h-5 w-5 text-green-500" />;
        case 'welcome':
        default:
            return <Bell className="h-5 w-5 text-blue-500" />;
    }
}

export function NotificationBell() {
    const { user } = useUser();
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    const handleNotificationClick = (notifId: string, isRead: boolean) => {
        if (!isRead) {
            markAsRead(notifId);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="secondary" size="icon" className="relative">
                    <Bell className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">Notificaciones</span>
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[360px] p-0"
                align="end"
                sideOffset={8}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold text-sm">Notificaciones</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => markAllAsRead()}
                        >
                            <CheckCheck className="h-3.5 w-3.5 mr-1" />
                            Marcar todas como leídas
                        </Button>
                    )}
                </div>

                {/* Notification List */}
                <ScrollArea className="max-h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                            <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm text-muted-foreground">No tienes notificaciones</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Aquí aparecerán avisos sobre tus publicaciones
                            </p>
                        </div>
                    ) : (
                        <div>
                            {notifications.map((notif) => {
                                const createdAt = notif.createdAt?.toDate?.() || new Date();
                                return (
                                    <div
                                        key={notif.id}
                                        className={cn(
                                            "relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 border-b last:border-b-0",
                                            !notif.read && "bg-primary/5"
                                        )}
                                        onClick={() => handleNotificationClick(notif.id, notif.read)}
                                    >
                                        {/* Unread indicator */}
                                        {!notif.read && (
                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                                        )}

                                        {/* Icon */}
                                        <div className="flex-shrink-0 mt-0.5">
                                            {getNotificationIcon(notif.type)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <p className={cn("text-sm leading-tight", !notif.read && "font-semibold")}>
                                                {notif.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground leading-snug">
                                                {notif.message}
                                            </p>

                                            <div className="flex items-center gap-2 pt-1">
                                                {notif.actionLabel && notif.actionUrl && (
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!notif.read) markAsRead(notif.id);
                                                            setOpen(false);
                                                        }}
                                                    >
                                                        <Link href={notif.actionUrl}>
                                                            {notif.actionLabel}
                                                        </Link>
                                                    </Button>
                                                )}
                                                <span className="text-[11px] text-muted-foreground/60 ml-auto">
                                                    {getTimeAgo(createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Delete button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteNotification(notif.id);
                                            }}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
