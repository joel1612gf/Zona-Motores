'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Vehicle } from '@/lib/types';
import { vehicles as initialVehicles } from '@/lib/data';

type VehicleContextType = {
  vehicles: Vehicle[];
  addVehicle: (vehicle: Vehicle) => void;
};

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export function VehicleProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);

  const addVehicle = useCallback((vehicle: Vehicle) => {
    // Add to the beginning of the list to see it first
    setVehicles(prevVehicles => [vehicle, ...prevVehicles]);
  }, []);

  return (
    <VehicleContext.Provider value={{ vehicles, addVehicle }}>
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicles() {
  const context = useContext(VehicleContext);
  if (context === undefined) {
    throw new Error('useVehicles must be used within a VehicleProvider');
  }
  return context;
}
