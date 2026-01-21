'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Vehicle } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Gauge } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function VehicleCard({ vehicle, isFeatured = false }: { vehicle: Vehicle; isFeatured?: boolean }) {
  return (
    <Card className={cn(
        "group overflow-hidden rounded-lg border h-full flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        isFeatured && "border-primary/50 shadow-lg shadow-primary/10"
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
           <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start">
              <div className="flex flex-col gap-2">
                {isFeatured && <Badge>Destacado</Badge>}
                <Badge variant="secondary" className="border-transparent bg-background/80 text-foreground hover:bg-background/90">
                  {vehicle.bodyType}
                </Badge>
              </div>
              <Badge className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                <span>{`${Math.round(vehicle.mileage / 1000)}k km`}</span>
              </Badge>
          </div>
        </div>
        <CardContent className="p-4 space-y-1 flex flex-col flex-grow">
          <h3 className="font-headline text-lg font-bold truncate">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h3>
          <div className="flex-grow" />
          <p className="font-headline text-2xl font-bold text-primary">
            {formatCurrency(vehicle.priceUSD)}
          </p>
          <div className="flex items-center text-sm text-muted-foreground pt-1">
            <MapPin className="h-4 w-4 mr-1.5" />
            <span>{`${vehicle.location.city}, ${vehicle.location.state}`}</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
