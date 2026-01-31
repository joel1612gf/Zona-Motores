'use client';

import { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { MapPin, Loader2 } from 'lucide-react';

interface MapLocationFilterProps {
  currentFilter: { lat: number; lon: number; radius: number } | null;
  onApply: (filter: { lat: number; lon: number; radius: number } | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const containerStyle = {
  width: '100%',
  height: '400px',
};

// Center of Venezuela
const defaultCenter = {
  lat: 6.4238,
  lng: -66.5897,
};

const libraries: ('places' | 'drawing' | 'geometry' | 'visualization')[] = ['places'];


export function MapLocationFilter({ currentFilter, onApply, open, onOpenChange }: MapLocationFilterProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isOpen = isControlled ? open : uncontrolledOpen;
  const setIsOpen = isControlled ? onOpenChange : setUncontrolledOpen;

  const [mapInstanceKey, setMapInstanceKey] = useState(Date.now());
  
  // Internal state for the dialog
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<number>(50);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const handleDialogStateChange = (openState: boolean) => {
    if (openState) {
      setMapInstanceKey(Date.now()); 
      
      if (currentFilter) {
        const currentMarker = { lat: currentFilter.lat, lng: currentFilter.lon };
        setMarker(currentMarker);
        setRadius(currentFilter.radius);
        setMapCenter(currentMarker);
      } else {
        setMarker(null);
        setRadius(50);
        setMapCenter(defaultCenter);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setMarker(userLocation);
            setMapCenter(userLocation);
          },
          (error) => {
            console.warn("Could not get user location", error.message);
          }
        );
      }
    }
    setIsOpen(openState);
  };

  const onMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      setMarker({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      });
    }
  }, []);
  
  const handleApply = () => {
    if (marker) {
      onApply({
        lat: marker.lat,
        lon: marker.lng,
        radius: radius,
      });
    } else {
      onApply(null);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onApply(null);
    setIsOpen(false);
  };

  const triggerText = currentFilter 
    ? `Desde: ${currentFilter.lat.toFixed(2)}, ${currentFilter.lon.toFixed(2)} (+${currentFilter.radius}km)`
    : 'Ubicación en Mapa';

  const renderMap = () => {
    if (loadError) {
      return <div className="text-destructive p-4 border border-destructive/50 rounded-md">Error al cargar el mapa. Asegúrate de que la clave de API de Google Maps es correcta y está configurada en el archivo .env</div>;
    }

    if (!isLoaded) {
      return (
        <div className="h-[400px] flex items-center justify-center bg-muted rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-2 text-muted-foreground">Cargando mapa...</p>
        </div>
      );
    }

    return (
      <GoogleMap
        key={mapInstanceKey}
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={marker ? 10 : 5}
        onClick={onMapClick}
        options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
        }}
      >
        {marker && (
          <>
            <Marker position={marker} />
            <Circle
              center={marker}
              radius={radius * 1000} // Radius in meters
              options={{
                strokeColor: 'hsl(var(--primary))',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: 'hsl(var(--primary))',
                fillOpacity: 0.2,
              }}
            />
          </>
        )}
      </GoogleMap>
    );
  };

  const triggerButton = (
    <Button variant="outline" className="w-full justify-start text-left font-normal">
      <MapPin className="mr-2 h-4 w-4" />
      <span className="truncate">{triggerText}</span>
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogStateChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          {triggerButton}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filtrar por Ubicación en el Mapa</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Haz clic en el mapa para seleccionar un punto central y luego ajusta el radio de búsqueda.
          </p>
          <div className='rounded-lg overflow-hidden border'>
            {renderMap()}
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
              disabled={!marker}
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
