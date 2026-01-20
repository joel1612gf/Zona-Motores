'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Vehicle } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Gauge } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg focus-within:ring-2 focus-within:ring-ring">
      <Link href={`/listings/${vehicle.id}`} className="focus:outline-none">
        <div className="relative">
          <Image
            src={vehicle.images[0].url}
            alt={vehicle.images[0].alt}
            width={600}
            height={400}
            className="aspect-video w-full object-cover"
            data-ai-hint={vehicle.images[0].hint}
          />
          <Badge className="absolute top-2 right-2 border-transparent bg-background/80 text-foreground hover:bg-background">
            {vehicle.bodyType}
          </Badge>
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-headline text-lg font-semibold truncate">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h3>
          <div className="flex items-baseline justify-start text-primary">
            <p className="font-headline text-2xl font-bold text-accent">
              {formatCurrency(vehicle.priceUSD)}
            </p>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{`${vehicle.location.city}`}</span>
            </div>
            <div className="flex items-center gap-1">
              <Gauge className="h-4 w-4" />
              <span>{`${vehicle.mileage.toLocaleString()} km`}</span>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
