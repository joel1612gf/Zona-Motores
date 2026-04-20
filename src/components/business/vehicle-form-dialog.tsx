'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Plus, X, Upload, ImagePlus, Trash2, ChevronRight, ChevronLeft, CheckCircle2, Star } from 'lucide-react';
import Image from 'next/image';
import type {
  StockVehicle,
  StockStatus,
  GastoAdecuacion,
  GastoCategoria,
  Cliente,
  VehiculoRequerido,
} from '@/lib/business-types';
import { GASTO_CATEGORIA_LABELS } from '@/lib/business-types';
import { formatCurrency } from '@/lib/utils';
import { fallbackData } from '@/lib/makes-fallback-data';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { VehicleCostsDialog } from '@/components/business/vehicle-costs-dialog';
import { VehicleInfoExtraDialog } from '@/components/business/vehicle-info-extra-dialog';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVehicle: StockVehicle | null;
  concesionarioId: string;
  onSave: (savedVehicleId?: string) => void;
}

const COLORS = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Marrón', 'Dorado', 'Naranja', 'Amarillo', 'Beige', 'Otro'];

export function VehicleFormDialog({ open, onOpenChange, editingVehicle, concesionarioId, onSave }: VehicleFormDialogProps) {
  const { canSeeCosts, staffList, concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAILoading, setIsAILoading] = useState(false);
  const [coverSelection, setCoverSelection] = useState<{ type: 'existing' | 'new'; index: number } | null>(null);

  // Vehicle fields (Step 1)
  const [vehicleType, setVehicleType] = useState<string>('Carro');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [transmission, setTransmission] = useState<'Automática' | 'Sincrónica'>('Sincrónica');
  const [engine, setEngine] = useState('');
  const [exteriorColor, setExteriorColor] = useState('');
  const [mileage, setMileage] = useState(0);
  const [description, setDescription] = useState('');
  const [estadoStock, setEstadoStock] = useState<StockStatus>('privado_taller');
  const [precioVenta, setPrecioVenta] = useState(0);

  // Removed from UI, kept in Code
  const [bodyType, setBodyType] = useState('Sedán');

  // Technical Details (Step 2)
  const [hadMajorCrash, setHadMajorCrash] = useState(false);
  const [hasAC, setHasAC] = useState(true);
  const [isOperational, setIsOperational] = useState(true);
  const [isSignatory, setIsSignatory] = useState(true);
  const [doorCount, setDoorCount] = useState<2 | 4>(4);
  const [is4x4, setIs4x4] = useState(false);
  const [hasSoundSystem, setHasSoundSystem] = useState(false);
  const [isArmored, setIsArmored] = useState(false);
  const [acceptsTradeIn, setAcceptsTradeIn] = useState(false);
  const [ownerCount, setOwnerCount] = useState(1);
  const [tireLife, setTireLife] = useState(75);

  // Assignment / Consignment
  const [esConsignacion, setEsConsignacion] = useState(false);
  const [consignacionVendedorId, setConsignacionVendedorId] = useState('');
  const [consignacionComision, setConsignacionComision] = useState(10);
  const [asignadoA, setAsignadoA] = useState('');

  // Images (Step 3)
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<{ url: string; alt: string }[]>([]);

  // Internal state for costs, defaults to 0 in wizard
  const [costoCompra, setCostoCompra] = useState(0);
  const [gastos, setGastos] = useState<GastoAdecuacion[]>([]);

  // Market price
  const [marketPrice, setMarketPrice] = useState<{ message: string; found: boolean } | null>(null);

  // Saved vehicle reference (for post-save actions)
  const [savedVehicleId, setSavedVehicleId] = useState<string | null>(null);
  const [savedVehicleSnapshot, setSavedVehicleSnapshot] = useState<StockVehicle | null>(null);
  const [costsDialogOpen, setCostsDialogOpen] = useState(false);
  const [infoExtraDialogOpen, setInfoExtraDialogOpen] = useState(false);

  // Makes/Models
  const makes = useMemo(() => {
    if (!vehicleType) return [];
    const typeData = fallbackData[vehicleType as keyof typeof fallbackData];
    if (!typeData) return [];
    return Object.keys(typeData).sort();
  }, [vehicleType]);

  const models = useMemo(() => {
    if (!make || !vehicleType) return [];
    const typeData = fallbackData[vehicleType as keyof typeof fallbackData];
    if (!typeData || !typeData[make]) return [];
    return Array.from(typeData[make]).sort();
  }, [make, vehicleType]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear() + 1;
    return Array.from({ length: 50 }, (_, i) => currentYear - i);
  }, []);

  const vendedores = useMemo(() =>
    staffList.filter(s => s.activo && (s.rol === 'vendedor' || s.rol === 'encargado' || s.rol === 'dueno')),
    [staffList]
  );

  useEffect(() => {
    if (editingVehicle) {
      setVehicleType(editingVehicle.vehicleType || 'Carro');
      setMake(editingVehicle.make || '');
      setModel(editingVehicle.model || '');
      setYear(editingVehicle.year || new Date().getFullYear());
      setBodyType(editingVehicle.bodyType || 'Sedán');
      setTransmission(editingVehicle.transmission || 'Sincrónica');
      setEngine(editingVehicle.engine || '');
      setExteriorColor(editingVehicle.exteriorColor || '');
      setMileage(editingVehicle.mileage || 0);
      setDescription(editingVehicle.description || '');
      setEstadoStock(editingVehicle.estado_stock || 'privado_taller');
      setCostoCompra(editingVehicle.costo_compra || 0);
      setPrecioVenta(editingVehicle.precio_venta || 0);
      setGastos(editingVehicle.gastos_adecuacion || []);
      setEsConsignacion(editingVehicle.es_consignacion || false);
      setConsignacionVendedorId(editingVehicle.consignacion_info?.vendedor_particular_id || '');
      setConsignacionComision(editingVehicle.consignacion_info?.comision_acordada || 10);
      setAsignadoA(editingVehicle.asignado_a || '');
      setExistingImages(editingVehicle.images || []);
      setCoverSelection(editingVehicle.images?.length ? { type: 'existing', index: 0 } : null);

      setHadMajorCrash(editingVehicle.hadMajorCrash || false);
      setHasAC(editingVehicle.hasAC ?? true);
      setIsOperational(editingVehicle.isOperational ?? true);
      setIsSignatory(editingVehicle.isSignatory ?? true);
      setDoorCount(editingVehicle.doorCount as 2 | 4 || 4);
      setIs4x4(editingVehicle.is4x4 || false);
      setHasSoundSystem(editingVehicle.hasSoundSystem || false);
      setIsArmored(editingVehicle.isArmored || false);
      setAcceptsTradeIn(editingVehicle.acceptsTradeIn || false);
      setOwnerCount(editingVehicle.ownerCount || 1);
      setTireLife(editingVehicle.tireLife || 75);
    } else {
      setCurrentStep(1); // Reset to step 1
      setVehicleType('Carro');
      setMake('');
      setModel('');
      setYear(new Date().getFullYear());
      setBodyType('Sedán');
      setTransmission('Sincrónica');
      setEngine('');
      setExteriorColor('');
      setMileage(0);
      setDescription('');
      setEstadoStock('privado_taller');
      setCostoCompra(0);
      setPrecioVenta(0);
      setGastos([]);
      setEsConsignacion(false);
      setConsignacionVendedorId('');
      setConsignacionComision(10);
      setAsignadoA('');
      setExistingImages([]);
      setImageFiles([]);
      setImagePreviews([]);
      setCoverSelection(null);
      setMarketPrice(null);

      setHadMajorCrash(false);
      setHasAC(true);
      setIsOperational(true);
      setIsSignatory(true);
      setDoorCount(4);
      setIs4x4(false);
      setHasSoundSystem(false);
      setIsArmored(false);
      setAcceptsTradeIn(false);
      setOwnerCount(1);
      setTireLife(75);
    }
  }, [editingVehicle, open]);

  useEffect(() => {
    if (!make || !model) {
      setMarketPrice(null);
      return;
    }
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/vehicle-market-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ make, model, year }),
        });
        const data = await res.json();
        setMarketPrice(data);
      } catch {
        setMarketPrice(null);
      }
    };
    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [make, model, year]);

  const handleAIFill = async () => {
    if (!make || !model || !year) {
      toast({ title: 'Datos incompletos', description: 'Selecciona marca, modelo y año primero.', variant: 'destructive' });
      return;
    }
    setIsAILoading(true);
    try {
      const res = await fetch('/api/vehicle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleType, make, model, year }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (data.engine) setEngine(data.engine);
      if (data.bodyType) setBodyType(data.bodyType);
      if (data.transmission) setTransmission(data.transmission);
      if (data.description) setDescription(data.description);

      toast({ title: '✨ IA completó los datos', description: 'Revisa los campos auto-rellenados.' });
    } catch (error) {
      console.error('[AI Fill] Error:', error);
      toast({ title: 'Error de IA', description: 'No se pudo obtener información del vehículo.', variant: 'destructive' });
    } finally {
      setIsAILoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImageFiles(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setImagePreviews(prev => {
      if (!coverSelection && existingImages.length === 0 && prev.length === 0) {
        setCoverSelection({ type: 'new', index: 0 });
      }
      return [...prev, ...previews];
    });
  };

  const removeNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    if (coverSelection?.type === 'new' && coverSelection.index === index) {
      setCoverSelection(null);
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
    if (coverSelection?.type === 'existing' && coverSelection.index === index) {
      setCoverSelection(null);
    }
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!make || !model || !year) {
        toast({ title: 'Datos incompletos', description: 'Marca, modelo y año son obligatorios.', variant: 'destructive' });
        return;
      }
    }
    setCurrentStep(c => c + 1);
  };

  const prevStep = () => setCurrentStep(c => c - 1);

  const handleSave = async () => {
    if (!concesionarioId) return;

    setIsSaving(true);
    try {
      // Upload new images
      let uploadedImages: { url: string; alt: string }[] = [];
      const newUploads: { url: string; alt: string }[] = [];

      if (imageFiles.length > 0) {
        const vehicleId = editingVehicle?.id || `temp_${Date.now()}`;
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const imageName = `${Date.now()}_${i}_${file.name}`;
          const imageRef = ref(storage, `business-assets/${concesionarioId}/inventario/${vehicleId}/${imageName}`);
          setUploadProgress(10 + Math.floor((i / imageFiles.length) * 40));
          await uploadBytes(imageRef, file);
          const url = await getDownloadURL(imageRef);
          newUploads.push({
            url,
            alt: `${year} ${make} ${model} - Foto ${newUploads.length + existingImages.length + 1}`,
          });
          setUploadProgress(10 + Math.floor(((i + 1) / imageFiles.length) * 40));
        }
      }

      const finalExisting = [...existingImages];
      const finalNew = [...newUploads];
      let coverImage = null;

      if (coverSelection) {
        if (coverSelection.type === 'existing' && coverSelection.index < finalExisting.length) {
          coverImage = finalExisting[coverSelection.index];
          finalExisting.splice(coverSelection.index, 1);
        } else if (coverSelection.type === 'new' && coverSelection.index < finalNew.length) {
          coverImage = finalNew[coverSelection.index];
          finalNew.splice(coverSelection.index, 1);
        }
      }

      if (coverImage) {
        uploadedImages = [coverImage, ...finalExisting, ...finalNew];
      } else {
        uploadedImages = [...finalExisting, ...finalNew];
      }

      // Automatically pause if public with less than 4 photos
      let finalEstadoStock = estadoStock;
      if (uploadedImages.length < 4 && estadoStock === 'publico_web') {
        finalEstadoStock = 'pausado';
        toast({ title: 'Faltan fotos', description: 'Se guardó como Pausado, requiere mínimo 4 fotos para publicar.', variant: 'default' });
      }

      const vehicleData: Omit<StockVehicle, 'id' | 'created_at'> & { created_at?: any; updated_at?: any } = {
        vehicleType,
        make,
        model,
        year,
        bodyType,
        transmission,
        engine,
        exteriorColor,
        mileage,
        description,
        images: uploadedImages,
        estado_stock: finalEstadoStock,
        precio_venta: precioVenta,
        costo_compra: costoCompra,
        gastos_adecuacion: gastos,
        ganancia_neta_estimada: precioVenta - costoCompra - gastos.reduce((a, b) => a + b.monto, 0),
        es_consignacion: esConsignacion,
        ...(esConsignacion ? {
          consignacion_info: {
            vendedor_particular_id: consignacionVendedorId,
            comision_acordada: consignacionComision,
          },
        } : {}),
        ...(asignadoA ? { asignado_a: asignadoA } : {}),
        hadMajorCrash,
        hasAC,
        isOperational,
        isSignatory,
        doorCount,
        is4x4,
        hasSoundSystem,
        isArmored,
        acceptsTradeIn,
        ownerCount,
        tireLife,
        updated_at: serverTimestamp() as any,
      };

      let finalVehicleId = editingVehicle?.id;

      if (editingVehicle) {
        const docRef = doc(firestore, 'concesionarios', concesionarioId, 'inventario', editingVehicle.id);
        await updateDoc(docRef, vehicleData);
        finalVehicleId = editingVehicle.id;
      } else {
        vehicleData.created_at = serverTimestamp();
        const colRef = collection(firestore, 'concesionarios', concesionarioId, 'inventario');
        const newDocRef = await addDoc(colRef, vehicleData);
        finalVehicleId = newDocRef.id;
        editingVehicle = { ...vehicleData, id: finalVehicleId } as StockVehicle;
      }

      // Store for post-save dialogs
      setSavedVehicleId(finalVehicleId || null);
      setSavedVehicleSnapshot({
        ...(vehicleData as any),
        id: finalVehicleId || '',
        costo_compra: costoCompra,
        precio_venta: precioVenta,
        gastos_adecuacion: gastos,
        make, model, year,
      });

      // Sync to public marketplace
      if (concesionario && finalVehicleId) {
        if (!concesionario.owner_uid) {
          console.warn('[VehicleForm] Sync skipped: concesionario.owner_uid is undefined');
        } else {
          const publicRef = doc(firestore, 'users', concesionario.owner_uid, 'vehicleListings', finalVehicleId);

          if (finalEstadoStock === 'publico_web' || finalEstadoStock === 'pausado') {
            const publicVehicleData = {
              id: finalVehicleId,
              sellerId: concesionario.owner_uid,
              make,
              model,
              year,
              priceUSD: precioVenta,
              mileage,
              bodyType,
              transmission,
              engine: engine || '—',
              exteriorColor: exteriorColor || 'Otro',
              ownerCount,
              tireLife,
              hasAC,
              hasSoundSystem,
              hadMajorCrash,
              isOperational,
              isSignatory,
              acceptsTradeIn,
              doorCount,
              is4x4,
              isArmored,
              description,
              images: uploadedImages,
              seller: {
                uid: concesionario.owner_uid,
                displayName: concesionario.nombre_empresa,
                accountType: 'dealer',
                logoUrl: concesionario.logo_url || '',
                heroUrl: concesionario.banner_url || '',
                address: concesionario.direccion,
                isVerified: true,
                isSaaSBusiness: true,
                saasSlug: concesionario.slug,
                businessId: concesionario.id,
                phone: concesionario.telefono || ''
              },
              location: {
                city: 'Caracas', // Could be updated via dealer settings
                state: 'Miranda',
                lat: concesionario.geolocalizacion?.latitude || 10.4806,
                lon: concesionario.geolocalizacion?.longitude || -66.9036
              },
              asignado_a: asignadoA || null,
              assignedSeller: asignadoA ? (() => {
                const staff = staffList.find(s => s.id === asignadoA);
                return staff ? { nombre: staff.nombre, telefono: staff.telefono || '' } : null;
              })() : null,
              createdAt: (editingVehicle as any)?.created_at || serverTimestamp(),
              status: finalEstadoStock === 'publico_web' ? 'active' : 'paused'
            };
            await setDoc(publicRef, publicVehicleData);
          } else if (editingVehicle && (editingVehicle as any).estado_stock === 'publico_web') {
            await deleteDoc(publicRef);
          }
        }
      }

      // Wishlist check
      const checkWishlists = async () => {
        try {
          const clientsRef = collection(firestore, 'concesionarios', concesionarioId, 'clientes');
          const snap = await getDocs(clientsRef);
          const clientsWithWishlist = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Cliente))
            .filter((c: Cliente) => c.vehiculos_requeridos && c.vehiculos_requeridos.length > 0);

          for (const client of clientsWithWishlist) {
            const matches = client.vehiculos_requeridos?.filter((req: VehiculoRequerido) => 
              req.status === 'pendiente' &&
              req.make.toLowerCase() === make.toLowerCase() &&
              (req.model.toLowerCase() === model.toLowerCase() || model.toLowerCase().includes(req.model.toLowerCase()))
            );

            if (matches && matches.length > 0) {
              toast({
                title: '✨ Coincidencia en Wishlist',
                description: `${client.nombre} ${client.apellido} busca un ${make} ${model}. ¡Contáctalo!`,
                variant: 'default',
              });
            }
          }
        } catch (e) {
          console.error('[Wishlist Check] Error:', e);
        }
      };

      if (!editingVehicle) {
        checkWishlists();
      }

      setUploadProgress(100);
      setCurrentStep(5); // Show success screen
    } catch (error) {
      console.error('[VehicleForm] Error saving:', error);
      toast({
        title: 'Error al guardar',
        description: 'Ocurrió un error. Verifica tu conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && currentStep === 5) {
      onSave(savedVehicleId || undefined);
    }
    onOpenChange(isOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem]">

        {currentStep < 5 && (
          <DialogHeader>
            <DialogTitle className="text-xl font-headline">
              {editingVehicle ? 'Editar Vehículo' : 'Agregar Vehículo'}
            </DialogTitle>
            <DialogDescription>
              Paso {currentStep} de 4
            </DialogDescription>
          </DialogHeader>
        )}

        {/* STEP 1: Basic Data */}
        {currentStep === 1 && (
          <div className="space-y-4 py-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <Sparkles className="h-5 w-5 text-purple-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Auto-rellenar con IA</p>
                <p className="text-xs text-muted-foreground">Selecciona marca, modelo y año, luego presiona.</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleAIFill} disabled={isAILoading || !make || !model} className="shrink-0">
                {isAILoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Cargando...</> : <><Sparkles className="h-4 w-4 mr-1" /> Rellenar</>}
              </Button>
            </div>



            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_2fr_2fr_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo *</Label>
                  <Select value={vehicleType} onValueChange={(v) => { setVehicleType(v); setMake(''); setModel(''); }}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(fallbackData).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Marca *</Label>
                  <Input list="makes-list" value={make} onChange={e => { setMake(e.target.value); setModel(''); }} placeholder="Escribe la marca..." />
                  <datalist id="makes-list">
                    {makes.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo *</Label>
                  <Input list="models-list" value={model} onChange={e => setModel(e.target.value)} disabled={!make} placeholder="Escribe el modelo..." />
                  <datalist id="models-list">
                    {models.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>Año *</Label>
                  <Input type="number" min={1900} max={new Date().getFullYear() + 1} value={year} onChange={e => setYear(Number(e.target.value))} placeholder="Ej: 2024" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Transmisión</Label>
                  <Select value={transmission} onValueChange={(v) => setTransmission(v as 'Automática' | 'Sincrónica')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sincrónica">Sincrónica</SelectItem>
                      <SelectItem value="Automática">Automática</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Motor</Label>
                  <Input value={engine} onChange={e => setEngine(e.target.value)} placeholder="Ej: 1.8L 4 cil." />
                </div>
                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <Input list="colors-list" value={exteriorColor} onChange={e => setExteriorColor(e.target.value)} placeholder="Ej: Blanco" />
                  <datalist id="colors-list">
                    {COLORS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kilometraje</Label>
                  <Input type="number" min={0} value={mileage} onChange={e => setMileage(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Precio de Compra ($)</Label>
                  <Input type="number" min={0} value={costoCompra} onChange={e => setCostoCompra(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del vehículo..." rows={3} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium">Es Consignación</Label>
                  <p className="text-xs text-muted-foreground">Vehículo de un vendedor particular</p>
                </div>
                <Switch checked={esConsignacion} onCheckedChange={setEsConsignacion} />
              </div>
              {esConsignacion && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-purple-500/30">
                  <div className="space-y-1.5">
                    <Label>ID Vendedor Particular</Label>
                    <Input value={consignacionVendedorId} onChange={e => setConsignacionVendedorId(e.target.value)} placeholder="ID o nombre" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comisión Acordada (%)</Label>
                    <Input type="number" min={0} max={100} step="any" value={consignacionComision} onChange={e => setConsignacionComision(Number(e.target.value))} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={nextStep}>
                Siguiente <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Technical Details */}
        {currentStep === 2 && (
          <div className="space-y-6 py-4 animate-in slide-in-from-right">
            <div className="grid grid-cols-2 gap-6">
              {/* Columna Izquierda */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Aire Acondicionado</Label>
                  <Switch checked={hasAC} onCheckedChange={setHasAC} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Vehículo Operativo</Label>
                  <Switch checked={isOperational} onCheckedChange={setIsOperational} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Dueño Firmante</Label>
                  <Switch checked={isSignatory} onCheckedChange={setIsSignatory} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Tracción 4x4 / AWD</Label>
                  <Switch checked={is4x4} onCheckedChange={setIs4x4} />
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-sm">Número de puertas</Label>
                  <RadioGroup defaultValue={String(doorCount)} onValueChange={(v) => setDoorCount(Number(v) as 2 | 4)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="2" id="door-2" />
                      <Label htmlFor="door-2">2 Puertas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="4" id="door-4" />
                      <Label htmlFor="door-4">4 Puertas</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Columna Derecha */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Historial de Choque Fuerte</Label>
                  <Switch checked={hadMajorCrash} onCheckedChange={setHadMajorCrash} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Sistema de Sonido</Label>
                  <Switch checked={hasSoundSystem} onCheckedChange={setHasSoundSystem} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Vehículo Blindado</Label>
                  <Switch checked={isArmored} onCheckedChange={setIsArmored} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Acepta Cambio</Label>
                  <Switch checked={acceptsTradeIn} onCheckedChange={setAcceptsTradeIn} />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Vida cauchos (%)</Label>
                    <Input type="number" min={0} max={100} value={tireLife} onChange={e => setTireLife(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">N° Dueños</Label>
                    <Input type="number" min={1} max={10} value={ownerCount} onChange={e => setOwnerCount(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={prevStep}>
                <ChevronLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button onClick={nextStep}>
                Siguiente <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Photos and Final Config */}
        {currentStep === 3 && (
          <div className="space-y-4 py-4 animate-in slide-in-from-right">

            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 p-3 rounded-lg text-sm mb-4">
              <strong>Aviso:</strong> Para publicar en el marketplace, el vehículo debe tener <strong>al menos 4 fotos</strong>. Si subes menos, se guardará en tu inventario como "Pausado".
            </div>

            {existingImages.length > 0 && (
              <div className="space-y-2">
                <Label>Fotos actuales</Label>
                <div className="grid grid-cols-4 gap-2">
                  {existingImages.map((img, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border group">
                      <Image src={img.url} alt={img.alt} fill className="object-cover" />

                      <Badge
                        variant={coverSelection?.type === 'existing' && coverSelection.index === i ? 'default' : 'secondary'}
                        className={`absolute top-1 left-1 cursor-pointer transition-colors px-1.5 py-0 text-xs ${coverSelection?.type === 'existing' && coverSelection.index === i ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                        onClick={() => setCoverSelection({ type: 'existing', index: i })}
                      >
                        <Star className={`h-3 w-3 mr-1 ${coverSelection?.type === 'existing' && coverSelection.index === i ? 'fill-white' : ''}`} />
                        Portada
                      </Badge>

                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeExistingImage(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imagePreviews.length > 0 && (
              <div className="space-y-2">
                <Label>Nuevas fotos</Label>
                <div className="grid grid-cols-4 gap-2">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border group">
                      <Image src={preview} alt={`Preview ${i + 1}`} fill className="object-cover" />

                      <Badge
                        variant={coverSelection?.type === 'new' && coverSelection.index === i ? 'default' : 'secondary'}
                        className={`absolute top-1 left-1 cursor-pointer transition-colors px-1.5 py-0 text-xs ${coverSelection?.type === 'new' && coverSelection.index === i ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                        onClick={() => setCoverSelection({ type: 'new', index: i })}
                      >
                        <Star className={`h-3 w-3 mr-1 ${coverSelection?.type === 'new' && coverSelection.index === i ? 'fill-white' : ''}`} />
                        Portada
                      </Badge>

                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeNewImage(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="cursor-pointer block mt-2">
              <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click para agregar fotos</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP</p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </label>

            <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t">
              <div className="space-y-1.5">
                <Label>Estado Inicial</Label>
                <Select value={estadoStock} onValueChange={(v) => setEstadoStock(v as StockStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="privado_taller">En Taller</SelectItem>
                    <SelectItem value="publico_web">Publicado</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="reservado">Reservado</SelectItem>
                    <SelectItem value="vendido">Vendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Asignar a Vendedor</Label>
                <Select value={asignadoA || 'none'} onValueChange={(v) => setAsignadoA(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-6 gap-4">
              <Button variant="outline" onClick={prevStep} disabled={isSaving} className="shrink-0">
                <ChevronLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button onClick={() => {
                if (precioVenta === 0 && costoCompra > 0) {
                  const defaultMargin = concesionario?.configuracion?.margen_minimo || 10;
                  const suggestedPrice = costoCompra * (1 + defaultMargin / 100);
                  setPrecioVenta(Math.ceil(suggestedPrice / 100) * 100);
                }
                setCurrentStep(4);
              }} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
                Siguiente <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Pricing and Commission */}
        {currentStep === 4 && (
          <div className="space-y-4 py-4 animate-in slide-in-from-right">

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Precio de Compra Registrado</p>
                  <p className="text-2xl font-bold font-headline text-amber-900">{formatCurrency(costoCompra)}</p>
                </div>
                <div className="hidden sm:block text-amber-200 h-10 w-px bg-border"></div>
                <div>
                  <Label>Precio de Venta ($)</Label>
                  <Input
                    type="number"
                    min={costoCompra}
                    className="text-lg font-bold w-full sm:w-48 mt-1 border-amber-300 focus-visible:ring-amber-500"
                    value={precioVenta}
                    onChange={e => setPrecioVenta(Number(e.target.value))}
                  />
                  {precioVenta > 0 && costoCompra > 0 && (
                    <p className="text-xs text-green-700 font-medium mt-1">
                      Ganancia estimada: {formatCurrency(precioVenta - costoCompra)} ({((precioVenta - costoCompra) / costoCompra * 100).toFixed(1)}%)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {marketPrice ? (
              marketPrice.found ? (
                <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100/50 flex flex-col gap-1">
                  <p className="text-sm text-blue-800"> <span className="font-medium">{marketPrice.message}</span></p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1">
                  <p className="text-sm text-slate-600 text-center font-medium">No hay suficientes carros "{make} {model}" publicados en Zona Motores para dar un estimado.</p>
                </div>
              )
            ) : null}

            {asignadoA && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 mt-4">
                <p className="text-sm font-medium mb-1 text-blue-900">Comisión de Venta Asignada</p>
                {(() => {
                  const staff = staffList?.find((s: any) => s.id === asignadoA);
                  const commissionPct = staff?.comision_porcentaje || concesionario?.configuracion?.estructura_comision || 0;
                  const estimatedEarning = (precioVenta * (commissionPct / 100));
                  return (
                    <p className="text-sm text-blue-700">
                      Al venderse por el precio fijado, <strong>{staff?.nombre}</strong> recibiría una comisión estimada de <strong>{formatCurrency(estimatedEarning)}</strong> ({commissionPct}%).
                    </p>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-between items-center pt-6 gap-4">
              <Button variant="outline" onClick={prevStep} disabled={isSaving} className="shrink-0">
                <ChevronLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              {isSaving && (
                <div className="flex-1 max-w-[200px] w-full items-center justify-center flex flex-col space-y-2">
                  <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-wider">Publicando ({uploadProgress}%)</p>
                  <Progress value={uploadProgress} className="h-1.5 w-full bg-muted shadow-inner" />
                </div>
              )}
              <Button
                onClick={() => {
                  if (precioVenta < costoCompra) {
                    toast({ title: 'Aviso', description: 'El precio de venta no puede ser menor al de compra.', variant: 'destructive' });
                    return;
                  }
                  handleSave();
                }}
                disabled={isSaving}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Espere...</> : 'Confirmar Compra'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Success Screen */}
        {currentStep === 5 && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-500">
            <div className="rounded-full bg-blue-100 p-3 animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-blue-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">¡Publicación Guardada!</h2>
              <p className="text-muted-foreground max-w-sm">
                El vehículo ha sido guardado en el inventario exitosamente.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => handleOpenChange(false)}
              >
                Cerrar
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setCostsDialogOpen(true)}
              >
                Agregar Costos
              </Button>
              <Button
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setInfoExtraDialogOpen(true)}
              >
                Agregar Información Extra
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>

    {/* Sub-dialogs rendered in portal to avoid nesting issues */}
    {savedVehicleSnapshot && (
      <>
        <VehicleCostsDialog
          open={costsDialogOpen}
          onOpenChange={setCostsDialogOpen}
          vehicle={savedVehicleSnapshot}
          concesionarioId={concesionarioId}
          onSave={() => onSave(savedVehicleId || undefined)}
        />
        <VehicleInfoExtraDialog
          open={infoExtraDialogOpen}
          onOpenChange={setInfoExtraDialogOpen}
          vehicle={savedVehicleSnapshot}
          concesionarioId={concesionarioId}
          onSave={() => onSave(savedVehicleId || undefined)}
        />
      </>
    )}
  </>);
}
