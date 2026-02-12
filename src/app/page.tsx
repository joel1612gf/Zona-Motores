'use client';

import Link from 'next/link';
import Image from 'next/image';
import * as React from 'react';
import Autoplay from 'embla-carousel-autoplay';
import { Button } from '@/components/ui/button';
import { useVehicles } from '@/context/vehicle-context';
import { vehicles as initialVehicles } from '@/lib/data';
import { VehicleCard } from '@/components/vehicle-card';
import { Search, Store } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SearchWithHistory } from '@/components/search-with-history';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { vehicles, isLoading } = useVehicles();
  const [isClient, setIsClient] = React.useState(false);
  const [showStickySearch, setShowStickySearch] = React.useState(false);
  const heroSearchRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleSearch = (term: string) => {
    router.push(`/listings?search=${encodeURIComponent(term)}`);
  }

  React.useEffect(() => {
    setIsClient(true);
    
    const headerHeight = 64; // Corresponds to h-16 in tailwind

    const handleScroll = () => {
      if (heroSearchRef.current) {
        // When the top of the hero search bar reaches the bottom of the header, show the sticky bar.
        if (heroSearchRef.current.getBoundingClientRect().top <= headerHeight) {
          setShowStickySearch(true);
        } else {
          setShowStickySearch(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);

    // Run on mount to set initial state in case the page loads scrolled down.
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const promotedVehicles = React.useMemo(() => {
    if (isClient) {
        return vehicles.filter(v => v.promotionExpiresAt && v.promotionExpiresAt.toDate() > new Date());
    }
    return []; // Return empty for SSR to avoid hydration mismatch
  }, [isClient, vehicles]);

  const latestVehicles = React.useMemo(() => {
    if (isClient) {
        const promotedIds = new Set(promotedVehicles.map(v => v.id));
        return vehicles.filter(v => !promotedIds.has(v.id)).slice(0, 8);
    }
    return []; // Return empty for SSR
  }, [isClient, vehicles, promotedVehicles]);

  const showSkeletons = isLoading && isClient;

  const autoplayPlugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true, stopOnLastSnap: true })
  );

  return (
    <div className="flex flex-col -mt-px">
      <div
        className={cn(
          'fixed top-16 left-0 right-0 z-40 bg-primary py-3 shadow-md transition-transform duration-300',
          showStickySearch ? 'translate-y-0' : '-translate-y-full'
        )}
      >
        <div className="container px-4 md:px-6">
          <SearchWithHistory
            onSearch={handleSearch}
            className="w-full max-w-2xl mx-auto"
            forceClose={!showStickySearch}
          />
        </div>
      </div>
      
      <section className="relative w-full flex items-center justify-center text-center bg-primary text-primary-foreground py-20 md:py-32">
        <div className="container px-4 md:px-6 space-y-6">
          <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-6xl xl:text-7xl/none">
            Encuentra Tu Próximo Vehículo en Venezuela
          </h1>
          <p className="max-w-[700px] mx-auto text-lg md:text-xl text-primary-foreground/80">
            El mercado más confiable para comprar y vender vehículos. Seguro, rápido y fácil.
          </p>
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div ref={heroSearchRef}>
              <SearchWithHistory onSearch={handleSearch} />
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link href="/listings">Ver Todos los Anuncios</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/dealerships">
                  <Store className="mr-2 h-4 w-4" />
                  Concesionarios
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="h-32 bg-gradient-to-b from-primary to-background" />

      {((isClient && promotedVehicles.length > 0) || showSkeletons) && (
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Promocionados</div>
              <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
                Publicaciones Destacadas
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Descubre nuestras mejores ofertas y vehículos promocionados.
              </p>
            </div>
            <Carousel
              opts={{ align: "center", stopOnLastSnap: true }}
              plugins={[autoplayPlugin.current]}
              onMouseEnter={autoplayPlugin.current.stop}
              onMouseLeave={autoplayPlugin.current.reset}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {showSkeletons
                  ? [...Array(5)].map((_, i) => (
                      <CarouselItem key={i} className="pl-2 md:pl-4 basis-3/4 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 carousel-item-peek">
                        <div className="p-1 h-full">
                          <Skeleton className="h-[380px] w-full" />
                        </div>
                      </CarouselItem>
                    ))
                  : promotedVehicles.map((vehicle) => (
                  <CarouselItem key={vehicle.id} className="pl-2 md:pl-4 basis-3/4 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 carousel-item-peek">
                    <div className="p-1 h-full">
                       <VehicleCard vehicle={vehicle} isFeatured={true} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex left-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
              <CarouselNext className="hidden sm:flex right-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
            </Carousel>
          </div>
        </section>
      )}

      <section className="w-full py-12 md:py-24 lg:py-32 bg-secondary/50">
        <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Nuevos</div>
                <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
                    Últimas Publicaciones
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Explora los vehículos más recientes añadidos a nuestra plataforma.
                </p>
            </div>
          <Carousel
              opts={{ align: "center", stopOnLastSnap: true }}
              plugins={[autoplayPlugin.current]}
              onMouseEnter={autoplayPlugin.current.stop}
              onMouseLeave={autoplayPlugin.current.reset}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {showSkeletons 
                  ? [...Array(8)].map((_, i) => (
                      <CarouselItem key={i} className="pl-2 md:pl-4 basis-3/4 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 carousel-item-peek">
                        <div className="p-1 h-full">
                          <Skeleton className="h-[380px] w-full" />
                        </div>
                      </CarouselItem>
                    ))
                  : latestVehicles.map((vehicle) => (
                      <CarouselItem key={vehicle.id} className="pl-2 md:pl-4 basis-3/4 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 carousel-item-peek">
                        <div className="p-1 h-full">
                          <VehicleCard vehicle={vehicle} />
                        </div>
                      </CarouselItem>
                    ))
                }
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex left-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
              <CarouselNext className="hidden sm:flex right-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
            </Carousel>
          <div className="text-center mt-12">
              <Button asChild size="lg">
                  <Link href="/listings">Ver todos los vehículos</Link>
              </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
