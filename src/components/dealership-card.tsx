
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Vehicle } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { VehicleCard } from './vehicle-card';
import { ChevronRight, MapPin } from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface DealershipCardProps {
  dealership: {
    seller: UserProfile;
    vehicles: Vehicle[];
  };
}

export function DealershipCard({ dealership }: DealershipCardProps) {
  const { seller, vehicles } = dealership;

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary">
            <AvatarImage src={seller.logoUrl} alt={`${seller.displayName} logo`} />
            <AvatarFallback>{seller.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <Link href={`/dealerships/${seller.uid}`} className="focus:outline-none">
              <h2 className="font-headline text-3xl font-bold hover:underline">{seller.displayName}</h2>
            </Link>
            {seller.address && (
              <p className="flex items-center text-muted-foreground">
                <MapPin className="h-4 w-4 mr-1.5" />
                {seller.address}
              </p>
            )}
          </div>
        </div>
        <Button asChild>
            <Link href={`/dealerships/${seller.uid}`}>
                Ver Catálogo ({vehicles.length})
                <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
        </Button>
      </div>
      <Carousel
        opts={{
          align: "start",
          loop: vehicles.length > 4,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {vehicles.slice(0, 8).map((vehicle) => (
            <CarouselItem key={vehicle.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
              <div className="p-1 h-full">
                <VehicleCard vehicle={vehicle} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden sm:flex" />
        <CarouselNext className="hidden sm:flex" />
      </Carousel>
    </Card>
  );
}
