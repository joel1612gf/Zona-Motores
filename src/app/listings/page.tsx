'use client';

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { VehicleCard } from '@/components/vehicle-card';
import { Filters, type FilterState } from '@/components/filters';
import { Button } from '@/components/ui/button';
import { Grid, List, Search, Filter, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, getDistance } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useFirestore } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogTitleComponent,
} from "@/components/ui/alert-dialog";
import { MapLocationFilter } from '@/components/map-location-filter';
import {
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
  DocumentData,
  Query
} from 'firebase/firestore';
import type { Vehicle } from '@/lib/types';
import { SearchWithHistory } from '@/components/search-with-history';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

function ListingsPageContent() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const initialSearchTerm = searchParams.get('search') || '';

  const [filters, setFilters] = useState<FilterState>({
    searchTerm: initialSearchTerm,
    make: 'all',
    model: 'all',
    minPrice: '',
    maxPrice: '',
    minYear: '',
    maxYear: '',
    bodyType: 'all',
    transmission: 'all',
    location: null,
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const lastDocRef = useRef<DocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const loaderRef = useRef(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [showStickySearch, setShowStickySearch] = useState(false);

  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [isMapFilterOpen, setIsMapFilterOpen] = useState(false);

  useEffect(() => {
    const promptShown = sessionStorage.getItem('locationPromptShown');
    if (promptShown) {
      return;
    }

    const timer = setTimeout(() => {
      if (!filters.location) {
        setIsLocationPromptOpen(true);
        sessionStorage.setItem('locationPromptShown', 'true');
      }
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const headerHeight = 64; // Corresponds to h-16 in tailwind

    const handleScroll = () => {
      if (searchRef.current) {
        if (searchRef.current.getBoundingClientRect().top <= headerHeight) {
          setShowStickySearch(true);
        } else {
          setShowStickySearch(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Run on mount

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const applyClientSideFilters = (vehiclesToFilter: Vehicle[]): Vehicle[] => {
    return vehiclesToFilter.filter(vehicle => {
      const { searchTerm, minYear, maxYear, location, minPrice, maxPrice } = filters;

      // Client-side search (on the fetched batch)
      const searchMatch = (() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (normalizedSearch === '') return true;
        const vehicleText = [
          vehicle.make, vehicle.model, vehicle.year.toString(),
          vehicle.description, vehicle.bodyType, vehicle.transmission,
          vehicle.exteriorColor, vehicle.engine, vehicle.seller.displayName,
          vehicle.is4x4 ? '4x4' : '', vehicle.hasAC ? 'aire acondicionado ac' : '',
          vehicle.hasSoundSystem ? 'sonido' : '', vehicle.acceptsTradeIn ? 'acepta cambio trueque' : ''
        ].join(' ').toLowerCase();
        const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0);
        return searchWords.every(word => vehicleText.includes(word));
      })();

      // Client-side year filter
      const minYearNum = minYear ? parseInt(minYear, 10) : 0;
      const maxYearNum = maxYear ? parseInt(maxYear, 10) : Infinity;
      const yearMatch = vehicle.year >= minYearNum && vehicle.year <= maxYearNum;

      // Client-side price filter
      const minPriceNum = minPrice ? parseInt(minPrice, 10) : 0;
      const maxPriceNum = maxPrice ? parseInt(maxPrice, 10) : Infinity;
      const priceMatch = vehicle.priceUSD >= minPriceNum && vehicle.priceUSD <= maxPriceNum;

      // Client-side location filter
      const locationMatch = (() => {
        if (!location) return true;
        const distance = getDistance(location.lat, location.lon, vehicle.location.lat, vehicle.location.lon);
        return distance <= location.radius;
      })();

      return searchMatch && yearMatch && priceMatch && locationMatch;
    });
  };

  const fetchVehicles = useCallback(async (loadMore = false) => {
    if (!firestore) return;

    if (loadMore) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      let q: Query<DocumentData> = query(
        collectionGroup(firestore, 'vehicleListings'),
        where('status', '==', 'active')
      );

      // Server-side filters
      if (filters.make !== 'all') q = query(q, where('make', '==', filters.make));
      if (filters.model !== 'all') q = query(q, where('model', '==', filters.model));
      if (filters.bodyType !== 'all') q = query(q, where('bodyType', '==', filters.bodyType));
      if (filters.transmission !== 'all') q = query(q, where('transmission', '==', filters.transmission));

      // Ordering: By creation date.
      q = query(q, orderBy('createdAt', 'desc'));

      // Pagination
      if (loadMore && lastDocRef.current) {
        q = query(q, startAfter(lastDocRef.current));
      }
      q = query(q, limit(PAGE_SIZE));

      const querySnapshot = await getDocs(q);
      const newVehicles = querySnapshot.docs.map(doc => ({ ...doc.data() as Omit<Vehicle, 'id'>, id: doc.id }));
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

      // We apply remaining filters on the client
      const clientFilteredVehicles = applyClientSideFilters(newVehicles);

      lastDocRef.current = newLastDoc || null;
      setHasMore(querySnapshot.docs.length === PAGE_SIZE);

      if (loadMore) {
        setVehicles(prev => [...prev, ...clientFilteredVehicles]);
      } else {
        setVehicles(clientFilteredVehicles);
      }

    } catch (error) {
      console.error("Error fetching vehicles:", error);
      // Inform the user about potential index issues.
      if (error instanceof Error && error.message.includes('firestore/failed-precondition')) {
        console.error("This query requires a Firestore index. Please check the developer console for a link to create it.");
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [firestore, filters]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      fetchVehicles(true);
    }
  }, [hasMore, isLoadingMore, fetchVehicles]);


  // Effect to fetch vehicles when filters change
  useEffect(() => {
    lastDocRef.current = null; // Reset pagination on filter change
    fetchVehicles(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 1.0 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [handleLoadMore, hasMore, isLoadingMore]);


  const averagePrice = useMemo(() => {
    if (vehicles.length < 2) return null;
    const totalPrice = vehicles.reduce((sum, vehicle) => sum + vehicle.priceUSD, 0);
    return totalPrice / vehicles.length;
  }, [vehicles]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.make !== 'all') count++;
    if (filters.model !== 'all') count++;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.minYear) count++;
    if (filters.maxYear) count++;
    if (filters.bodyType !== 'all') count++;
    if (filters.transmission !== 'all') count++;
    if (filters.location) count++;
    return count;
  }, [filters]);

  const shouldShowAveragePrice = averagePrice && (filters.searchTerm.trim() !== '' || activeFilterCount >= 2);

  const handleLocationFilterApply = (location: FilterState['location']) => {
    setFilters(prev => ({ ...prev, location }));
    setIsMapFilterOpen(false);
  };

  const handleSearch = (term: string) => {
    setFilters(prev => ({ ...prev, searchTerm: term }));
  };

  return (
    <>
      <AlertDialog open={isLocationPromptOpen} onOpenChange={setIsLocationPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitleComponent>¿Ver publicaciones cerca de ti?</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Actualmente estás viendo anuncios de todo el país. Activa el filtro de ubicación para encontrar vehículos más cercanos a ti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, gracias</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setIsLocationPromptOpen(false);
              setIsMapFilterOpen(true);
            }}>
              Sí, buscar cerca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MapLocationFilter
        currentFilter={filters.location}
        onApply={handleLocationFilterApply}
        open={isMapFilterOpen}
        onOpenChange={setIsMapFilterOpen}
      />

      <div
        className={cn(
          'fixed top-16 left-0 right-0 z-40 bg-primary py-3 shadow-md transition-transform duration-300',
          showStickySearch ? 'translate-y-0 pointer-events-auto' : '-translate-y-full pointer-events-none overflow-hidden'
        )}
      >
        <div className="container px-4 md:px-6">
          <SearchWithHistory
            initialValue={filters.searchTerm}
            onSearch={handleSearch}
            className="w-full max-w-2xl mx-auto"
            forceClose={!showStickySearch}
          />
        </div>
      </div>

      <div className="container mx-auto py-8 px-2 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-20">
              <Filters filters={filters} onFilterChange={setFilters} />
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-6">
              <h1 className="flex-1 text-center lg:text-left font-headline text-2xl md:text-3xl font-bold">
                Todos los Anuncios
              </h1>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2">
                  <Button variant={layout === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('grid')} aria-label="Vista de cuadrícula">
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('list')} aria-label="Vista de lista">
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <div className="lg:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filtros
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] sm:w-[340px]">
                      <SheetHeader>
                        <SheetTitle className="sr-only">Filtros</SheetTitle>
                      </SheetHeader>
                      <div className="py-6 h-full overflow-y-auto">
                        <Filters filters={filters} onFilterChange={setFilters} />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>
            <div className="mb-4" ref={searchRef}>
              <SearchWithHistory
                initialValue={filters.searchTerm}
                onSearch={handleSearch}
                inputClassName="bg-card"
                buttonClassName="bg-primary text-primary-foreground"
              />
            </div>


            {shouldShowAveragePrice && (
              <div className="mb-8 text-center">
                <p className="text-sm text-muted-foreground">
                  El valor promedio de los vehículos en tu búsqueda es:{" "}
                  <span className="font-bold text-foreground">{formatCurrency(averagePrice)}</span>
                </p>
              </div>
            )}

            {isLoading ? (
              <div className={`gap-2 sm:gap-6 ${layout === 'grid' ? 'grid grid-cols-2 xl:grid-cols-3' : 'flex flex-col'}`}>
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[300px] sm:h-[380px] w-full" />)}
              </div>
            ) : vehicles.length > 0 ? (
              <>
                <div className={`gap-2 sm:gap-6 ${layout === 'grid' ? 'grid grid-cols-2 xl:grid-cols-3' : 'flex flex-col'}`}>
                  {vehicles.map(vehicle => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </div>
                <div ref={loaderRef} className="mt-8 flex justify-center py-4">
                  {hasMore && isLoadingMore && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                </div>
                {!isLoading && !hasMore && (
                  <p className="text-center text-muted-foreground mt-8">Has llegado al final de los resultados.</p>
                )}
              </>
            ) : (
              <div className="text-center py-16 border rounded-lg bg-card">
                <h2 className="text-2xl font-semibold font-headline">No se encontraron vehículos</h2>
                <p className="text-muted-foreground mt-2">Intenta ajustar tus filtros de búsqueda.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ListingsPageFallback() {
  return (
    <div className="container mx-auto py-8 px-2 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1 hidden lg:block">
          <Skeleton className="h-[400px] w-full" />
        </div>
        <div className="lg:col-span-3">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[300px] sm:h-[380px] w-full" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<ListingsPageFallback />}>
      <ListingsPageContent />
    </Suspense>
  )
}
