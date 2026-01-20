'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, X } from "lucide-react";
import { vehicles } from '@/lib/data';
import { useCurrency } from '@/context/currency-context';

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
  const { bcvRate, setBcvRate } = useCurrency();
  const [rateInput, setRateInput] = useState(bcvRate.toString());

  useEffect(() => {
    if (initialSearchTerm) {
        onFilterChange(prev => ({...prev, searchTerm: initialSearchTerm}));
    }
  }, [initialSearchTerm, onFilterChange]);

  useEffect(() => {
    setRateInput(bcvRate.toString());
  }, [bcvRate]);


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
          alert("Could not get your location. Please enable location services in your browser.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="e.g., Corolla, 4x4..."
              value={filters.searchTerm}
              onChange={(e) => onFilterChange({ ...filters, searchTerm: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="make">Make</Label>
            <Select
              value={filters.make}
              onValueChange={(value) => onFilterChange({ ...filters, make: value })}
            >
              <SelectTrigger id="make">
                <SelectValue placeholder="All Makes" />
              </SelectTrigger>
              <SelectContent>
                {uniqueMakes.map(make => (
                  <SelectItem key={make} value={make}>{make === 'all' ? 'All Makes' : make}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price Range (USD)</Label>
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
            Find Vehicles Near Me
          </Button>
           {filters.location && (
              <p className="text-xs text-muted-foreground text-center">
                Using location: Lat: {filters.location.latitude.toFixed(2)}, Lon: {filters.location.longitude.toFixed(2)}
              </p>
            )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Currency Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current rate: 1 USD = {bcvRate.toFixed(2)} VES
          </p>
          <div className="space-y-2">
            <Label htmlFor="bcv-rate">Set BCV Rate</Label>
            <div className="flex gap-2">
              <Input
                id="bcv-rate"
                type="number"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                onBlur={() => setBcvRate(parseFloat(rateInput) || bcvRate)}
              />
              <Button onClick={() => setBcvRate(parseFloat(rateInput) || bcvRate)} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is a demo tool. In a real app, this would be updated automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
