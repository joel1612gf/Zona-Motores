'use client';

import { useState, useCallback, useEffect } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { MapPin, Loader2 } from 'lucide-react';

interface MapCircleProps extends google.maps.CircleOptions {
  center: google.maps.LatLngLiteral;
}

function MapCircle(props: MapCircleProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({
      ...props,
      map,
    });
    return () => circle.setMap(null);
  }, [map, props]);

  return null;
}


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

export function MapLocationFilter({ currentFilter, onApply, open, onOpenChange }: MapLocationFilterProps) {
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isOpen = isControlled ? open : uncontrolledOpen;
  const setIsOpen = isControlled ? onOpenChange ?? setUncontrolledOpen : setUncontrolledOpen;

  const [mapInstanceKey, setMapInstanceKey] = useState(Date.now());
  
  // Internal state for the dialog
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<number>(50);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const handleDialogStateChange = (openState: boolean) => {
    if (openState) {
      setMapInstanceKey(Date.now()); 
      
      setRadius(currentFilter?.radius || 50);

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
          if (currentFilter) {
            const currentMarker = { lat: currentFilter.lat, lng: currentFilter.lon };
            setMarker(currentMarker);
            setMapCenter(currentMarker);
          } else {
            setMarker(null);
            setMapCenter(defaultCenter);
          }
        }
      );
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
    return (
        <Map
            key={mapInstanceKey}
            mapId="map_location_filter"
            defaultCenter={mapCenter}
            defaultZoom={marker ? 10 : 5}
            onClick={onMapClick}
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
            className="w-full h-full"
        >
            {marker && (
            <>
                <AdvancedMarker position={marker} />
                <MapCircle
                    center={marker}
                    radius={radius * 1000} // Radius in meters
                    strokeColor='hsl(var(--primary))'
                    strokeOpacity={0.8}
                    strokeWeight={2}
                    fillColor='hsl(var(--primary))'
                    fillOpacity={0.2}
                />
            </>
            )}
      </Map>
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
          <div className='rounded-lg overflow-hidden border h-[400px]'>
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
