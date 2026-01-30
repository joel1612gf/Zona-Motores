'use client';

import Link from 'next/link';
import Image from 'next/image';
import * as React from 'react';
import Autoplay from 'embla-carousel-autoplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVehicles } from '@/context/vehicle-context';
import { vehicles as initialVehicles } from '@/lib/data';
import { VehicleCard } from '@/components/vehicle-card';
import { Search, Store } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Home() {
  const { vehicles, isLoading } = useVehicles();
  const [isClient, setIsClient] = React.useState(false);
  const [showStickySearch, setShowStickySearch] = React.useState(false);
  const heroSearchRef = React.useRef<HTMLDivElement>(null);

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

  // Use static data for featured vehicles
  const featuredVehicles = initialVehicles.slice(0, 5);

  // Determine which vehicles to show in the "latest" section
  // - On the server and initial client render, use static data to match the server-rendered HTML.
  // - After the component mounts on the client, use the live data from the context.
  const latestVehicles = isClient ? vehicles.slice(0, 8) : initialVehicles.slice(0, 8);
  const showSkeletons = isLoading && isClient;

  const autoplayPlugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'fixed top-16 left-0 right-0 z-40 bg-primary py-3 shadow-md',
          showStickySearch ? 'visible' : 'invisible'
        )}
      >
        <div className="container px-4 md:px-6">
          <form action="/listings" className="w-full max-w-2xl mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                name="search"
                type="search"
                placeholder="Busca por marca, modelo o palabra clave..."
                className="w-full rounded-full bg-card p-2 pl-10 pr-[6.5rem] shadow-lg h-12 text-base focus:ring-2 focus:ring-primary-foreground/50 border-none"
              />
              <Button type="submit" size="lg" variant="secondary" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-9 shadow-md">
                Buscar
              </Button>
            </div>
          </form>
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
              <form action="/listings">
                 <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                    <Input
                        name="search"
                        type="search"
                        placeholder="Busca por marca, modelo o palabra clave..."
                        className="w-full rounded-full bg-white/90 p-2 pl-10 pr-[6.5rem] shadow-lg text-foreground h-12 text-base focus:ring-2 focus:ring-primary-foreground/50 border-none"
                    />
                    <Button type="submit" size="lg" variant="secondary" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-9 shadow-md">
                        Buscar
                    </Button>
                  </div>
              </form>
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

      <div className="h-4 md:h-6 bg-gradient-to-b from-primary to-background" />

      {featuredVehicles.length > 0 && (
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
              opts={{ align: "start", loop: true }}
              plugins={[autoplayPlugin.current]}
              onMouseEnter={autoplayPlugin.current.stop}
              onMouseLeave={autoplayPlugin.current.reset}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {featuredVehicles.map((vehicle) => (
                  <CarouselItem key={vehicle.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
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
              opts={{ align: "start", loop: true }}
              plugins={[autoplayPlugin.current]}
              onMouseEnter={autoplayPlugin.current.stop}
              onMouseLeave={autoplayPlugin.current.reset}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {showSkeletons 
                  ? [...Array(8)].map((_, i) => (
                      <CarouselItem key={i} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                        <div className="p-1 h-full">
                          <Skeleton className="h-[380px] w-full" />
                        </div>
                      </CarouselItem>
                    ))
                  : latestVehicles.map((vehicle) => (
                      <CarouselItem key={vehicle.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
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
