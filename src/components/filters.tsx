'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin, X, Search } from "lucide-react";
import { vehicles } from '@/lib/data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

export type FilterState = {
  searchTerm: string;
  make: string;
  model: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  bodyType: string;
  transmission: string;
  location: GeolocationCoordinates | null;
};

type FiltersProps = {
  filters: FilterState;
  onFilterChange: React.Dispatch<React.SetStateAction<FilterState>>;
  initialSearchTerm?: string;
};

const uniqueMakes = ['all', ...Array.from(new Set(vehicles.map(v => v.make)))];
const uniqueBodyTypes = ['all', ...Array.from(new Set(vehicles.map(v => v.bodyType)))];
const transmissionTypes = ['all', 'Automática', 'Sincrónica'];

export function Filters({ filters, onFilterChange, initialSearchTerm }: FiltersProps) {
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    if (initialSearchTerm) {
        onFilterChange(prev => ({...prev, searchTerm: initialSearchTerm}));
    }
  }, [initialSearchTerm, onFilterChange]);
  
  useEffect(() => {
    if (filters.make && filters.make !== 'all') {
      const makeModels = [...new Set(vehicles.filter(v => v.make === filters.make).map(v => v.model))];
      setModels(makeModels);
    } else {
      setModels([]);
    }
    onFilterChange(prev => ({...prev, model: 'all'}));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.make]);


  const handleInputChange = (field: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const resetFilters = () => {
    onFilterChange({
      searchTerm: '',
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
  };

  const handleLocationSearch = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onFilterChange({ ...filters, location: position.coords });
        },
        (error) => {
          console.error("Error getting location: ", error);
          alert("No se pudo obtener tu ubicación. Por favor, activa los servicios de ubicación en tu navegador.");
        }
      );
    } else {
      alert("La geolocalización no es compatible con este navegador.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Filtros</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Limpiar
            <X className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-input">Búsqueda</Label>
            <div className="relative">
                <Input
                    id="search-input"
                    placeholder="Busca por marca, modelo..."
                    value={filters.searchTerm}
                    onChange={(e) => handleInputChange('searchTerm', e.target.value)}
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <Accordion type="multiple" defaultValue={['make', 'price', 'year']} className="w-full">
            <AccordionItem value="make">
              <AccordionTrigger className="py-2 text-base">Marca y Modelo</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                 <div className="space-y-2">
                  <Label htmlFor="make">Marca</Label>
                  <Select
                    value={filters.make}
                    onValueChange={(value) => handleInputChange('make', value)}
                  >
                    <SelectTrigger id="make">
                      <SelectValue placeholder="Todas las Marcas" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueMakes.map(make => (
                        <SelectItem key={make} value={make}>{make === 'all' ? 'Todas las Marcas' : make}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Select
                    value={filters.model}
                    onValueChange={(value) => handleInputChange('model', value)}
                    disabled={!filters.make || filters.make === 'all'}
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Todos los Modelos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Modelos</SelectItem>
                      {models.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="price">
              <AccordionTrigger className="py-2 text-base">Precio (USD)</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="min-price">Mínimo</Label>
                    <Input
                      id="min-price"
                      type="number"
                      placeholder="Ej: 5000"
                      value={filters.minPrice}
                      onChange={(e) => handleInputChange('minPrice', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-price">Máximo</Label>
                    <Input
                      id="max-price"
                      type="number"
                      placeholder="Ej: 40000"
                      value={filters.maxPrice}
                      onChange={(e) => handleInputChange('maxPrice', e.target.value)}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="year">
                <AccordionTrigger className="py-2 text-base">Año</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                    <div className="flex gap-2">
                        <div className="space-y-2">
                            <Label htmlFor="min-year">Desde</Label>
                            <Input
                                id="min-year"
                                type="number"
                                placeholder="Ej: 2010"
                                value={filters.minYear}
                                onChange={(e) => handleInputChange('minYear', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max-year">Hasta</Label>
                            <Input
                                id="max-year"
                                type="number"
                                placeholder={`Ej: ${new Date().getFullYear()}`}
                                value={filters.maxYear}
                                onChange={(e) => handleInputChange('maxYear', e.target.value)}
                            />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="other">
              <AccordionTrigger className="py-2 text-base">Otras Características</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                 <div className="space-y-2">
                  <Label htmlFor="bodyType">Tipo de Vehículo</Label>
                  <Select
                    value={filters.bodyType}
                    onValueChange={(value) => handleInputChange('bodyType', value)}
                  >
                    <SelectTrigger id="bodyType">
                      <SelectValue placeholder="Todos los Tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueBodyTypes.map(type => (
                        <SelectItem key={type} value={type}>{type === 'all' ? 'Todos los Tipos' : type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transmission">Transmisión</Label>
                  <Select
                    value={filters.transmission}
                    onValueChange={(value) => handleInputChange('transmission', value)}
                  >
                    <SelectTrigger id="transmission">
                      <SelectValue placeholder="Cualquier Transmisión" />
                    </SelectTrigger>
                    <SelectContent>
                      {transmissionTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type === 'all' ? 'Cualquiera' : type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button variant="secondary" className="w-full" onClick={handleLocationSearch}>
            <MapPin className="mr-2 h-4 w-4" />
            Buscar Vehículos Cerca de Mí
          </Button>
           {filters.location && (
              <p className="text-xs text-muted-foreground text-center">
                Usando ubicación: Lat: {filters.location.latitude.toFixed(2)}, Lon: {filters.location.longitude.toFixed(2)}
              </p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
