'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { VehicleCard } from '@/components/vehicle-card';
import { Filters, type FilterState } from '@/components/filters';
import { Button } from '@/components/ui/button';
import { Grid, List, Search, Filter, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, getDistance } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useFirestore } from '@/firebase';
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
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchTerm = formData.get('search') as string;
    setFilters(prev => ({ ...prev, searchTerm: searchTerm.trim() }));
  };

  const applyClientSideFilters = (vehiclesToFilter: Vehicle[]): Vehicle[] => {
      return vehiclesToFilter.filter(vehicle => {
          const { searchTerm, minYear, maxYear, location } = filters;

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

          // Client-side location filter
          const locationMatch = (() => {
              if (!location) return true;
              const distance = getDistance(location.lat, location.lon, vehicle.location.lat, vehicle.location.lon);
              return distance <= location.radius;
          })();

          return searchMatch && yearMatch && locationMatch;
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
      if (filters.minPrice) q = query(q, where('priceUSD', '>=', parseInt(filters.minPrice, 10)));
      if (filters.maxPrice) q = query(q, where('priceUSD', '<=', parseInt(filters.maxPrice, 10)));

      // Ordering
      if (filters.minPrice || filters.maxPrice) {
        q = query(q, orderBy('priceUSD', 'asc'));
      }
      q = query(q, orderBy('createdAt', 'desc'));
      
      // Pagination
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      q = query(q, limit(PAGE_SIZE));

      const querySnapshot = await getDocs(q);
      const newVehicles = querySnapshot.docs.map(doc => ({ ...doc.data() as Omit<Vehicle, 'id'>, id: doc.id }));
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

      // We apply remaining filters on the client
      const clientFilteredVehicles = applyClientSideFilters(newVehicles);

      setLastDoc(newLastDoc || null);
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
  }, [firestore, filters, lastDoc]);

  // Effect to fetch vehicles when filters change
  useEffect(() => {
      setLastDoc(null); // Reset pagination on filter change
      fetchVehicles(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleLoadMore = () => {
      if (hasMore && !isLoadingMore) {
          fetchVehicles(true);
      }
  };

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
  
  return (
    <div className="container mx-auto py-8 px-2 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1 hidden lg:block">
          <div className="sticky top-20">
            <Filters filters={filters} onFilterChange={setFilters} />
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <h1 className="font-headline text-2xl md:text-3xl font-bold">Todos los Anuncios</h1>
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
                            <div className="py-6 h-full overflow-y-auto">
                                <Filters filters={filters} onFilterChange={setFilters} />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
          </div>
          <form className="flex space-x-2 mb-4 w-full" onSubmit={handleSearchSubmit}>
            <Input
                name="search"
                id="search-input"
                type="search"
                placeholder="Busca por marca, modelo..."
                defaultValue={filters.searchTerm}
                key={filters.searchTerm}
                className="text-base flex-1"
            />
            <Button type="submit">
                <Search className="mr-0 sm:mr-2 h-5 w-5" />
                <span className="hidden sm:inline">Buscar</span>
            </Button>
          </form>

          {shouldShowAveragePrice && (
            <div className="mb-8 text-center">
              <p className="text-sm text-muted-foreground">
                El valor estimado de los vehículos en tu búsqueda es:{" "}
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
              {hasMore && (
                  <div className="mt-8 text-center">
                      <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                          {isLoadingMore ? <Loader2 className="mr-2 animate-spin"/> : null}
                          {isLoadingMore ? 'Cargando...' : 'Cargar más'}
                      </Button>
                  </div>
              )}
              {vehicles.length > 0 && !hasMore && (
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
  );
}


export default function ListingsPage() {
  return (
    <ListingsPageContent />
  )
}
