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
  Hand
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useStorage } from '@/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { cn } from '@/lib/utils';


export function MyListingCard({ vehicle }: { vehicle: Vehicle }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const storage = useStorage();
    const { user } = useUser();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);

    const handleDelete = async () => {
        if (!user) return;
        setIsDeleting(true);
        try {
            const vehicleRef = doc(firestore, 'users', user.uid, 'vehicleListings', vehicle.id);
            
            try {
                const imageDeletePromises = vehicle.images.map(image => {
                    const imageRef = ref(storage, image.url);
                    return deleteObject(imageRef);
                });
                await Promise.all(imageDeletePromises);
            } catch (storageError) {
                console.error("Error deleting one or more images from storage:", storageError);
                toast({
                    variant: "destructive",
                    title: "Error en Storage",
                    description: "No se pudieron eliminar las imágenes, pero la publicación sí se borró.",
                });
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
                description: "No se pudo eliminar la publicación. Inténtalo de nuevo.",
            });
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

    const statusMap = {
        active: { text: 'Activa', className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' },
        paused: { text: 'Pausada', className: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700' },
        sold: { text: 'Vendida', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700' },
    };

    const currentStatus = statusMap[vehicle.status || 'active'];


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
            <Badge variant="secondary" className={cn(currentStatus.className)}>{currentStatus.text}</Badge>
        </div>
        <p className="font-headline text-lg font-semibold text-primary mt-1">{formatCurrency(vehicle.priceUSD)}</p>
        <p className="text-sm text-muted-foreground mt-1">{vehicle.mileage.toLocaleString()} km &middot; {vehicle.location.city}</p>

        {vehicle.status === 'paused' ? (
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
                <Button variant="secondary" size="sm" disabled>
                    <Rocket className="mr-1.5 h-4 w-4" />
                    Promocionar
                </Button>
            </div>
        )}
      </div>
    </Card>
  );
}
