'use client';

import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import locations from '@/lib/venezuela-locations.json';
import { MapPin } from 'lucide-react';

interface LocationFilterProps {
  currentLocation: { city: string; state: string; lat: number; lon: number, radius: number } | null;
  onApply: (filter: { city: string; state: string; lat: number; lon: number, radius: number } | null) => void;
}

type Location = {
    estado: string;
    ciudades: { ciudad: string; lat: number; lon: number; }[];
}

const typedLocations: Location[] = locations;

export function LocationFilterDialog({ currentLocation, onApply }: LocationFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedState, setSelectedState] = useState<string>(currentLocation?.state || '');
  const [selectedCity, setSelectedCity] = useState<string>(currentLocation?.city || '');
  const [radius, setRadius] = useState<number>(currentLocation?.radius || 50);

  const states = useMemo(() => typedLocations.map(l => l.estado).sort((a,b) => a.localeCompare(b)), []);
  const cities = useMemo(() => {
    if (!selectedState) return [];
    const stateData = typedLocations.find(l => l.estado === selectedState);
    return stateData?.ciudades.sort((a,b) => a.ciudad.localeCompare(b.ciudad)) || [];
  }, [selectedState]);
  
  const handleApply = () => {
    if (!selectedState || !selectedCity) {
        onApply(null);
        setIsOpen(false);
        return;
    }
    const stateData = typedLocations.find(l => l.estado === selectedState);
    const cityData = stateData?.ciudades.find(c => c.ciudad === selectedCity);
    if (cityData) {
      onApply({
        state: selectedState,
        city: selectedCity,
        lat: cityData.lat,
        lon: cityData.lon,
        radius: radius,
      });
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedState('');
    setSelectedCity('');
    setRadius(50);
    onApply(null);
    setIsOpen(false);
  };

  const triggerText = currentLocation 
    ? `${currentLocation.city}, ${currentLocation.state} (+${currentLocation.radius}km)`
    : 'Ubicación';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal">
          <MapPin className="mr-2 h-4 w-4" />
          <span className="truncate">{triggerText}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filtrar por Ubicación</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Select value={selectedState} onValueChange={(value) => { setSelectedState(value); setSelectedCity(''); }}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                {states.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedState}>
              <SelectTrigger id="city">
                <SelectValue placeholder="Selecciona una ciudad" />
              </SelectTrigger>
              <SelectContent>
                {cities.map(city => <SelectItem key={city.ciudad} value={city.ciudad}>{city.ciudad}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="radius">Radio ({radius} km)</Label>
            <Slider
              id="radius"
              min={1}
              max={200}
              step={1}
              value={[radius]}
              onValueChange={(value) => setRadius(value[0])}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={handleClear}>Limpiar Filtro</Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleApply}>Aplicar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
