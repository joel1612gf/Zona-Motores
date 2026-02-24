'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Vehicle } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Pencil,
    Trash2,
    Rocket,
    Eye,
    Pause,
    Play,
    Loader2,
    Hand,
    ExternalLink,
    RefreshCw,
    AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFirestore, useUser, useStorage } from '@/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { cn } from '@/lib/utils';
import { addDays, format } from 'date-fns';
import { useSubscription } from '@/context/subscription-context';


export function MyListingCard({ vehicle }: { vehicle: Vehicle }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const storage = useStorage();
    const { user } = useUser();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isPromoting, setIsPromoting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { canPromote, promotionsRemaining, usePromotion, limits } = useSubscription();

    const handleRefresh = async () => {
        if (!user) return;
        setIsRefreshing(true);
        try {
            const vehicleRef = doc(firestore, 'users', user.uid, 'vehicleListings', vehicle.id);
            await updateDoc(vehicleRef, {
                promotionExpiresAt: Timestamp.fromDate(new Date(0)),
            });
            toast({
                title: "¡Anuncio Actualizado!",
                description: `Tu ${vehicle.make} ${vehicle.model} ahora aparecerá correctamente en todas las búsquedas.`,
            });
        } catch (error) {
            console.error("Error refreshing legacy listing:", error);
            toast({
                variant: "destructive",
                title: "Error al actualizar",
                description: "No se pudo actualizar la publicación. Inténtalo de nuevo.",
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        setIsDeleting(true);
        try {
            const vehicleRef = doc(firestore, 'users', user.uid, 'vehicleListings', vehicle.id);

            if (vehicle.images && vehicle.images.length > 0) {
                const imageDeletePromises = vehicle.images.map(image => {
                    if (image.url.includes('firebasestorage.googleapis.com')) {
                        const imageRef = ref(storage, image.url);
                        return deleteObject(imageRef).catch(error => {
                            if (error.code === 'storage/object-not-found') {
                                console.warn(`Image not found during deletion, skipping: ${image.url}`);
                                return; // Consider it a success if the file is already gone
                            }
                            // For other errors, re-throw to fail the Promise.all
                            throw error;
                        });
                    }
                    return Promise.resolve();
                });
                // This will now only fail for critical storage errors other than 'object-not-found'.
                await Promise.all(imageDeletePromises);
            }

            await deleteDoc(vehicleRef);

            toast({
                title: "Publicación Eliminada",
                description: `Tu ${vehicle.make} ${vehicle.model} ha sido eliminado.`,
            });
        } catch (error) {
            console.error("Error deleting vehicle:", error);
            toast({
                variant: "destructive",
                title: "Error al eliminar",
                description: "No se pudo eliminar la publicación por completo. Inténtalo de nuevo.",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!user) return;
        setIsTogglingStatus(true);
        const newStatus = vehicle.status === 'active' ? 'paused' : 'active';
        try {
            const vehicleRef = doc(firestore, 'users', user.uid, 'vehicleListings', vehicle.id);

            const updatePayload: { status: string; createdAt?: any } = { status: newStatus };
            // If reactivating, reset the timer.
            if (newStatus === 'active') {
                updatePayload.createdAt = serverTimestamp();
            }

            await updateDoc(vehicleRef, updatePayload);
            toast({
                title: `Publicación ${newStatus === 'active' ? 'Reactivada' : 'Pausada'}`,
                description: `Tu ${vehicle.make} ${vehicle.model} ahora está ${newStatus === 'active' ? 'activa de nuevo' : 'pausada'}.`,
            });
        } catch (error) {
            console.error("Error updating status:", error);
            toast({
                variant: "destructive",
                title: "Error al actualizar",
                description: "No se pudo cambiar el estado de la publicación.",
            });
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handlePromote = async (days: number) => {
        if (!user) return;
        if (!canPromote()) {
            toast({
                variant: 'destructive',
                title: 'Sin promociones disponibles',
                description: 'Mejora tu plan para acceder a publicaciones destacadas.',
            });
            return;
        }
        setIsPromoting(true);
        try {
            const vehicleRef = doc(firestore, 'users', user.uid, 'vehicleListings', vehicle.id);
            const expiryDate = addDays(new Date(), days);

            await updateDoc(vehicleRef, {
                promotionExpiresAt: Timestamp.fromDate(expiryDate),
            });

            await usePromotion();

            toast({
                title: "¡Vehículo Promocionado!",
                description: `Tu ${vehicle.make} ${vehicle.model} aparecerá primero hasta el ${format(expiryDate, 'dd/MM/yyyy')}. Te quedan ${Math.max(0, promotionsRemaining - 1)} promociones este mes.`,
            });
        } catch (error) {
            console.error("Error promoting vehicle:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo promocionar el vehículo.' });
        } finally {
            setIsPromoting(false);
        }
    };


    const statusMap = {
        active: { text: 'Activa', className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' },
        paused: { text: 'Pausada', className: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700' },
        sold: { text: 'Vendida', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700' },
    };

    const currentStatus = statusMap[vehicle.status || 'active'];
    const isPromotionActive = vehicle.promotionExpiresAt && vehicle.promotionExpiresAt.toDate() > new Date();
    const isLegacy = vehicle.promotionExpiresAt === undefined;


    return (
        <Card className="flex flex-col md:flex-row items-start gap-4 p-4 transition-all hover:bg-muted/50">
            <Link href={`/listings/${vehicle.id}`} className="block flex-shrink-0">
                <Image
                    src={vehicle.images[0].url}
                    alt={vehicle.images[0].alt}
                    width={250}
                    height={160}
                    className="aspect-video object-cover rounded-md border"
                />
            </Link>
            <div className="flex-grow">
                <div className="flex items-center gap-4">
                    <h3 className="font-headline text-xl font-bold">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h3>
                    {!isLegacy && <Badge variant="secondary" className={cn(currentStatus.className)}>{currentStatus.text}</Badge>}
                    {isPromotionActive && (
                        <Badge variant="secondary" className="border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                            Promocionado
                        </Badge>
                    )}
                </div>
                <p className="font-headline text-lg font-semibold text-primary mt-1">{formatCurrency(vehicle.priceUSD)}</p>
                <p className="text-sm text-muted-foreground mt-1">{vehicle.mileage.toLocaleString()} km &middot; {vehicle.location.city}</p>

                {isLegacy ? (
                    <Alert className="mt-4 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-500/50">
                        <AlertTriangle className="h-4 w-4 !text-amber-600 dark:!text-amber-400" />
                        <AlertTitle className="font-bold">Actualización Requerida</AlertTitle>
                        <AlertDescription>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                                <p className="text-sm flex-grow">Este anuncio necesita actualizarse para aparecer en las búsquedas.</p>
                                <Button size="sm" onClick={handleRefresh} disabled={isRefreshing} variant="outline" className="bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/50 dark:hover:bg-amber-900/80">
                                    {isRefreshing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                                    Actualizar ahora
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                ) : vehicle.status === 'paused' ? (
                    <Alert className="mt-4 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-500/50">
                        <Hand className="h-4 w-4 !text-amber-600 dark:!text-amber-400" />
                        <AlertTitle className="font-bold">¡Tu publicación fue pausada!</AlertTitle>
                        <AlertDescription>
                            <div className="flex flex-col gap-3 mt-2">
                                <p>Para mantener la plataforma actualizada, pausamos los anuncios con más de 7 días. ¿Ya vendiste este vehículo?</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" onClick={handleToggleStatus} disabled={isTogglingStatus}>
                                        {isTogglingStatus && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                        No, reactivar gratis
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="sm" disabled={isDeleting}>
                                                {isDeleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                                Sí, lo vendí (Eliminar)
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro que quieres eliminar esta publicación?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción no se puede deshacer. Esto eliminará permanentemente la publicación
                                                    de "{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}" de nuestros servidores.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    onClick={handleDelete}
                                                    disabled={isDeleting}>
                                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Sí, eliminar
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/listings/${vehicle.id}`}>
                                <Eye className="mr-1.5 h-4 w-4" />
                                Ver
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/listings/${vehicle.id}/edit`}>
                                <Pencil className="mr-1.5 h-4 w-4" />
                                Editar
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleToggleStatus} disabled={isTogglingStatus || vehicle.status === 'sold'}>
                            {isTogglingStatus ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> :
                                (vehicle.status === 'active' ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />)}
                            {vehicle.status === 'active' ? 'Pausar' : 'Activar'}
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" disabled={isDeleting}>
                                    <Trash2 className="mr-1.5 h-4 w-4" />
                                    Borrar
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro que quieres eliminar esta publicación?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Esto eliminará permanentemente la publicación
                                        de "{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}" de nuestros servidores.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={handleDelete}
                                        disabled={isDeleting}>
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Sí, eliminar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        {limits.maxPromotionsPerMonth === 0 ? (
                            <Button asChild variant="secondary" size="sm">
                                <Link href="/pricing">
                                    <Rocket className="mr-1.5 h-4 w-4" />
                                    Promocionar (Ver Planes)
                                </Link>
                            </Button>
                        ) : (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="secondary" size="sm" disabled={isPromoting || isPromotionActive || !canPromote()}>
                                        <Rocket className="mr-1.5 h-4 w-4" />
                                        {isPromotionActive ? 'Promocionado' : `Promocionar (${promotionsRemaining})`}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Promocionar Anuncio</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Destaca tu anuncio y llega a más compradores. Los anuncios promocionados aparecen al principio de los resultados de búsqueda.
                                            <br /><br />
                                            <strong>Te quedan {promotionsRemaining} promociones este mes</strong> en tu plan.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="grid grid-cols-2 gap-4 my-4">
                                        <Button variant="outline" onClick={() => handlePromote(limits.promotionDays)} disabled={isPromoting}>
                                            {isPromoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            {limits.promotionDays} Días
                                        </Button>
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}

                        {vehicle.marketplaceUrl && (
                            <Button asChild variant="outline" size="sm">
                                <Link href={vehicle.marketplaceUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-1.5 h-4 w-4" />
                                    Ir a Marketplace
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
