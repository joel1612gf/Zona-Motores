'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
// import { useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { vehicles } from '@/lib/data';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type VehicleType = 'Moto' | 'Carro' | 'Camioneta';

const vehicleTypeOptions: {
  id: VehicleType;
  name: string;
  imageId: string;
}[] = [
  { id: 'Moto', name: 'Moto', imageId: 'motorcycle-new' },
  { id: 'Carro', name: 'Carro', imageId: 'car-new' },
  { id: 'Camioneta', name: 'Camioneta', imageId: 'truck-new' },
];

const allMakes = [...new Set(vehicles.map((v) => v.make))].map((make) => ({ label: make, value: make }));

export default function NewListingPage() {
  const router = useRouter();
  const { toast } = useToast();
  // const { user } = useUser(); // Descomentar cuando se reactive el login

  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const getWelcomeMessage = () => {
    // if (user) {
    //   return `Bienvenido ${user.displayName}, ¿qué vehículo quieres publicar el día de hoy?`;
    // }
    return '¿Qué vehículo quieres publicar el día de hoy?';
  };

  const handleNext = () => {
    toast({
      title: "Información Guardada (Demo)",
      description: `Vehículo: ${selectedType} ${selectedBrand} ${selectedModel}. El siguiente paso sería agregar más detalles.`,
    });
    // En una aplicación real, esto llevaría a la siguiente parte del formulario.
    // Por ahora, redirigimos a la página principal.
    router.push('/');
  }

  return (
    <div className="container max-w-4xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="font-headline text-3xl font-bold">{getWelcomeMessage()}</h1>
      </div>

      {!selectedType ? (
        <div className="grid md:grid-cols-3 gap-8">
          {vehicleTypeOptions.map((type) => {
            const image = PlaceHolderImages.find((p) => p.id === type.imageId);
            return (
              <Card
                key={type.id}
                className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-ring"
                onClick={() => setSelectedType(type.id)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedType(type.id)}
              >
                <CardContent className="p-0 flex items-center">
                  {image && (
                    <Image
                      src={image.imageUrl}
                      alt={image.description}
                      width={100}
                      height={100}
                      className="object-cover h-24 w-24"
                    />
                  )}
                  <span className="font-headline text-xl font-semibold p-4">{type.name}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-8 animate-in fade-in-50 duration-500">
            <div className='flex items-end gap-4'>
                {selectedBrand && (
                    <div className="p-4 border rounded-md bg-muted transition-all animate-in fade-in-0 duration-300">
                        <p className="text-sm text-muted-foreground">Marca</p>
                        <p className="font-semibold">{selectedBrand}</p>
                    </div>
                )}
                <div>
                    <h2 className="text-xl font-semibold mb-2">
                        {!selectedBrand 
                            ? `¿Qué marca es tu ${selectedType.toLowerCase()}?`
                            : `¿Qué modelo es tu ${selectedBrand}?`
                        }
                    </h2>
                    {!selectedBrand ? (
                        <Combobox
                            options={allMakes}
                            value={selectedBrand}
                            onChange={setSelectedBrand}
                            placeholder="Selecciona una marca"
                            searchPlaceholder="Buscar marca..."
                            notFoundMessage="No se encontró la marca."
                        />
                    ) : (
                        <Input 
                            placeholder="Ej: Corolla"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-[200px]"
                            autoFocus
                        />
                    )}
                </div>
            </div>

            {(selectedBrand && selectedModel.length > 1) && (
                <Button onClick={handleNext} size="lg">
                    Siguiente
                </Button>
            )}
        </div>
      )}
    </div>
  );
}
