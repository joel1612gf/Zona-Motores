'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
// import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { vehicles } from '@/lib/data';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bike, Car, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type VehicleType = 'Moto' | 'Carro' | 'Camioneta';

const vehicleTypeOptions: {
  id: VehicleType;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'Moto', name: 'Moto', icon: Bike },
  { id: 'Carro', name: 'Carro', icon: Car },
  { id: 'Camioneta', name: 'Camioneta', icon: Truck },
];

const allMakes = [...new Set(vehicles.map((v) => v.make))].map((make) => ({ label: make, value: make }));

export default function NewListingPage() {
  const router = useRouter();
  const { toast } = useToast();
  // const { user } = useUser(); // Descomentar cuando se reactive el login

  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  const modelsByMake = useMemo(() => {
    if (!selectedBrand) return [];
    const brandModels = vehicles
        .filter(v => v.make === selectedBrand)
        .map(v => v.model);
    return [...new Set(brandModels)].map(model => ({ label: model, value: model }));
  }, [selectedBrand]);

  const getWelcomeMessage = () => {
    // if (user) {
    //   return `Bienvenido ${user.displayName}, ¿qué vehículo quieres publicar el día de hoy?`;
    // }
    return '¿Qué vehículo quieres publicar el día de hoy?';
  };

  const handleNext = () => {
    toast({
      title: "Información Guardada (Demo)",
      description: `Vehículo: ${selectedYear} ${selectedBrand} ${selectedModel}. El siguiente paso sería agregar más detalles.`,
    });
    // En una aplicación real, esto llevaría a la siguiente parte del formulario.
    // Por ahora, redirigimos a la página principal.
    router.push('/');
  }

  const handleTypeSelect = (type: VehicleType) => {
    setSelectedType(type);
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedYear('');
  };

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel('');
    setSelectedYear('');
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setSelectedYear('');
  };

  const getPrompt = () => {
    if (!selectedBrand) {
      return `¿Qué marca es tu ${selectedType?.toLowerCase()}?`;
    }
    if (!selectedModel) {
      return `¿Qué modelo es tu ${selectedBrand}?`;
    }
    return `¿De qué año es tu ${selectedModel}?`;
  };

  return (
    <div className="container max-w-4xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="font-headline text-3xl font-bold">{getWelcomeMessage()}</h1>
      </div>

      <div className="flex justify-center gap-4 mb-12">
        {vehicleTypeOptions.map((type) => {
          const Icon = type.icon;
          return (
            <Button
              key={type.id}
              variant="outline"
              className={cn(
                "h-28 w-40 flex flex-col gap-2 justify-center text-lg font-semibold",
                selectedType === type.id
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground hover:bg-muted/90"
              )}
              onClick={() => handleTypeSelect(type.id)}
            >
              <Icon className="h-10 w-10" />
              <span>{type.name}</span>
            </Button>
          );
        })}
      </div>

      {selectedType && (
        <div className="flex flex-col items-center space-y-8 animate-in fade-in-50 duration-500">
            <div className='flex items-end gap-4'>
                {selectedBrand && (
                    <div className="p-4 border rounded-md bg-muted transition-all animate-in fade-in-0 duration-300">
                        <p className="text-sm text-muted-foreground">Marca</p>
                        <p className="font-semibold">{selectedBrand}</p>
                    </div>
                )}
                {selectedModel && (
                    <div className="p-4 border rounded-md bg-muted transition-all animate-in fade-in-0 duration-300">
                        <p className="text-sm text-muted-foreground">Modelo</p>
                        <p className="font-semibold">{selectedModel}</p>
                    </div>
                )}
                <div>
                    <h2 className="text-xl font-semibold mb-2 text-center">
                        {getPrompt()}
                    </h2>
                    {!selectedBrand ? (
                        <Combobox
                            options={allMakes}
                            value={selectedBrand}
                            onChange={handleBrandChange}
                            placeholder="Selecciona una marca"
                            searchPlaceholder="Buscar marca..."
                            notFoundMessage="No se encontró la marca."
                        />
                    ) : !selectedModel ? (
                        <Combobox
                            options={modelsByMake}
                            value={selectedModel}
                            onChange={handleModelChange}
                            placeholder="Selecciona un modelo"
                            searchPlaceholder="Buscar modelo..."
                            notFoundMessage="No se encontró el modelo."
                        />
                    ) : (
                        <Input 
                            type="number"
                            placeholder="Ej: 2021"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-[200px]"
                            autoFocus
                        />
                    )}
                </div>
            </div>

            {(selectedBrand && selectedModel && selectedYear.length >= 4) && (
                <Button onClick={handleNext} size="lg">
                    Siguiente
                </Button>
            )}
        </div>
      )}
    </div>
  );
}
