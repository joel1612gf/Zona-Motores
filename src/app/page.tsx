'use client';

import Link from 'next/link';
import Image from 'next/image';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useVehicles, VehicleProvider } from '@/context/vehicle-context';
import { VehicleCard } from '@/components/vehicle-card';
import { Store, Loader2, MapPin } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { SearchWithHistory } from '@/components/search-with-history';
import { useRouter } from 'next/navigation';
import { MapsProvider } from '@/components/maps-provider';
import { Map, AdvancedMarker, InfoWindow, useMap, Pin } from '@vis.gl/react-google-maps';
import type { Vehicle } from '@/lib/types';

const VENEZUELA_CENTER = { lat: 7.5, lng: -66.0 };

function VehicleMapSection({ vehicles }: { vehicles: Vehicle[] }) {
  const [selectedVehicle, setSelectedVehicle] = React.useState<Vehicle | null>(null);

  const vehiclesWithLocation = React.useMemo(
    () => vehicles.filter(v => v.location?.lat && v.location?.lon),
    [vehicles]
  );

  if (vehiclesWithLocation.length === 0) return null;

  return (
    <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1 text-sm">
            <MapPin className="h-3.5 w-3.5" />
            Mapa
          </div>
          <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
            Vehículos en Todo Venezuela
          </h2>
          <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Explora vehículos disponibles cerca de ti. Haz clic en un marcador para ver los detalles.
          </p>
        </div>

        <div className="relative rounded-xl overflow-hidden border shadow-lg">
          <MapsProvider>
            <Map
              defaultCenter={VENEZUELA_CENTER}
              defaultZoom={6}
              mapId="vehicle-map-dark"
              gestureHandling="cooperative"
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={true}
              style={{ width: '100%', height: '500px' }}
              onClick={() => setSelectedVehicle(null)}
            >
              {vehiclesWithLocation.map(vehicle => (
                <AdvancedMarker
                  key={vehicle.id}
                  position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                  onClick={() => setSelectedVehicle(vehicle)}
                >
                  <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="white" />
                </AdvancedMarker>
              ))}

              {selectedVehicle && (
                <InfoWindow
                  position={{ lat: selectedVehicle.location.lat, lng: selectedVehicle.location.lon }}
                  onCloseClick={() => setSelectedVehicle(null)}
                  pixelOffset={[0, -40]}
                >
                  <Link
                    href={`/listings/${selectedVehicle.id}`}
                    className="flex gap-3 p-1 min-w-[220px] no-underline text-inherit"
                  >
                    <div className="relative w-20 h-16 flex-shrink-0 rounded overflow-hidden">
                      <Image
                        src={selectedVehicle.images[0]?.url}
                        alt={selectedVehicle.images[0]?.alt || 'Vehicle'}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <p className="font-semibold text-sm truncate text-gray-900">
                        {`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
                      </p>
                      <p className="text-sm font-bold text-blue-600">
                        {formatCurrency(selectedVehicle.priceUSD)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {selectedVehicle.location.city}, {selectedVehicle.location.state}
                      </p>
                    </div>
                  </Link>
                </InfoWindow>
              )}
            </Map>
          </MapsProvider>

          {/* Vehicle count badge */}
          <div className="absolute top-4 left-4 z-10">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-md text-sm px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary" />
              {vehiclesWithLocation.length} vehículos disponibles
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomePageContent() {
  const { vehicles, isLoading } = useVehicles();
  const [isClient, setIsClient] = React.useState(false);
  const [showStickySearch, setShowStickySearch] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const heroSearchRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Dynamically import autoplay to reduce initial bundle
  const [AutoplayPlugin, setAutoplayPlugin] = React.useState<any>(null);
  React.useEffect(() => {
    import('embla-carousel-autoplay').then(mod => {
      setAutoplayPlugin(() => mod.default);
    });
  }, []);

  const handleSearch = (term: string) => {
    router.push(`/listings?search=${encodeURIComponent(term)}`);
  }

  const handleNavClick = () => {
    setIsNavigating(true);
  };

  React.useEffect(() => {
    setIsClient(true);

    const headerHeight = 64;

    const handleScroll = () => {
      if (heroSearchRef.current) {
        if (heroSearchRef.current.getBoundingClientRect().top <= headerHeight) {
          setShowStickySearch(true);
        } else {
          setShowStickySearch(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const promotedVehicles = React.useMemo(() => {
    if (isClient) {
      return vehicles.filter(v => v.promotionExpiresAt && v.promotionExpiresAt.toDate() > new Date());
    }
    return [];
  }, [isClient, vehicles]);

  const latestVehicles = React.useMemo(() => {
    if (isClient) {
      const promotedIds = new Set(promotedVehicles.map(v => v.id));
      return vehicles.filter(v => !promotedIds.has(v.id)).slice(0, 8);
    }
    return [];
  }, [isClient, vehicles, promotedVehicles]);

  const showSkeletons = isLoading || !isClient;

  const autoplayPluginPromoted = React.useRef<any>(null);
  const autoplayPluginLatest = React.useRef<any>(null);
  if (AutoplayPlugin && !autoplayPluginPromoted.current) {
    autoplayPluginPromoted.current = AutoplayPlugin({ delay: 5000, stopOnInteraction: true, stopOnLastSnap: true });
  }
  if (AutoplayPlugin && !autoplayPluginLatest.current) {
    autoplayPluginLatest.current = AutoplayPlugin({ delay: 5000, stopOnInteraction: true, stopOnLastSnap: true });
  }

  const promotedCarouselPlugins = autoplayPluginPromoted.current ? [autoplayPluginPromoted.current] : [];
  const latestCarouselPlugins = autoplayPluginLatest.current ? [autoplayPluginLatest.current] : [];
  const handlePromotedMouseEnter = autoplayPluginPromoted.current?.stop;
  const handlePromotedMouseLeave = autoplayPluginPromoted.current?.reset;
  const handleLatestMouseEnter = autoplayPluginLatest.current?.stop;
  const handleLatestMouseLeave = autoplayPluginLatest.current?.reset;

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
              <Button asChild size="lg" variant="secondary" onClick={handleNavClick} disabled={isNavigating}>
                <Link href="/listings">
                  {isNavigating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ver Todos los Anuncios
                </Link>
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

      <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
        {((isClient && promotedVehicles.length > 0) || showSkeletons) && (
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
              opts={{ align: "center" }}
              plugins={promotedCarouselPlugins}
              onMouseEnter={handlePromotedMouseEnter}
              onMouseLeave={handlePromotedMouseLeave}
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
        )}
      </section>

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
            opts={{ align: "center" }}
            plugins={latestCarouselPlugins}
            onMouseEnter={handleLatestMouseEnter}
            onMouseLeave={handleLatestMouseLeave}
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
            <Button asChild size="lg" onClick={handleNavClick} disabled={isNavigating}>
              <Link href="/listings">
                {isNavigating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ver todos los vehículos
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Vehicle Map Section */}
      {isClient && !showSkeletons && vehicles.length > 0 && (
        <VehicleMapSection vehicles={vehicles} />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <VehicleProvider>
      <HomePageContent />
    </VehicleProvider>
  )
}

