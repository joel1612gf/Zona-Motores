'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Vehicle } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Flame } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function VehicleCard({ vehicle, isFeatured = false }: { vehicle: Vehicle; isFeatured?: boolean }) {
  return (
    <Card className={cn(
        "group overflow-hidden rounded-lg border h-full flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        isFeatured && "border-orange-400/50 shadow-lg shadow-orange-500/10"
      )}>
      <Link href={`/listings/${vehicle.id}`} className="focus:outline-none block h-full flex flex-col">
        <div className="relative">
          <Image
            src={vehicle.images[0].url}
            alt={vehicle.images[0].alt}
            width={600}
            height={400}
            className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
            data-ai-hint={vehicle.images[0].hint}
          />
           <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-10">
              <div className="flex flex-col gap-2">
                {isFeatured && (
                  <Badge className="border-transparent bg-orange-500 text-white hover:bg-orange-600 shadow-lg">
                    <Flame className="h-4 w-4 -ml-1 mr-1.5" />
                    En Fuego
                  </Badge>
                )}
              </div>
              {vehicle.seller.isVerified && (
                <div className="p-1.5 bg-background/80 rounded-full backdrop-blur-sm shadow-lg">
                  <Star className="h-4 w-4 text-primary fill-primary" />
                </div>
              )}
            </div>
        </div>
        <CardContent className="p-2 sm:p-4 space-y-1 flex flex-col flex-grow">
          <h3 className="font-headline text-lg font-bold truncate">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h3>
          <p className="text-sm text-muted-foreground">{vehicle.mileage.toLocaleString()} km</p>
          <div className="flex-grow" />
          <p className="font-headline text-2xl font-bold text-primary">
            {formatCurrency(vehicle.priceUSD)}
          </p>
          <div className="hidden sm:flex items-center text-sm text-muted-foreground pt-1">
            <MapPin className="h-4 w-4 mr-1.5" />
            <span>{`${vehicle.location.city}, ${vehicle.location.state}`}</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
