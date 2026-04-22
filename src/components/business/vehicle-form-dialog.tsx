'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
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
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Plus,
  X,
  ImagePlus,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Star,
  Info,
  DollarSign,
  Gauge,
  Car,
  TrendingUp,
  User,
  Phone,
  Settings,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import type {
  StockVehicle,
  StockStatus,
  GastoAdecuacion,
} from '@/lib/business-types';
import { formatCurrency, cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { fallbackData } from '@/lib/makes-fallback-data';
import { Combobox } from '@/components/ui/combobox';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVehicle: StockVehicle | null;
  concesionarioId: string;
  onSave: (savedVehicleId?: string) => void;
}

const VEHICLE_TYPES = ['Carro', 'Moto', 'Camioneta'];
const COLORS = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Marrón', 'Dorado', 'Naranja', 'Amarillo', 'Beige', 'Otro'];

export function VehicleFormDialog({ open, onOpenChange, editingVehicle, concesionarioId, onSave }: VehicleFormDialogProps) {
  const { staffList, concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [coverSelection, setCoverSelection] = useState<{ type: 'existing' | 'new'; index: number } | null>(null);

  // --- Step 1: Basics ---
  const [vehicleType, setVehicleType] = useState<string>('Carro');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [mileage, setMileage] = useState(0);
  const [exteriorColor, setExteriorColor] = useState('Blanco');
  const [description, setDescription] = useState('');

  // --- Step 2: Financial & Assignment ---
  const [esConsignacion, setEsConsignacion] = useState(false);
  const [costoCompra, setCostoCompra] = useState(0);
  const [ownerAskingPrice, setOwnerAskingPrice] = useState(0);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [asignadoA, setAsignadoA] = useState('');

  // --- Step 3: Technical Features ---
  const [transmission, setTransmission] = useState<'Automática' | 'Sincrónica'>('Sincrónica');
  const [engine, setEngine] = useState('');
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

  // --- Step 4: Sales Price & Market ---
  const [precioVenta, setPrecioVenta] = useState(0);
  const [marketInfo, setMarketMessage] = useState<{ message: string; found: boolean } | null>(null);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  // --- Step 5: Photos ---
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<{ url: string; alt: string }[]>([]);

  // Internal persistent states
  const [gastos, setGastos] = useState<GastoAdecuacion[]>([]);
  const [estadoStock, setEstadoStock] = useState<StockStatus>('privado_taller');

  // Derived options for selects
  const makeOptions = useMemo(() => {
    const typeData = (fallbackData as any)[vehicleType] || {};
    return Object.keys(typeData).sort().map(m => ({ label: m, value: m }));
  }, [vehicleType]);

  const modelOptions = useMemo(() => {
    const typeData = (fallbackData as any)[vehicleType] || {};
    const models = typeData[make] || [];
    return models.sort().map((m: string) => ({ label: m, value: m }));
  }, [vehicleType, make]);

  useEffect(() => {
    if (open && editingVehicle) {
      setVehicleType(editingVehicle.vehicleType || 'Carro');
      setMake(editingVehicle.make || '');
      setModel(editingVehicle.model || '');
      setYear(editingVehicle.year || new Date().getFullYear());
      setMileage(editingVehicle.mileage || 0);
      setExteriorColor(editingVehicle.exteriorColor || 'Blanco');
      setDescription(editingVehicle.description || '');

      setEsConsignacion(editingVehicle.es_consignacion || false);
      setCostoCompra(editingVehicle.costo_compra || 0);
      setOwnerAskingPrice((editingVehicle as any).consignacion_info?.owner_asking_price || 0);
      setOwnerName((editingVehicle as any).consignacion_info?.owner_name || '');
      setOwnerPhone((editingVehicle as any).consignacion_info?.owner_phone || '');
      setAsignadoA(editingVehicle.asignado_a || '');

      setTransmission(editingVehicle.transmission || 'Sincrónica');
      setEngine(editingVehicle.engine || '');
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

      setPrecioVenta(editingVehicle.precio_venta || 0);
      setExistingImages(editingVehicle.images || []);
      setEstadoStock(editingVehicle.estado_stock || 'privado_taller');
      setGastos(editingVehicle.gastos_adecuacion || []);
      setCoverSelection(editingVehicle.images?.length ? { type: 'existing', index: 0 } : null);
      setCurrentStep(1);
    } else if (open) {
      resetForm();
    }
  }, [open, editingVehicle]);

  // Market logic trigger
  useEffect(() => {
    if (currentStep === 4 && make && model && year) {
      const fetchPrice = async () => {
        setIsLoadingMarket(true);
        try {
          const res = await fetch('/api/vehicle-market-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ make, model, year }),
          });
          const data = await res.json();
          setMarketMessage(data);
        } catch { setMarketMessage(null); }
        finally { setIsLoadingMarket(false); }
      };
      fetchPrice();
    }
  }, [currentStep, make, model, year]);

  const resetForm = () => {
    setVehicleType('Carro'); setMake(''); setModel(''); setYear(new Date().getFullYear());
    setMileage(0); setExteriorColor('Blanco'); setDescription('');
    setEsConsignacion(false); setCostoCompra(0); setOwnerAskingPrice(0); setOwnerName(''); setOwnerPhone(''); setAsignadoA('');
    setTransmission('Sincrónica'); setEngine(''); setHadMajorCrash(false); setHasAC(true);
    setIsOperational(true); setIsSignatory(true); setDoorCount(4); setIs4x4(false);
    setHasSoundSystem(false); setIsArmored(false); setAcceptsTradeIn(false); setOwnerCount(1); setTireLife(75);
    setPrecioVenta(0); setImageFiles([]); setImagePreviews([]); setExistingImages([]);
    setCurrentStep(1); setCoverSelection(null); setMarketMessage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (imageFiles.length + existingImages.length + files.length > 12) {
        toast({ title: 'Límite de fotos', description: 'Máximo 12 fotografías permitidas.', variant: 'destructive' });
        return;
      }
      setImageFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
      if (!coverSelection && newPreviews.length > 0) {
        setCoverSelection({ type: 'new', index: imagePreviews.length });
      }
    }
  };

  const removeNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (coverSelection?.type === 'new' && coverSelection.index === index) setCoverSelection(null);
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
    if (coverSelection?.type === 'existing' && coverSelection.index === index) setCoverSelection(null);
  };

  const handleSubmit = async () => {
    const totalPhotos = existingImages.length + imageFiles.length;
    if (totalPhotos < 4) {
      toast({ title: 'Faltan fotos', description: 'Requiere al menos 4 fotografías para registrar.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const uploadedImages = [...existingImages];
      for (const file of imageFiles) {
        const imageRef = ref(storage, `concesionarios/${concesionarioId}/inventario/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(imageRef, file);
        const url = await getDownloadURL(snap.ref);
        uploadedImages.push({ url, alt: `${make} ${model}` });
      }

      if (coverSelection) {
        const coverImg = coverSelection.type === 'existing'
          ? existingImages[coverSelection.index]
          : uploadedImages[existingImages.length + coverSelection.index];
        if (coverImg) {
          const others = uploadedImages.filter(img => img.url !== coverImg.url);
          uploadedImages.splice(0, uploadedImages.length, coverImg, ...others);
        }
      }

      const vehicleData: any = {
        vehicleType, make, model, year, transmission, engine, exteriorColor, mileage, description,
        images: uploadedImages, estado_stock: estadoStock, precio_venta: precioVenta,
        costo_compra: costoCompra, gastos_adecuacion: gastos,
        ganancia_neta_estimada: precioVenta - (esConsignacion ? 0 : costoCompra) - gastos.reduce((a, b) => a + (b.monto || 0), 0),
        es_consignacion: esConsignacion,
        consignacion_info: esConsignacion ? {
          owner_name: ownerName,
          owner_phone: ownerPhone,
          owner_asking_price: ownerAskingPrice
        } : null,
        asignado_a: asignadoA,
        hadMajorCrash, hasAC, isOperational, isSignatory, doorCount, is4x4, hasSoundSystem, isArmored, acceptsTradeIn, ownerCount, tireLife,
        updated_at: serverTimestamp(),
      };

      let finalVehicleId = editingVehicle?.id;
      if (editingVehicle) {
        await updateDoc(doc(firestore, 'concesionarios', concesionarioId, 'inventario', editingVehicle.id), vehicleData);
      } else {
        vehicleData.created_at = serverTimestamp();
        const newDocRef = await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'inventario'), vehicleData);
        finalVehicleId = newDocRef.id;
      }

      // Sync to public marketplace
      if (concesionario && finalVehicleId && concesionario.owner_uid) {
        const publicRef = doc(firestore, 'users', concesionario.owner_uid, 'vehicleListings', finalVehicleId);
        if (estadoStock === 'publico_web' || estadoStock === 'pausado') {
          const publicVehicleData = {
            id: finalVehicleId, sellerId: concesionario.owner_uid, make, model, year,
            priceUSD: precioVenta, mileage, transmission, engine: engine || '—',
            exteriorColor, ownerCount, tireLife, hasAC, hasSoundSystem, hadMajorCrash, isOperational, isSignatory, acceptsTradeIn, doorCount,
            vehicleType, is4x4, isArmored, description, images: uploadedImages,
            status: estadoStock === 'publico_web' ? 'active' : 'paused',
            isDealership: true, dealershipId: concesionarioId, dealershipSlug: concesionario.slug,
            dealershipName: concesionario.nombre, location: concesionario.ubicacion || null, updatedAt: serverTimestamp(),
          };
          await updateDoc(publicRef, publicVehicleData).catch(() => setDoc(publicRef, publicVehicleData));
        } else {
          await updateDoc(publicRef, { status: 'sold' }).catch(() => { });
        }
      }

      toast({ title: 'Unidad Registrada', description: `${make} ${model} guardado con éxito.` });
      onSave(finalVehicleId);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const nextStep = () => {
    if (currentStep === 1) {
      // Accept exact value match OR case-insensitive label match (user typed without clicking)
      const validMake = makeOptions.some(
        (opt) => opt.value === make || opt.label.toLowerCase() === make.toLowerCase()
      );
      const validModel = modelOptions.some(
        (opt) => opt.value === model || opt.label.toLowerCase() === model.toLowerCase()
      );

      if (!make || !model) {
        toast({
          title: 'Campos requeridos',
          description: 'Debes indicar la Marca y el Modelo del vehículo.',
          variant: 'destructive',
        });
        return;
      }

      if (!validMake || !validModel) {
        toast({
          title: 'Selección Inválida',
          description: 'Debes seleccionar una Marca y Modelo de la lista sugerida.',
          variant: 'destructive',
        });
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };
  const prevStep = () => setCurrentStep(prev => prev - 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl bg-background">
        <div className="flex flex-col h-[90vh] md:h-auto max-h-[95vh]">
          {/* Header */}
          <div className="p-8 border-b border-border/40 bg-muted/20 relative">
            <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-500" style={{ width: `${(currentStep / 5) * 100}%` }} />
            <DialogHeader>
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <Car className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-3xl font-black font-headline tracking-tighter">
                    {editingVehicle ? 'Actualizar Expediente' : 'Ingresar Nueva Unidad'}
                  </DialogTitle>
                  <DialogDescription className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                    Paso {currentStep} de 5 • {currentStep === 1 ? 'Identificación' : currentStep === 2 ? 'Administración' : currentStep === 3 ? 'Características' : currentStep === 4 ? 'Valoración' : 'Visuales'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-10">
            {/* ─── STEP 1: IDENTIFICATION ─── */}
            {currentStep === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest ml-1">Tipo de Vehículo</Label>
                      <Select value={vehicleType} onValueChange={(v) => { setVehicleType(v); setMake(''); setModel(''); }}>
                        <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none focus:bg-background transition-all"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {VEHICLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">Marca de Unidad</Label>
                        <Combobox
                          options={makeOptions}
                          value={make}
                          onChange={(v) => { setMake(v); setModel(''); }}
                          placeholder="Escribe o selecciona marca"
                          notFoundMessage="Marca no registrada"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">Modelo Específico</Label>
                        <Combobox
                          options={modelOptions}
                          value={model}
                          onChange={setModel}
                          placeholder="Escribe o selecciona modelo"
                          notFoundMessage="Modelo no en lista"
                          disabled={!make}
                          className="w-full"
                        />
                      </div>
                    </div>

                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest ml-1">Año</Label>
                        <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="h-12 rounded-xl bg-muted/30 border-none" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest ml-1">Kilometraje</Label>
                        <div className="relative">
                          <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="number" value={mileage} onChange={e => setMileage(Number(e.target.value))} className="pl-10 h-12 rounded-xl bg-muted/30 border-none" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest ml-1">Color Exterior</Label>
                      <Select value={exteriorColor} onValueChange={setExteriorColor}>
                        <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none focus:bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest ml-1">Descripción Detallada</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[140px] rounded-[2rem] bg-muted/30 border-none p-6 text-base font-medium" placeholder="Estado del motor, cauchos, extras instalados..." />
                </div>
              </div>
            )}

            {/* ─── STEP 2: ADMINISTRATION ─── */}
            {currentStep === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="p-8 rounded-[3rem] bg-muted/20 border border-border/40 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-lg font-black uppercase tracking-tighter">Es Consignación</Label>
                      <p className="text-xs text-muted-foreground">Activa si el vehículo pertenece a un tercero.</p>
                    </div>
                    <Switch checked={esConsignacion} onCheckedChange={setEsConsignacion} className="scale-125 data-[state=checked]:bg-primary" />
                  </div>

                  <Separator className="bg-border/40" />

                  {!esConsignacion ? (
                    <div className="space-y-4 py-4">
                      <Label className="text-sm font-black uppercase tracking-widest opacity-60">Inversión / Costo de Compra (USD)</Label>
                      <div className="relative max-w-sm">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                        <Input type="number" value={costoCompra} onChange={e => setCostoCompra(Number(e.target.value))} className="pl-12 h-16 rounded-2xl bg-background border-2 border-primary/20 text-2xl font-black text-primary shadow-inner" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 animate-in zoom-in-95">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign className="h-3 w-3" /> Precio Dueño</Label>
                        <Input type="number" value={ownerAskingPrice} onChange={e => setOwnerAskingPrice(Number(e.target.value))} className="h-12 rounded-xl bg-background border-none shadow-sm" placeholder="Monto neto para el dueño" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest ml-1 flex items-center gap-2"><User className="h-3 w-3" /> Nombre del Dueño</Label>
                        <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} className="h-12 rounded-xl bg-background border-none shadow-sm" placeholder="Nombre completo" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs font-black uppercase tracking-widest ml-1 flex items-center gap-2"><Phone className="h-3 w-3" /> Teléfono de Contacto</Label>
                        <Input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="h-12 rounded-xl bg-background border-none shadow-sm" placeholder="Ej: 0412 000 0000" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 rounded-[3rem] bg-primary/5 border border-primary/20 space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest ml-1 flex items-center gap-2 text-primary"><Zap className="h-4 w-4" /> Vendedor Interno Responsable</Label>
                  <Select value={asignadoA} onValueChange={setAsignadoA}>
                    <SelectTrigger className="h-14 rounded-2xl bg-background border-none shadow-xl"><SelectValue placeholder="Seleccionar vendedor del staff" /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {staffList.filter(s => s.activo).map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* ─── STEP 3: TECHNICAL FEATURES ─── */}
            {currentStep === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {[
                    { l: 'A/C Operativo', v: hasAC, s: setHasAC },
                    { l: 'Unidad Rodando', v: isOperational, s: setIsOperational },
                    { l: 'Firma de Título', v: isSignatory, s: setIsSignatory },
                    { l: 'Tracción 4x4', v: is4x4, s: setIs4x4 },
                    { l: 'Sonido Premium', v: hasSoundSystem, s: setHasSoundSystem },
                    { l: 'Blindaje', v: isArmored, s: setIsArmored },
                    { l: 'Acepta Cambio', v: acceptsTradeIn, s: setAcceptsTradeIn },
                    { l: 'Choque Fuerte', v: hadMajorCrash, s: setHadMajorCrash },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-muted/20 border border-border/40">
                      <span className="text-[10px] font-black uppercase tracking-tighter">{item.l}</span>
                      <Switch checked={item.v} onCheckedChange={item.s} className="data-[state=checked]:bg-blue-600" />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4 p-8 rounded-[3rem] bg-muted/20 border border-border/40">
                    <Label className="text-xs font-black uppercase tracking-widest text-center block opacity-60">Ficha Motriz</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[9px] font-bold opacity-40 uppercase">Transmisión</Label>
                        <Select value={transmission} onValueChange={(v: any) => setTransmission(v)}>
                          <SelectTrigger className="h-10 bg-background border-none rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Sincrónica">Sincrónica</SelectItem><SelectItem value="Automática">Automática</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-bold opacity-40 uppercase">Detalle Motor</Label>
                        <Input value={engine} onChange={e => setEngine(e.target.value)} className="h-10 bg-background border-none rounded-xl" placeholder="Ej: 1.8L VVT-i" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 p-8 rounded-[3rem] bg-muted/20 border border-border/40">
                    <Label className="text-xs font-black uppercase tracking-widest text-center block opacity-60">Configuración Física</Label>
                    <div className="flex justify-between items-center gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-tighter">N° Puertas</p>
                        <RadioGroup value={String(doorCount)} onValueChange={v => setDoorCount(Number(v) as any)} className="flex gap-4">
                          <div className="flex items-center gap-1.5"><RadioGroupItem value="2" id="d2" /><Label htmlFor="d2" className="text-xs font-bold">2</Label></div>
                          <div className="flex items-center gap-1.5"><RadioGroupItem value="4" id="d4" /><Label htmlFor="d4" className="text-xs font-bold">4</Label></div>
                        </RadioGroup>
                      </div>
                      <div className="flex-1 space-y-1 text-right">
                        <p className="text-[10px] font-black uppercase tracking-tighter">Cauchos: {tireLife}%</p>
                        <Input type="range" min={0} max={100} value={tireLife} onChange={e => setTireLife(Number(e.target.value))} className="accent-blue-600 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 4: VALUATION ─── */}
            {currentStep === 4 && (
              <div className="space-y-8 animate-in fade-in scale-in-95 duration-500">
                <div className="flex flex-col items-center justify-center p-12 rounded-[3.5rem] bg-primary/5 border border-primary/20 space-y-8">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign className="h-10 w-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <Label className="text-lg font-black uppercase tracking-widest text-primary/80">Establecer Precio de Venta</Label>
                    <p className="text-sm text-muted-foreground font-medium">Este monto será el publicado en la web y base para negociaciones.</p>
                  </div>

                  <div className="relative group w-full max-w-md">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-5xl font-black text-primary/20 group-focus-within:text-primary transition-all">$</span>
                    <Input type="number" value={precioVenta} onChange={e => setPrecioVenta(Number(e.target.value))} className="pl-16 h-28 rounded-[2.5rem] bg-background border-4 border-primary/20 focus:border-primary text-5xl font-black text-center text-primary shadow-2xl" placeholder="0.00" />
                  </div>

                  {isLoadingMarket ? (
                    <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-widest">Consultando precios de mercado...</span>
                    </div>
                  ) : marketInfo && (
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex items-center gap-4 max-w-xl transition-all",
                      marketInfo.found ? "bg-white/60 border-primary/20 text-primary shadow-sm" : "bg-muted/40 border-transparent text-muted-foreground"
                    )}>
                      <div className="p-3 rounded-xl bg-primary/10"><TrendingUp className="h-6 w-6" /></div>
                      <p className="text-sm font-bold leading-relaxed">{marketInfo.message}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── STEP 5: VISUALS ─── */}
            {currentStep === 5 && (
              <div className="space-y-8 animate-in fade-in scale-in-95 duration-500">
                <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><ImagePlus className="h-8 w-8" /></div>
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-widest text-primary text-sm">Material Audiovisual</p>
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed pr-8">
                      Se requieren al menos <strong>4 fotos</strong> para publicar. Las mejores ventas se cierran con 8 a 12 fotos nítidas.
                      {imageFiles.length + existingImages.length > 0 && <span className="text-primary font-bold ml-2">Total actual: {imageFiles.length + existingImages.length} fotos</span>}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                  {existingImages.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden border-2 group transition-all hover:shadow-lg">
                      <Image src={img.url} alt="" fill className="object-cover" />
                      <button onClick={() => removeExistingImage(i)} className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                      <button onClick={() => setCoverSelection({ type: 'existing', index: i })} className={cn("absolute bottom-3 left-3 p-1.5 rounded-xl transition-all", coverSelection?.type === 'existing' && coverSelection.index === i ? "bg-primary text-white scale-110 shadow-lg" : "bg-black/40 text-white/50 opacity-0 group-hover:opacity-100")}><Star className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden border-2 border-primary/20 group animate-in zoom-in-50">
                      <Image src={preview} alt="" fill className="object-cover" />
                      <button onClick={() => removeNewImage(i)} className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                      <button onClick={() => setCoverSelection({ type: 'new', index: i })} className={cn("absolute bottom-3 left-3 p-1.5 rounded-xl transition-all", coverSelection?.type === 'new' && coverSelection.index === i ? "bg-primary text-white scale-110 shadow-lg" : "bg-black/40 text-white/50 opacity-0 group-hover:opacity-100")}><Star className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {existingImages.length + imageFiles.length < 12 && (
                    <label className="aspect-square rounded-[2.5rem] border-4 border-dashed border-primary/10 bg-primary/5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-primary/10 hover:border-primary/20 transition-all group">
                      <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform"><Plus className="h-8 w-8" /></div>
                      <span className="text-[10px] font-black uppercase tracking-tighter opacity-60">Añadir Foto</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-8 border-t border-border/40 bg-muted/20 flex items-center justify-between">
            <Button 
              variant="ghost" 
              className="rounded-2xl h-14 px-8 font-black uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground active:scale-95 transition-all" 
              onClick={(e) => { e.preventDefault(); prevStep(); }} 
              disabled={isSaving}
            >
              {currentStep > 1 ? <><ChevronLeft className="h-4 w-4 mr-2" /> Atrás</> : 'Cancelar'}
            </Button>

            <div className="flex gap-4">
              {currentStep < 5 ? (
                <Button 
                  className="rounded-2xl h-14 px-10 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all bg-primary hover:bg-primary/90" 
                  onClick={(e) => { e.preventDefault(); nextStep(); }}
                >
                  Siguiente Paso <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  className="rounded-3xl h-16 px-12 font-black uppercase text-sm tracking-[0.1em] shadow-2xl shadow-primary/30 active:scale-95 transition-all bg-primary hover:bg-primary/90" 
                  onClick={(e) => { e.preventDefault(); handleSubmit(); }} 
                  disabled={isSaving || (existingImages.length + imageFiles.length < 4)}
                >
                  {isSaving ? <><Loader2 className="h-5 w-5 animate-spin mr-3" /> Procesando...</> : <><CheckCircle2 className="h-5 w-5 mr-3" /> Finalizar Registro</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
