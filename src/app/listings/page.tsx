'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVehicles } from '@/context/vehicle-context';
import { VehicleCard } from '@/components/vehicle-card';
import { Filters, type FilterState } from '@/components/filters';
import { Button } from '@/components/ui/button';
import { Grid, List, Info, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';

function ListingsPageContent() {
  const { vehicles: allVehicles, isLoading } = useVehicles();
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
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchTerm = formData.get('search') as string;
    setFilters(prev => ({ ...prev, searchTerm: searchTerm.trim() }));
  };

  const filteredVehicles = useMemo(() => {
    return allVehicles.filter(vehicle => {
      const { searchTerm, make, model, minPrice, maxPrice, minYear, maxYear, bodyType, transmission } = filters;
      
      const searchMatch = (() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (normalizedSearch === '') return true;

        const vehicleText = [
            vehicle.make,
            vehicle.model,
            vehicle.year.toString(),
            vehicle.description,
            vehicle.bodyType,
            vehicle.transmission,
            vehicle.exteriorColor,
            vehicle.engine,
            vehicle.is4x4 ? '4x4' : '',
            vehicle.hasAC ? 'aire acondicionado ac' : '',
            vehicle.hasSoundSystem ? 'sonido' : '',
            vehicle.acceptsTradeIn ? 'acepta cambio trueque' : '',
            vehicle.isSignatory ? 'firmante dueño directo' : ''
        ].join(' ').toLowerCase();
        
        const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0);

        return searchWords.every(word => vehicleText.includes(word));
      })();
      
      const makeMatch = make === 'all' || vehicle.make === make;
      
      const modelMatch = model === 'all' || vehicle.model === model;

      const minPriceNum = minPrice ? parseInt(minPrice, 10) : 0;
      const maxPriceNum = maxPrice ? parseInt(maxPrice, 10) : Infinity;
      const priceMatch = vehicle.priceUSD >= minPriceNum && vehicle.priceUSD <= maxPriceNum;
      
      const minYearNum = minYear ? parseInt(minYear, 10) : 0;
      const maxYearNum = maxYear ? parseInt(maxYear, 10) : Infinity;
      const yearMatch = vehicle.year >= minYearNum && vehicle.year <= maxYearNum;

      const bodyTypeMatch = bodyType === 'all' || vehicle.bodyType === bodyType;

      const transmissionMatch = transmission === 'all' || vehicle.transmission === transmission;

      // A real implementation would use the location filter to sort or filter by distance.
      // This is a placeholder for that functionality.

      return searchMatch && makeMatch && modelMatch && priceMatch && yearMatch && bodyTypeMatch && transmissionMatch;
    });
  }, [filters, allVehicles]);

  const averagePrice = useMemo(() => {
    if (filteredVehicles.length < 2) {
      return null;
    }
    const totalPrice = filteredVehicles.reduce((sum, vehicle) => sum + vehicle.priceUSD, 0);
    return totalPrice / filteredVehicles.length;
  }, [filteredVehicles]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <Filters filters={filters} onFilterChange={setFilters} />
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <h1 className="font-headline text-3xl font-bold">Todos los Anuncios ({filteredVehicles.length})</h1>
            <div className="hidden sm:flex items-center gap-2">
              <Button variant={layout === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('grid')} aria-label="Vista de cuadrícula">
                <Grid className="h-4 w-4" />
              </Button>
              <Button variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setLayout('list')} aria-label="Vista de lista">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <form className="flex space-x-2 mb-8 max-w-xl mx-auto" onSubmit={handleSearchSubmit}>
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
                <Search className="mr-2 h-5 w-5" />
                Buscar
            </Button>
          </form>
          {averagePrice && (
            <div className="mb-6 p-4 border-l-4 border-primary bg-primary/10 rounded-r-lg" role="alert">
              <div className="flex">
                <Info className="h-5 w-5 text-primary mr-3 mt-1 flex-shrink-0" />
                <div>
                    <p className="font-semibold">
                        Precio Promedio de Referencia: 
                        <span className="font-headline text-2xl font-bold text-primary ml-2">{formatCurrency(averagePrice)}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Basado en {filteredVehicles.length} vehículos que coinciden con tu búsqueda.
                    </p>
                </div>
              </div>
            </div>
          )}
          {filteredVehicles.length > 0 ? (
            <div className={`gap-6 ${layout === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col'}`}>
              {filteredVehicles.map(vehicle => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
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

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-1">
          <div className="sticky top-20">
             <Skeleton className="h-[700px] w-full" />
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-48" />
            <div className="hidden sm:flex items-center gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
           <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
             {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[380px] w-full" />)}
           </div>
        </div>
      </div>
    </div>
  )
}

export default function ListingsPage() {
  return (
    // Suspense is no longer needed as we handle loading state inside
    <ListingsPageContent />
  )
}
