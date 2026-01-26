
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirestore, useUser, useMemoFirebase, useStorage } from '@/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import imageCompression from 'browser-image-compression';
import type { Vehicle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PhotoState = {
  file?: File;
  previewUrl: string;
  existingUrl?: string;
};

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const [vehicleData, setVehicleData] = useState<Vehicle | null>(null);
  const [isVehicleLoading, setIsVehicleLoading] = useState(true);

  const vehicleRef = useMemoFirebase(() => {
    if (!user || !params.id) return null;
    return doc(firestore, 'users', user.uid, 'vehicleListings', params.id as string);
  }, [firestore, user, params.id]);

  useEffect(() => {
    if (vehicleRef) {
        const getVehicle = async () => {
            setIsVehicleLoading(true);
            try {
                const docSnap = await getDoc(vehicleRef);
                if (docSnap.exists()) {
                    setVehicleData({ id: docSnap.id, ...docSnap.data() } as Vehicle);
                } else {
                    setVehicleData(null);
                }
            } catch (e) {
                console.error("Error fetching vehicle for edit:", e);
                setVehicleData(null);
            } finally {
                setIsVehicleLoading(false);
            }
        };
        getVehicle();
    } else if (!isUserLoading) { // If there's no user, we can stop loading
        setIsVehicleLoading(false);
    }
  }, [vehicleRef, isUserLoading]);


  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [details, setDetails] = useState({
    year: '',
    price: '',
    mileage: '',
    transmission: 'Automática',
    exteriorColor: '',
    engine: '',
    hadMajorCrash: false,
    hasAC: true,
    isOperational: true,
    operationalDetails: '',
    isSignatory: true,
    doorCount: '4',
    is4x4: false,
    isArmored: false,
    armorLevel: '1',
    hasSoundSystem: false,
    ownerCount: '1',
    tireLife: '75',
    moreDetails: '',
    acceptsTradeIn: false,
    tradeInDetails: '',
    tradeInForHigherValue: false,
    tradeInForLowerValue: false,
  });

  useEffect(() => {
    if (vehicleData) {
      if (user && vehicleData.sellerId !== user.uid) {
        toast({ title: "No autorizado", description: "No tienes permiso para editar esta publicación.", variant: "destructive" });
        router.push('/');
        return;
      }

      setDetails({
        year: vehicleData.year.toString(),
        price: vehicleData.priceUSD.toString(),
        mileage: vehicleData.mileage.toString(),
        transmission: vehicleData.transmission,
        exteriorColor: vehicleData.exteriorColor,
        engine: vehicleData.engine,
        hadMajorCrash: vehicleData.hadMajorCrash,
        hasAC: vehicleData.hasAC,
        isOperational: vehicleData.isOperational,
        operationalDetails: vehicleData.operationalDetails || '',
        isSignatory: vehicleData.isSignatory,
        doorCount: vehicleData.doorCount || '4',
        is4x4: vehicleData.is4x4 || false,
        isArmored: vehicleData.isArmored || false,
        armorLevel: vehicleData.armorLevel?.toString() || '1',
        hasSoundSystem: vehicleData.hasSoundSystem,
        ownerCount: vehicleData.ownerCount.toString(),
        tireLife: vehicleData.tireLife.toString(),
        moreDetails: vehicleData.description,
        acceptsTradeIn: vehicleData.acceptsTradeIn,
        tradeInDetails: vehicleData.tradeInDetails || '',
        tradeInForHigherValue: vehicleData.tradeInForHigherValue || false,
        tradeInForLowerValue: vehicleData.tradeInForLowerValue || false,
      });

      const existingPhotos = vehicleData.images.map(img => ({
        previewUrl: img.url,
        existingUrl: img.url,
      }));
      setPhotos(existingPhotos);
      setMainPhotoIndex(0);
    }
  }, [vehicleData, user, router, toast]);

  const handleDetailChange = (field: keyof typeof details, value: any) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length > 4) return;
    handleDetailChange('year', value);
  };

  const handleYearBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;

    let year = parseInt(value, 10);
    if (isNaN(year)) {
        handleDetailChange('year', '');
        toast({ title: "Año inválido", description: "Por favor, introduce un número válido.", variant: "destructive" });
        return;
    }

    if (year >= 0 && year < 100) {
        if (year > (new Date().getFullYear() % 100) + 1) {
            year += 1900;
        } else {
            year += 2000;
        }
    }
    
    const finalYearString = year.toString();
    handleDetailChange('year', finalYearString);

    const minYear = 1950;
    const maxYear = new Date().getFullYear() + 1;
    
    if (year < minYear || year > maxYear) {
        toast({ title: "Año inválido", description: `El año debe estar entre ${minYear} y ${maxYear}.`, variant: "destructive" });
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 12) {
      toast({ title: "Límite de fotos alcanzado", description: "Puedes subir un máximo de 12 fotos.", variant: "destructive" });
      return;
    }
    
    const compressionToast = toast({ title: 'Comprimiendo imágenes...', description: 'Por favor, espera un momento.' });

    const newPhotosPromises = Array.from(files).map(async (file) => {
      try {
        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        return { file: compressedFile, previewUrl: URL.createObjectURL(compressedFile) };
      } catch (error) {
        console.error('Error al comprimir la imagen:', error);
        toast({ title: 'Error de compresión', description: `No se pudo comprimir la imagen ${file.name}.`, variant: 'destructive' });
        return null;
      }
    });

    const newPhotos = (await Promise.all(newPhotosPromises)).filter((p): p is PhotoState => p !== null);
    
    compressionToast.dismiss();

    if (newPhotos.length > 0) {
      setPhotos(prev => [...prev, ...newPhotos]);
      toast({ title: 'Imágenes listas', description: `${newPhotos.length} foto(s) se han comprimido y añadido.` });
    }
  };

  const removePhoto = (index: number) => {
    const photoToRemove = photos[index];
    if (photoToRemove.existingUrl) {
      setPhotosToDelete(prev => [...prev, photoToRemove.existingUrl]);
    }
    if (photoToRemove.file) {
      URL.revokeObjectURL(photoToRemove.previewUrl);
    }

    setPhotos(prev => prev.filter((_, i) => i !== index));
    
    if (mainPhotoIndex === index) {
      setMainPhotoIndex(photos.length > 1 ? 0 : null);
    } else if (mainPhotoIndex && mainPhotoIndex > index) {
      setMainPhotoIndex(mainPhotoIndex - 1);
    }
  };

  const handleUpdate = async () => {
    if (!user || !vehicleRef || !vehicleData) return;
    if (photos.length < 4) {
      toast({ title: "Fotos insuficientes", description: "Debes tener al menos 4 fotos.", variant: "destructive" });
      return;
    }

    const year = parseInt(details.year, 10);
    const minYear = 1950;
    const maxYear = new Date().getFullYear() + 1;
    if (isNaN(year) || year < minYear || year > maxYear) {
      toast({
        title: 'Año Inválido',
        description: `Por favor, ingresa un año entre ${minYear} y ${maxYear}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    setUploadProgress(0);

    try {
      // 1. Delete photos marked for deletion from Storage
      if (photosToDelete.length > 0) {
        const deletePromises = photosToDelete.map(url => deleteObject(ref(storage, url)));
        await Promise.all(deletePromises);
      }
      
      // 2. Upload new images and collect all image info
      const finalImages: { url: string; alt: string; hint: string }[] = [];
      const newPhotoUploads: { photo: PhotoState; index: number }[] = [];
      
      photos.forEach((photo, index) => {
        if(photo.file) {
          newPhotoUploads.push({ photo, index });
        }
      });
      
      let uploadedCount = 0;
      const totalNewUploads = newPhotoUploads.length;

      const uploadAndCollectPromises = photos.map(async (photo, originalIndex) => {
        if (photo.file) {
          const fileName = `${Date.now()}-${originalIndex}-${photo.file.name}`;
          const imageRef = ref(storage, `vehicle-images/${user.uid}/${fileName}`);
          const uploadTask = uploadBytesResumable(imageRef, photo.file, { contentType: photo.file.type });

          return new Promise<{ url: string; alt: string; hint: string }>((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                // Calculate progress based on which photo is currently uploading
                const currentUploadIndex = newPhotoUploads.findIndex(p => p.index === originalIndex);
                if (currentUploadIndex !== -1) {
                   const overallProgress = ((currentUploadIndex * 100) + progress) / totalNewUploads;
                   setUploadProgress(overallProgress);
                }
              },
              (error) => reject(error),
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({
                  url: downloadURL,
                  alt: `Foto de ${vehicleData.make} ${vehicleData.model}`,
                  hint: 'car photo'
                });
              }
            );
          });
        } else if (photo.existingUrl) {
          // It's an existing image, just keep its data
          const existingImage = vehicleData.images.find(img => img.url === photo.existingUrl);
          return Promise.resolve(existingImage || { url: photo.existingUrl, alt: `Foto de ${vehicleData.make} ${vehicleData.model}`, hint: 'car photo' });
        }
        return Promise.resolve(null);
      });
      
      let allImageInfos = (await Promise.all(uploadAndCollectPromises)).filter((info): info is { url: string; alt: string; hint: string } => info !== null);
      
      // 3. Reorder to put the main photo first
      if (mainPhotoIndex !== null && mainPhotoIndex > 0 && allImageInfos.length > mainPhotoIndex) {
        const mainImage = allImageInfos.splice(mainPhotoIndex, 1)[0];
        allImageInfos.unshift(mainImage);
      }

      // 4. Construct update payload
      const updatedVehicleData: any = {
        year: parseInt(details.year, 10),
        priceUSD: parseInt(details.price, 10),
        mileage: parseInt(details.mileage, 10) || 0,
        transmission: details.transmission,
        exteriorColor: details.exteriorColor,
        engine: details.engine,
        hadMajorCrash: details.hadMajorCrash,
        hasAC: details.hasAC,
        isOperational: details.isOperational,
        isSignatory: details.isSignatory,
        doorCount: details.doorCount,
        is4x4: details.is4x4,
        isArmored: details.isArmored,
        hasSoundSystem: details.hasSoundSystem,
        ownerCount: parseInt(details.ownerCount, 10),
        tireLife: parseInt(details.tireLife, 10),
        description: details.moreDetails,
        acceptsTradeIn: details.acceptsTradeIn,
        images: allImageInfos,
        updatedAt: serverTimestamp(),
      };
      
      updatedVehicleData.operationalDetails = details.isOperational ? null : details.operationalDetails;
      updatedVehicleData.armorLevel = details.isArmored ? parseInt(details.armorLevel, 10) : null;
      updatedVehicleData.tradeInDetails = details.acceptsTradeIn ? details.tradeInDetails : null;
      updatedVehicleData.tradeInForHigherValue = details.acceptsTradeIn ? details.tradeInForHigherValue : null;
      updatedVehicleData.tradeInForLowerValue = details.acceptsTradeIn ? details.tradeInForLowerValue : null;
      
      await updateDoc(vehicleRef, updatedVehicleData);

      toast({ title: "¡Publicación Actualizada!", description: `Tu ${vehicleData.make} ${vehicleData.model} se actualizó con éxito.` });
      router.push('/profile/listings');

    } catch(e) {
      console.error("Error al actualizar el anuncio: ", e);
      toast({ variant: "destructive", title: "Error al actualizar", description: "No se pudo guardar la publicación." });
    } finally {
      setIsUpdating(false);
      setUploadProgress(null);
    }
  };

  if (isUserLoading || isVehicleLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-12">
        <Skeleton className="h-8 w-48 mb-4" />
        <h2 className="text-2xl font-bold font-headline mb-4 text-center">
            <Skeleton className="h-8 w-1/2 mx-auto" />
        </h2>
        <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
             <div className="flex justify-end mt-8">
                <Skeleton className="h-12 w-32" />
            </div>
        </Card>
      </div>
    );
  }
  
  if (!vehicleData) {
    return notFound();
  }

  return (
    <div className="container max-w-5xl mx-auto py-12">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 pl-0">
            &larr; Volver
        </Button>
        <h2 className="text-2xl font-bold font-headline mb-4 text-center">
            Editando: {vehicleData.year} {vehicleData.make} {vehicleData.model}
        </h2>
        <Card className="p-4 mb-6 bg-muted/50 border-dashed">
            <p className="text-sm text-center text-muted-foreground">La <strong>marca</strong> y el <strong>modelo</strong> no se pueden cambiar para mantener la consistencia del anuncio.</p>
        </Card>
        
        <div className="space-y-8">
          {/* Details Form */}
          <Card className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-2">
                      <Label htmlFor="year">Año</Label>
                      <Input
                        id="year"
                        type="number"
                        min="1950"
                        max={new Date().getFullYear() + 1}
                        value={details.year}
                        onChange={handleYearChange}
                        onBlur={handleYearBlur}
                        placeholder="Ej: 2021"
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="price">Precio (USD)</Label>
                      <Input id="price" type="number" min="0" value={details.price} onChange={(e) => handleDetailChange('price', e.target.value)} placeholder="Ej: 22000" />
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="mileage">Kilometraje</Label>
                      <Input id="mileage" type="number" min="0" value={details.mileage} onChange={(e) => handleDetailChange('mileage', e.target.value)} placeholder="Ej: 55000" />
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="engine">Motor</Label>
                      <Input id="engine" value={details.engine} onChange={(e) => handleDetailChange('engine', e.target.value)} placeholder="Ej: 1.8L 4 Cilindros" />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="exteriorColor">Color Exterior</Label>
                      <Input id="exteriorColor" value={details.exteriorColor} onChange={(e) => handleDetailChange('exteriorColor', e.target.value)} placeholder="Ej: Blanco Perlado" />
                  </div>
                  <div className="rounded-lg border p-4">
                      <Label className="mb-3 block">Transmisión</Label>
                      <RadioGroup value={details.transmission} onValueChange={(v) => handleDetailChange('transmission', v)} className="flex gap-4">
                          <RadioGroupItem value="Automática" id="t_auto" /><Label htmlFor="t_auto">Automática</Label>
                          <RadioGroupItem value="Sincrónica" id="t_sync" /><Label htmlFor="t_sync">Sincrónica</Label>
                      </RadioGroup>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                      <Label htmlFor="hadMajorCrash">¿Tuvo un choque fuerte?</Label>
                      <Switch id="hadMajorCrash" checked={details.hadMajorCrash} onCheckedChange={(c) => handleDetailChange('hadMajorCrash', c)} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                      <Label htmlFor="hasAC">¿Tiene aire acondicionado?</Label>
                      <Switch id="hasAC" checked={details.hasAC} onCheckedChange={(c) => handleDetailChange('hasAC', c)} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                      <Label htmlFor="isOperational">¿El vehículo rueda?</Label>
                      <Switch id="isOperational" checked={details.isOperational} onCheckedChange={(c) => handleDetailChange('isOperational', c)} />
                  </div>
                  {!details.isOperational && (
                      <div className="md:col-span-2 space-y-2"><Label htmlFor="operationalDetails">Explica por qué no rueda</Label><Textarea id="operationalDetails" value={details.operationalDetails} onChange={(e) => handleDetailChange('operationalDetails', e.target.value)}/></div>
                  )}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                      <Label htmlFor="isSignatory">¿Eres el firmante?</Label>
                      <Switch id="isSignatory" checked={details.isSignatory} onCheckedChange={(c) => handleDetailChange('isSignatory', c)} />
                  </div>
                  {vehicleData.bodyType === 'Carro' && (
                      <div className="rounded-lg border p-4">
                          <Label className="mb-3 block">Número de puertas</Label>
                          <RadioGroup value={details.doorCount} onValueChange={(v) => handleDetailChange('doorCount', v)} className="flex gap-4">
                              <RadioGroupItem value="2" id="d2" /><Label htmlFor="d2">2</Label>
                              <RadioGroupItem value="4" id="d4" /><Label htmlFor="d4">4</Label>
                          </RadioGroup>
                      </div>
                  )}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <Label htmlFor="is4x4">¿Es 4x4?</Label>
                    <Switch id="is4x4" checked={details.is4x4} onCheckedChange={(c) => handleDetailChange('is4x4', c)} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                      <Label htmlFor="hasSoundSystem">¿Tiene sistema de sonido?</Label>
                      <Switch id="hasSoundSystem" checked={details.hasSoundSystem} onCheckedChange={(c) => handleDetailChange('hasSoundSystem', c)} />
                  </div>
                  <div className="md:col-span-2 space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                          <Label htmlFor="isArmored" className="pr-4">¿El vehículo es blindado?</Label>
                          <Switch id="isArmored" checked={details.isArmored} onCheckedChange={(c) => handleDetailChange('isArmored', c)} />
                      </div>
                      {details.isArmored && (
                          <div className="space-y-2 pt-4 border-t animate-in fade-in-50 duration-300">
                              <Label htmlFor="armorLevel">Nivel de Blindaje</Label>
                              <Select onValueChange={(v) => handleDetailChange('armorLevel', v)} value={details.armorLevel}>
                                  <SelectTrigger id="armorLevel">
                                      <SelectValue placeholder="Selecciona el nivel" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="1">Nivel 1</SelectItem>
                                      <SelectItem value="2">Nivel 2</SelectItem>
                                      <SelectItem value="3">Nivel 3</SelectItem>
                                      <SelectItem value="4">Nivel 4</SelectItem>
                                      <SelectItem value="5">Nivel 5</SelectItem>
                                      <SelectItem value="6">Nivel 6</SelectItem>
                                      <SelectItem value="7">Nivel 7</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      )}
                  </div>
                   <div className="md:col-span-2 space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between"><Label htmlFor="acceptsTradeIn">¿Aceptas cambios?</Label><Switch id="acceptsTradeIn" checked={details.acceptsTradeIn} onCheckedChange={(c) => handleDetailChange('acceptsTradeIn', c)} /></div>
                      {details.acceptsTradeIn && (
                          <div className="space-y-4 pt-4 border-t">
                              <div className="flex items-center justify-between rounded-lg border p-4"><Label htmlFor="tradeInForLowerValue">¿Recibes menor valor?</Label><Switch id="tradeInForLowerValue" checked={details.tradeInForLowerValue} onCheckedChange={(c) => handleDetailChange('tradeInForLowerValue', c)} /></div>
                              <div className="flex items-center justify-between rounded-lg border p-4"><Label htmlFor="tradeInForHigherValue">¿Das como parte de pago?</Label><Switch id="tradeInForHigherValue" checked={details.tradeInForHigherValue} onCheckedChange={(c) => handleDetailChange('tradeInForHigherValue', c)} /></div>
                              <div className="space-y-2"><Label htmlFor="tradeInDetails">Modelos que aceptarías</Label><Textarea id="tradeInDetails" value={details.tradeInDetails} onChange={(e) => handleDetailChange('tradeInDetails', e.target.value)}/></div>
                          </div>
                      )}
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="ownerCount">Título (dueños)</Label>
                      <Input id="ownerCount" type="number" min="1" value={details.ownerCount} onChange={(e) => handleDetailChange('ownerCount', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="tireLife">Vida de cauchos (%)</Label>
                      <Input id="tireLife" type="number" min="0" max="100" step="5" value={details.tireLife} onChange={(e) => handleDetailChange('tireLife', e.target.value)} />
                  </div>
                   <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="moreDetails">Descripción / Más detalles</Label>
                      <Textarea id="moreDetails" value={details.moreDetails} onChange={(e) => handleDetailChange('moreDetails', e.target.value)} />
                  </div>
              </div>
          </Card>

          {/* Photos Management */}
          <Card className="p-6">
              <h3 className="text-xl font-bold font-headline mb-4">Fotos</h3>
              <p className="text-center text-muted-foreground mb-6">Sube entre 4 y 12 fotos. Selecciona una como la foto principal.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {photos.map((photo, index) => (
                      <div key={photo.previewUrl} className="relative aspect-square group" onClick={() => setMainPhotoIndex(index)}>
                          <Image src={photo.previewUrl} alt={`Foto ${index + 1}`} fill className="object-cover rounded-md cursor-pointer" />
                          <button onClick={(e) => { e.stopPropagation(); removePhoto(index); }} className="absolute top-1 right-1 z-10 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="h-4 w-4" /></button>
                          {mainPhotoIndex === index && (
                              <><div className="absolute inset-0 rounded-md ring-4 ring-primary" /><div className="absolute bottom-0 w-full bg-primary text-primary-foreground text-center text-xs py-1 rounded-b-md">Principal</div></>
                          )}
                      </div>
                  ))}
                  {photos.length < 12 && (
                      <Label htmlFor="photo-upload" className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-muted">
                          <UploadCloud className="h-10 w-10 text-muted-foreground" />
                          <span className="mt-2 text-sm text-muted-foreground">Subir fotos</span>
                          <input id="photo-upload" type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                      </Label>
                  )}
              </div>
          </Card>

          <div className="flex justify-end mt-8 items-center gap-4">
              {isUpdating && uploadProgress !== null && (
                  <div className="w-full max-w-xs text-right">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-sm text-muted-foreground mt-1">Subiendo... {uploadProgress.toFixed(0)}%</p>
                  </div>
              )}
              <Button onClick={() => router.push('/profile/listings')} variant="outline" size="lg">Cancelar</Button>
              <Button onClick={handleUpdate} size="lg" disabled={photos.length < 4 || isUpdating}>
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
          </div>
        </div>
    </div>
  );
}
