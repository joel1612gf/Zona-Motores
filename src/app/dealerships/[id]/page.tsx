'use client';
import { useParams, notFound } from 'next/navigation';
import { useVehicles, VehicleProvider } from '@/context/vehicle-context';
import { VehicleCard } from '@/components/vehicle-card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile } from '@/lib/types';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { Concesionario } from '@/lib/business-types';

function DealershipPageContent() {
    const params = useParams<{ id: string }>();
    const { vehicles, isLoading: areVehiclesLoading } = useVehicles();
    const firestore = useFirestore();

    const dealerProfileRef = useMemoFirebase(() => {
        if (!firestore || !params.id) return null;
        return doc(firestore, 'users', params.id);
    }, [firestore, params.id]);

    const { data: userProfile, isLoading: isUserLoading } = useDoc<UserProfile>(dealerProfileRef);
    
    const concesionariosQuery = useMemoFirebase(() => {
        if (!firestore || !params.id) return null;
        return query(collection(firestore, 'concesionarios'), where('owner_uid', '==', params.id), limit(1));
    }, [firestore, params.id]);

    const { data: saasProfiles, isLoading: isSaasLoading } = useCollection<Concesionario>(concesionariosQuery);

    const sellerInfo = useMemo(() => {
        // Caso 1: Es un concesionario del SaaS (Business)
        if (saasProfiles && saasProfiles.length > 0) {
            const c = saasProfiles[0];
            return {
                uid: c.owner_uid,
                displayName: c.nombre_empresa,
                isVerified: true,
                accountType: 'dealer',
                logoUrl: c.logo_url || '',
                heroUrl: '', // Forzamos banner vacío para usar el fondo azul corporativo
                address: c.direccion,
                isSaaSBusiness: true,
                saasSlug: c.slug
            } as UserProfile;
        }

        // Caso 2: Es un usuario normal que activó el perfil de dealer
        if (userProfile) {
            const data = userProfile as any;
            return {
                ...userProfile,
                displayName: data.nombre_empresa || userProfile.displayName,
                address: data.direccion || data.address || '',
                logoUrl: data.logoUrl || '',
                heroUrl: ''
            } as UserProfile;
        }
        
        return null;
    }, [userProfile, saasProfiles]);

    const dealerVehicles = useMemo(() => vehicles.filter(v => v.sellerId === params.id), [vehicles, params.id]);

    const isLoading = areVehiclesLoading || isUserLoading || isSaasLoading;

    if (isLoading) {
        return <LoadingSkeleton />;
    }

    if (!sellerInfo) {
        notFound();
    }
    
    return (
        <div>
        <section className={`relative w-full h-[40vh] flex items-center justify-center text-center text-white ${!sellerInfo.heroUrl ? 'bg-primary' : ''}`}>
            {sellerInfo.heroUrl && (
                <Image
                    src={sellerInfo.heroUrl}
                    fill
                    alt={`${sellerInfo.displayName} hero image`}
                    className="object-cover -z-10 brightness-50"
                    priority
                />
            )}
            <div className="container px-4 md:px-6 space-y-4">
                {sellerInfo.logoUrl ? (
                    <Image 
                        src={sellerInfo.logoUrl} 
                        alt={`${sellerInfo.displayName} logo`} 
                        width={120} 
                        height={120} 
                        className="mx-auto rounded-full border-4 border-white bg-white shadow-xl object-cover" 
                    />
                ) : (
                    <div className="mx-auto w-[120px] h-[120px] rounded-full border-4 border-white bg-muted flex items-center justify-center shadow-xl">
                        <span className="text-4xl font-bold text-muted-foreground">
                            {sellerInfo.displayName?.charAt(0)}
                        </span>
                    </div>
                )}
                <div className="space-y-2">
                    <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tighter drop-shadow-lg">
                        {sellerInfo.displayName}
                    </h1>
                    {sellerInfo.address && (
                        <p className="flex items-center justify-center text-lg text-white/90 drop-shadow-md">
                            <MapPin className="h-5 w-5 mr-2" />
                            {sellerInfo.address}
                        </p>
                    )}
                </div>
            </div>
        </section>
            <div className="container mx-auto py-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="font-headline text-3xl font-bold">Catálogo ({dealerVehicles.length} vehículos)</h2>
                    <Button asChild variant="outline">
                        <Link href="/dealerships">
                            &larr; Volver a Concesionarios
                        </Link>
                    </Button>
                </div>
                {dealerVehicles.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {dealerVehicles.map(vehicle => (
                        <VehicleCard key={vehicle.id} vehicle={vehicle} />
                    ))}
                    </div>
                ) : (
                    <div className="text-center py-16 border rounded-lg bg-card">
                    <h2 className="text-2xl font-semibold font-headline">Este concesionario no tiene vehículos publicados</h2>
                    <p className="text-muted-foreground mt-2">Vuelve a intentarlo más tarde.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DealershipPage() {
    return (
        <VehicleProvider>
            <DealershipPageContent />
        </VehicleProvider>
    )
}


function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-8">
        <Skeleton className="h-10 w-72 mb-8" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[380px] w-full" />)}
        </div>
    </div>
  )
}
