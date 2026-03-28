'use client';

import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import type { Vehicle } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Flame, Heart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useFavorites } from '@/context/favorites-context';

export function VehicleCard({ vehicle, isFeatured = false }: { vehicle: Vehicle; isFeatured?: boolean }) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const isVehicleFavorite = isFavorite(vehicle.id);

  const [isAnimating, setIsAnimating] = useState(false);

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    if (isVehicleFavorite) {
      removeFavorite(vehicle.id);
    } else {
      addFavorite(vehicle.id);
    }
  };

  const isPromoted = vehicle.promotionExpiresAt && vehicle.promotionExpiresAt.toDate() > new Date();
  const mainImage = vehicle.images?.[0];

  return (
    <Card className={cn(
      "group overflow-hidden rounded-lg border h-full flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
      isPromoted && "border-orange-400/50 shadow-lg shadow-orange-500/10"
    )}>
      <Link href={`/listings/${vehicle.id}`} className="focus:outline-none block h-full flex flex-col">
        <div className="relative">
          <Image
            src={mainImage?.url || '/placeholder-vehicle.svg'}
            alt={mainImage?.alt || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            width={600}
            height={400}
            className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
            data-ai-hint={mainImage?.hint}
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 33vw"
            priority={isFeatured}
            loading={isFeatured ? 'eager' : 'lazy'}
          />
          <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-10">
            <div className="flex flex-col gap-2">
              {isPromoted && (
                <Badge className="border-transparent bg-orange-500 text-white hover:bg-orange-600 shadow-lg">
                  <Flame className="h-4 w-4 sm:-ml-1 sm:mr-1.5" />
                  <span className="hidden sm:inline">Promocionado</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFavoriteToggle}
                className="p-1.5 bg-background/80 rounded-full backdrop-blur-sm shadow-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
                aria-label="Guardar en favoritos"
              >
                <Heart className={cn(
                  "h-5 w-5 text-destructive transition-all",
                  isVehicleFavorite ? 'fill-destructive' : 'fill-transparent',
                  isAnimating && 'scale-[1.3]'
                )}
                  style={{ transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), fill 0.2s, color 0.2s' }}
                />
              </button>
              {vehicle.seller.isVerified && (
                <div className="p-1.5 bg-background/80 rounded-full backdrop-blur-sm shadow-lg">
                  <Star className="h-4 w-4 text-primary fill-primary" />
                </div>
              )}
            </div>
          </div>
        </div>
        <CardContent className="px-2 pt-1 pb-2 sm:p-4 flex flex-col flex-grow">
          <div className="space-y-1">
            <h3 className="font-headline text-base sm:text-lg font-bold truncate">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h3>

            <p className="text-xs sm:text-sm text-muted-foreground">{vehicle.mileage.toLocaleString()} km</p>
          </div>
          <div className="flex-grow" />
          <div className="flex justify-between items-end pt-2">
            <p className="font-headline text-xl sm:text-2xl font-bold text-primary">
              {formatCurrency(vehicle.priceUSD)}
            </p>
          </div>
          <div className="flex items-center text-xs sm:text-sm text-muted-foreground pt-1">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 flex-shrink-0" />
            <span className="truncate">{`${vehicle.location.city}, ${vehicle.location.state}`}</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
