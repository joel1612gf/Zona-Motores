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
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type VehicleType = 'Moto' | 'Carro' | 'Camioneta';
type Step = 'selection' | 'details';

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

  const [step, setStep] = useState<Step>('selection');

  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  const [details, setDetails] = useState({
    hadMajorCrash: false,
    hasAC: true,
    isOperational: true,
    operationalDetails: '',
    isSignatory: true,
    doorCount: '4',
    is4x4: false,
    hasSoundSystem: false,
    ownerCount: '1',
    tireLife: '75',
    moreDetails: '',
  });

  const handleDetailChange = (field: keyof typeof details, value: any) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

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

  const handleNextToDetails = () => {
    setStep('details');
  }

  const handlePublish = () => {
     toast({
      title: "Publicación casi lista (Demo)",
      description: `Los detalles de tu ${selectedBrand} ${selectedModel} han sido guardados.`,
    });
    // For now, redirect to home page.
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

  const renderSelectionStep = () => (
    <>
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
                    <Button onClick={handleNextToDetails} size="lg">
                        Siguiente
                    </Button>
                )}
            </div>
      )}
    </>
  );

  const renderDetailsStep = () => (
    <div className="animate-in fade-in-50 duration-500">
        <Button variant="ghost" onClick={() => setStep('selection')} className="mb-4 pl-0">
            &larr; Volver a selección
        </Button>
        <h2 className="text-2xl font-bold font-headline mb-4 text-center">
            Detalles del Vehículo: {selectedYear} {selectedBrand} {selectedModel}
        </h2>
        <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <Label htmlFor="hadMajorCrash" className="pr-4">¿Tuvo un choque fuerte o fue volteado?</Label>
                    <Switch id="hadMajorCrash" checked={details.hadMajorCrash} onCheckedChange={(c) => handleDetailChange('hadMajorCrash', c)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <Label htmlFor="hasAC" className="pr-4">¿Tiene aire acondicionado?</Label>
                    <Switch id="hasAC" checked={details.hasAC} onCheckedChange={(c) => handleDetailChange('hasAC', c)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <Label htmlFor="isOperational" className="pr-4">¿El vehículo rueda actualmente?</Label>
                    <Switch id="isOperational" checked={details.isOperational} onCheckedChange={(c) => handleDetailChange('isOperational', c)} />
                </div>
                {!details.isOperational && (
                    <div className="md:col-span-2 space-y-2 animate-in fade-in-50 duration-300">
                        <Label htmlFor="operationalDetails">Por favor, explica por qué no rueda</Label>
                        <Textarea id="operationalDetails" value={details.operationalDetails} onChange={(e) => handleDetailChange('operationalDetails', e.target.value)} placeholder="Ej: Falla en el motor, caja de cambios dañada..."/>
                    </div>
                )}
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <Label htmlFor="isSignatory" className="pr-4">¿Eres el firmante del vehículo?</Label>
                    <Switch id="isSignatory" checked={details.isSignatory} onCheckedChange={(c) => handleDetailChange('isSignatory', c)} />
                </div>
                {selectedType === 'Carro' && (
                    <div className="rounded-lg border p-4">
                        <Label className="mb-3 block">Número de puertas</Label>
                        <RadioGroup value={details.doorCount} onValueChange={(v) => handleDetailChange('doorCount', v)} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="2" id="d2" />
                                <Label htmlFor="d2">2 puertas</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="4" id="d4" />
                                <Label htmlFor="d4">4 puertas</Label>
                            </div>
                        </RadioGroup>
                    </div>
                )}
                {selectedType === 'Camioneta' && (
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="is4x4" className="pr-4">¿Es 4x4?</Label>
                        <Switch id="is4x4" checked={details.is4x4} onCheckedChange={(c) => handleDetailChange('is4x4', c)} />
                    </div>
                )}
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <Label htmlFor="hasSoundSystem" className="pr-4">¿Tiene sistema de sonido?</Label>
                    <Switch id="hasSoundSystem" checked={details.hasSoundSystem} onCheckedChange={(c) => handleDetailChange('hasSoundSystem', c)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ownerCount">Número de dueños anteriores</Label>
                    <Input id="ownerCount" type="number" min="0" value={details.ownerCount} onChange={(e) => handleDetailChange('ownerCount', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tireLife">Porcentaje de vida de los cauchos</Label>
                    <Input id="tireLife" type="number" min="0" max="100" step="5" value={details.tireLife} onChange={(e) => handleDetailChange('tireLife', e.target.value)} placeholder="Ej: 75"/>
                </div>
                 <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="moreDetails">Más detalles (opcional)</Label>
                    <Textarea id="moreDetails" placeholder="Añade cualquier otra información relevante como extras, detalles de pintura, etc." value={details.moreDetails} onChange={(e) => handleDetailChange('moreDetails', e.target.value)} />
                </div>
            </div>
            <div className="flex justify-end mt-8">
                <Button onClick={handlePublish} size="lg">Siguiente</Button>
            </div>
        </Card>
    </div>
  );

  return (
    <div className="container max-w-4xl mx-auto py-12">
        {step === 'selection' && renderSelectionStep()}
        {step === 'details' && renderDetailsStep()}
    </div>
  );
}
