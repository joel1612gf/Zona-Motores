'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";
import { vehicles } from '@/lib/data';

export type FilterState = {
  searchTerm: string;
  make: string;
  minPrice: number;
  maxPrice: number;
  location: GeolocationCoordinates | null;
};

type FiltersProps = {
  filters: FilterState;
  onFilterChange: React.Dispatch<React.SetStateAction<FilterState>>;
  initialSearchTerm?: string;
};

const uniqueMakes = ['all', ...Array.from(new Set(vehicles.map(v => v.make)))];

export function Filters({ filters, onFilterChange, initialSearchTerm }: FiltersProps) {
  useEffect(() => {
    if (initialSearchTerm) {
        onFilterChange(prev => ({...prev, searchTerm: initialSearchTerm}));
    }
  }, [initialSearchTerm, onFilterChange]);

  const handlePriceChange = (value: number[]) => {
    onFilterChange({ ...filters, minPrice: value[0], maxPrice: value[1] });
  };

  const resetFilters = () => {
    onFilterChange({
      searchTerm: '',
      make: 'all',
      minPrice: 0,
      maxPrice: 100000,
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
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder="Ej: Corolla, 4x4..."
              value={filters.searchTerm}
              onChange={(e) => onFilterChange({ ...filters, searchTerm: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="make">Marca</Label>
            <Select
              value={filters.make}
              onValueChange={(value) => onFilterChange({ ...filters, make: value })}
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
            <Label>Rango de Precio (USD)</Label>
            <Slider
              min={0}
              max={100000}
              step={1000}
              value={[filters.minPrice, filters.maxPrice]}
              onValueChange={handlePriceChange}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>${filters.minPrice.toLocaleString()}</span>
              <span>${filters.maxPrice >= 100000 ? '100k+' : '$' + filters.maxPrice.toLocaleString()}</span>
            </div>
          </div>
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
