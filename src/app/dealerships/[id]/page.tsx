
'use client';
import { useParams, notFound } from 'next/navigation';
import { useVehicles } from '@/context/vehicle-context';
import { VehicleCard } from '@/components/vehicle-card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile } from '@/lib/types';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';

export default function DealershipPage() {
    const params = useParams<{ id: string }>();
    const { vehicles, isLoading } = useVehicles();

    const dealerVehicles = useMemo(() => vehicles.filter(v => v.sellerId === params.id), [vehicles, params.id]);

    const sellerInfo: UserProfile | undefined = useMemo(() => {
        if(dealerVehicles.length > 0) {
            return dealerVehicles[0].seller;
        }
        const vehicleFromAny = vehicles.find(v => v.seller.uid === params.id);
        if (vehicleFromAny) return vehicleFromAny.seller;
        return undefined;
    }, [dealerVehicles, vehicles, params.id]);


    if (isLoading) {
        return <LoadingSkeleton />;
    }

    if (!sellerInfo || sellerInfo.accountType !== 'dealer') {
        notFound();
    }
    
    return (
        <div>
            <section className="relative w-full h-[40vh] flex items-center justify-center text-center text-white">
                <Image
                src={sellerInfo.heroUrl || 'https://picsum.photos/seed/dealer-hero/1800/800'}
                fill
                alt={`${sellerInfo.displayName} hero image`}
                className="object-cover -z-10 brightness-50"
                priority
                />
                <div className="container px-4 md:px-6 space-y-4">
                    {sellerInfo.logoUrl && <Image src={sellerInfo.logoUrl} alt={`${sellerInfo.displayName} logo`} width={100} height={100} className="mx-auto rounded-full border-4 border-white bg-white/80 backdrop-blur-sm" />}
                    <h1 className="font-headline text-5xl font-bold tracking-tighter">
                        {sellerInfo.displayName}
                    </h1>
                     {sellerInfo.address && (
                      <p className="flex items-center justify-center text-lg text-neutral-200">
                        <MapPin className="h-5 w-5 mr-2" />
                        {sellerInfo.address}
                      </p>
                    )}
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
