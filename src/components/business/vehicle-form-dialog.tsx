'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  DollarSign,
  Gauge,
  Car,
  TrendingUp,
  User,
  Phone,
  Zap,
  ShieldCheck,
  Calendar,
  Layers,
  Settings,
  AlertTriangle,
  Info,
  RefreshCcw,
  Volume2,
  Check,
  CircleAlert,
  ArrowUpRight,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import Image from 'next/image';
import type {
  StockVehicle,
  StockStatus,
  GastoAdecuacion,
} from '@/lib/business-types';
import { cn, formatCurrency } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { fallbackData } from '@/lib/makes-fallback-data';
import { Combobox } from '@/components/ui/combobox';
import { VehicleInfoExtraDialog } from './vehicle-info-extra-dialog';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVehicle: StockVehicle | null;
  concesionarioId: string;
  onSave: (savedVehicleId?: string) => void;
}

const VEHICLE_TYPES = ['Carro', 'Moto', 'Camión'];
const COLORS = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Marrón', 'Dorado', 'Naranja', 'Amarillo', 'Beige', 'Otro'];

const STEPS = [
  { id: 1, label: 'Expediente', icon: Car },
  { id: 2, label: 'Admin', icon: Settings },
  { id: 3, label: 'Ficha', icon: Layers },
  { id: 4, label: 'Valoración', icon: DollarSign },
  { id: 5, label: 'Fotos', icon: ImagePlus },
];

async function verifySHA256(text: string, hash: string) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === hash;
}

export function VehicleFormDialog({ open, onOpenChange, editingVehicle, concesionarioId, onSave }: VehicleFormDialogProps) {
  const { staffList, concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [coverSelection, setCoverSelection] = useState<{ type: 'existing' | 'new'; index: number } | null>(null);

  // --- Success Modal State ---
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedVehicleId, setSavedVehicleId] = useState<string | null>(null);
  const [savedVehicleData, setSavedVehicleData] = useState<StockVehicle | null>(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);

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
  const [armorLevel, setArmorLevel] = useState<number>(1);
  const [acceptsTradeIn, setAcceptsTradeIn] = useState(false);
  const [ownerCount, setOwnerCount] = useState(1);
  const [tireLife, setTireLife] = useState(75);

  // --- Step 4: Sales Price & Market ---
  const [precioVenta, setPrecioVenta] = useState(0);
  const [marketInfo, setMarketMessage] = useState<{ message: string; found: boolean; averagePrice?: number } | null>(null);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  // Authorization PIN Logic
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPin, setAuthPin] = useState(['', '', '', '']);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [authUserId, setAuthUserId] = useState('');
  const [authGranted, setAuthGranted] = useState(false);
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // --- Step 5: Photos ---
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<{ url: string; alt: string }[]>([]);

  // Internal persistent states
  const [gastos, setGastos] = useState<GastoAdecuacion[]>([]);
  const [estadoStock, setEstadoStock] = useState<StockStatus>('privado_taller');

  // Computed Values
  const costoTotal = esConsignacion ? ownerAskingPrice : costoCompra;
  const gastosMonto = gastos.reduce((acc, g) => acc + (g.monto || 0), 0);
  const breakEven = costoTotal + gastosMonto;
  const profit = precioVenta - breakEven;
  const isLoss = profit < 0;

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
      setArmorLevel((editingVehicle as any).armorLevel || 1);
      setAcceptsTradeIn(editingVehicle.acceptsTradeIn || false);
      setOwnerCount(editingVehicle.ownerCount || 1);
      setTireLife(editingVehicle.tireLife || 75);

      setPrecioVenta(editingVehicle.precio_venta || 0);
      setExistingImages(editingVehicle.images || []);
      setEstadoStock(editingVehicle.estado_stock || 'privado_taller');
      setGastos(editingVehicle.gastos_adecuacion || []);
      setCoverSelection(editingVehicle.images?.length ? { type: 'existing', index: 0 } : null);
      setCurrentStep(1);
      setAuthGranted(false);
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
    setHasSoundSystem(false); setIsArmored(false); setArmorLevel(1); setAcceptsTradeIn(false); setOwnerCount(1); setTireLife(75);
    setPrecioVenta(0); setImageFiles([]); setImagePreviews([]); setExistingImages([]);
    setCurrentStep(1); setCoverSelection(null); setMarketMessage(null);
    setAuthGranted(false); setShowSuccess(false); setSavedVehicleId(null); setSavedVehicleData(null);
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

  const handlePinInput = (i: number, val: string) => {
    if (val.length > 1) val = val[val.length - 1];
    const p = [...authPin]; p[i] = val; setAuthPin(p);
    if (val && i < 3) pinRefs[i + 1].current?.focus();
  };

  const handleVerifyPin = async () => {
    const pin = authPin.join('');
    if (pin.length !== 4) { toast({ title: 'PIN inválido', description: 'Ingresa 4 dígitos.', variant: 'destructive' }); return; }
    setIsVerifyingPin(true);
    try {
      const s = staffList.find(x => x.id === authUserId);
      if (!s || !s.pin_hash) throw new Error('No autorizado');
      const ok = await verifySHA256(pin, s.pin_hash);
      if (ok) {
        setAuthGranted(true);
        setAuthModalOpen(false);
        toast({ title: 'Autorización concedida' });
      } else {
        toast({ title: 'PIN incorrecto', variant: 'destructive' });
        setAuthPin(['', '', '', '']); pinRefs[0].current?.focus();
      }
    } catch { toast({ title: 'Error', variant: 'destructive' }); } finally { setIsVerifyingPin(false); }
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
        const imageRef = ref(storage, `business-assets/${concesionarioId}/inventario/${Date.now()}_${file.name}`);
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
        hadMajorCrash, hasAC, isOperational, isSignatory, doorCount, is4x4, hasSoundSystem, isArmored, armorLevel, acceptsTradeIn, ownerCount, tireLife,
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
            vehicleType, is4x4, isArmored, armorLevel, description, images: uploadedImages,
            status: estadoStock === 'publico_web' ? 'active' : 'paused',
            isDealership: true, dealershipId: concesionarioId, dealershipSlug: concesionario.slug,
            dealershipName: concesionario.nombre_empresa || concesionario.nombre,
            location: (concesionario as any).ubicacion || null, updatedAt: serverTimestamp(),
            seller: { isSaaSBusiness: true, uid: concesionario.owner_uid },
          };
          await setDoc(publicRef, publicVehicleData);
        } else {
          await updateDoc(publicRef, { status: 'sold', seller: { isSaaSBusiness: true, uid: concesionario.owner_uid } }).catch(() => { });
        }
      }

      setSavedVehicleId(finalVehicleId);
      setSavedVehicleData({ id: finalVehicleId, ...vehicleData } as StockVehicle);
      setShowSuccess(true);
      toast({ title: 'Unidad Registrada', description: `${make} ${model} guardado con éxito.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!make || !model || !year) {
        toast({ title: 'Campos requeridos', description: 'Marca, modelo y año son obligatorios.', variant: 'destructive' });
        return;
      }
      if (String(year).length !== 4) {
        toast({ title: 'Año inválido', description: 'El año debe ser de 4 cifras.', variant: 'destructive' });
        return;
      }
    }
    if (currentStep === 4) {
      if (precioVenta <= 0) {
        toast({ title: 'Precio requerido', description: 'El precio de venta debe ser mayor a cero.', variant: 'destructive' });
        return;
      }
      if (isLoss && !authGranted) {
        setAuthModalOpen(true);
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const handleFinish = () => {
    onSave(savedVehicleId!);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !isSaving && onOpenChange(val)}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-2xl p-0 gap-0 transition-all duration-300 rounded-[2rem]">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-8 text-center animate-in zoom-in-95 duration-500 bg-white/50 dark:bg-slate-950/50 min-h-[450px]">
              <div className="relative">
                <div className="w-24 h-24 bg-blue-500/10 text-blue-600 rounded-3xl flex items-center justify-center relative overflow-hidden shadow-inner border border-blue-100 dark:border-blue-900/30">
                  <CheckCircle2 className="w-14 h-14 animate-[bounce_1s_ease-out_1]" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-700 delay-300">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Vehículo Registrado</h2>
                <p className="text-slate-500 text-sm font-medium max-w-[340px] mx-auto leading-relaxed">
                  La unidad <strong>{make} {model}</strong> ha sido añadida con éxito a tu inventario activo.
                </p>
              </div>

              <div className="w-full max-w-md p-6 rounded-3xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-500 shadow-sm">
                <div className="flex items-center gap-4 text-left">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Expediente Legal Pendiente</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">¿Deseas completar la documentación legal y los seriales de la unidad ahora mismo?</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={() => { setLegalModalOpen(true); }}
                    className="flex-1 h-12 rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 transition-all font-bold gap-2 text-xs uppercase"
                  >
                    Vincular Documentos <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="pt-4 w-full max-w-[200px]">
                <Button
                  variant="ghost"
                  className="w-full h-11 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-widest text-[10px] transition-all"
                  onClick={handleFinish}
                >
                  Omitir por ahora
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Progress Header */}
              <DialogHeader className="p-6 pb-2 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    <div className="p-2.5 bg-primary/10 rounded-xl">
                      <Car className="h-6 w-6 text-primary" />
                    </div>
                    {editingVehicle ? 'Actualizar Expediente' : 'Nueva Unidad'}
                  </DialogTitle>
                </div>

                {/* Step indicator circles with horizontal connection line */}
                <div className="relative flex items-center justify-between px-2 pt-2 pb-4">
                  <div className="absolute top-[26px] left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-10 rounded-full" />
                  {STEPS.map((s, i) => {
                    const stepIdx = i + 1;
                    const isCompleted = currentStep > stepIdx;
                    const isActive = currentStep === stepIdx;

                    return (
                      <div key={s.id} className="flex flex-col items-center gap-2 relative z-10">
                        <div className={cn(
                          'flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all duration-500 shadow-sm border-2',
                          isCompleted ? 'bg-primary border-primary text-primary-foreground scale-90' :
                            isActive ? 'bg-white dark:bg-slate-900 border-primary text-primary ring-4 ring-primary/10 scale-110' :
                              'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        )}>
                          {isCompleted ? <Check className="h-5 w-5" /> : stepIdx}
                        </div>
                        <span className={cn(
                          'text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300 hidden sm:block',
                          isActive ? 'text-primary' : 'text-slate-400'
                        )}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-10">
                {/* ─── STEP 1: IDENTIFICATION ─── */}
                {currentStep === 1 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Tipo de Vehículo</Label>
                          <div className="flex gap-2">
                            {VEHICLE_TYPES.map(t => (
                              <button
                                key={t}
                                onClick={() => { setVehicleType(t); setMake(''); setModel(''); }}
                                className={cn(
                                  "flex-1 py-3 rounded-xl border transition-all font-black text-[10px] uppercase tracking-tighter",
                                  vehicleType === t 
                                    ? "bg-primary/10 border-primary text-primary shadow-sm" 
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-5 shadow-sm">
                           <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Marca</Label>
                            <Combobox
                              options={makeOptions}
                              value={make}
                              onChange={(v) => { setMake(v); setModel(''); }}
                              placeholder="Buscar marca..."
                              notFoundMessage="Marca no encontrada"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Modelo</Label>
                            <Combobox
                              options={modelOptions}
                              value={model}
                              onChange={setModel}
                              placeholder="Buscar modelo..."
                              notFoundMessage="Modelo no disponible"
                              disabled={!make}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Año</Label>
                            <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold" placeholder="2026" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Kilometraje</Label>
                            <div className="relative">
                              <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input type="number" value={mileage} onChange={e => setMileage(Number(e.target.value))} className="pl-10 h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold" placeholder="0" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Color Exterior</Label>
                          <Select value={exteriorColor} onValueChange={setExteriorColor}>
                            <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {COLORS.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Descripción</Label>
                          <Textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            className="min-h-[120px] rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 text-sm font-medium resize-none transition-all" 
                            placeholder="Detalles, motor, extras..." 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 2: ADMINISTRATION ─── */}
                {currentStep === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-6 h-fit shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-black uppercase tracking-tight">Es Consignación</Label>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">¿Un tercero es el dueño?</p>
                          </div>
                          <Switch checked={esConsignacion} onCheckedChange={setEsConsignacion} className="scale-110 data-[state=checked]:bg-primary" />
                        </div>

                        <Separator className="bg-slate-100 dark:bg-slate-800" />

                        {!esConsignacion ? (
                          <div className="space-y-3 animate-in zoom-in-95 duration-500">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Costo de Inversión (USD)</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                              <Input 
                                type="number" 
                                value={costoCompra} 
                                onChange={e => setCostoCompra(Number(e.target.value))} 
                                className="pl-12 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-primary/10 text-xl font-black text-primary focus:border-primary" 
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in zoom-in-95 duration-500">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Pactado con dueño</Label>
                              <Input type="number" value={ownerAskingPrice} onChange={e => setOwnerAskingPrice(Number(e.target.value))} className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 font-bold" placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5"><User className="h-3 w-3" /> Nombre del Dueño</Label>
                              <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 font-bold" placeholder="Nombre completo" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5"><Phone className="h-3 w-3" /> Teléfono</Label>
                              <Input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 font-bold" placeholder="04xx-xxx-xxxx" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 space-y-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 text-primary" />
                            <p className="font-black text-xs uppercase tracking-tight text-slate-700 dark:text-slate-300">Vendedor Asignado</p>
                          </div>
                          <Select value={asignadoA} onValueChange={setAsignadoA}>
                            <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm font-bold"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {staffList.filter(s => s.activo).map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.nombre}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-start gap-4 shadow-sm">
                          <Info className="h-4 w-4 text-primary mt-1 shrink-0" />
                          <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-tighter">
                            Si es <span className="text-primary">Consignación</span>, el beneficio se calculará sobre el margen entre el precio del dueño y la venta final.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 3: TECHNICAL FEATURES ─── */}
                {currentStep === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { l: '¿Choque fuerte?', v: hadMajorCrash, s: setHadMajorCrash, i: AlertTriangle },
                        { l: '¿Aire Acondicionado?', v: hasAC, s: setHasAC, i: Car },
                        { l: '¿Rueda actualmente?', v: isOperational, s: setIsOperational, i: Zap },
                        { l: '¿Eres el firmante?', v: isSignatory, s: setIsSignatory, i: ShieldCheck },
                        { l: '¿Es Tracción 4x4?', v: is4x4, s: setIs4x4, i: Layers },
                        { l: '¿Sistema Sonido?', v: hasSoundSystem, s: setHasSoundSystem, i: Volume2 },
                        { l: '¿Aceptas cambio?', v: acceptsTradeIn, s: setAcceptsTradeIn, i: RefreshCcw },
                        { l: '¿Vehículo Blindado?', v: isArmored, s: setIsArmored, i: ShieldCheck },
                      ].map((item, i) => {
                        const Icon = item.i || Info;
                        return (
                          <div 
                            key={i} 
                            className={cn(
                              "flex flex-col justify-between p-5 rounded-2xl border transition-all cursor-pointer shadow-sm",
                              item.v 
                                ? "bg-primary/5 border-primary/30" 
                                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200"
                            )}
                            onClick={() => item.s(!item.v)}
                          >
                            <Icon className={cn("h-5 w-5 mb-4", item.v ? "text-primary" : "text-slate-300")} />
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn("text-[10px] font-black uppercase tracking-tighter leading-tight", item.v ? "text-primary" : "text-slate-400")}>
                                {item.l}
                              </span>
                              <Switch checked={item.v} onCheckedChange={item.s} className="scale-75" onClick={(e) => e.stopPropagation()} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {isArmored && (
                      <div className="p-6 rounded-2xl bg-slate-900 dark:bg-slate-900 border border-slate-800 animate-in zoom-in-95 duration-500 shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            <div>
                              <p className="font-black text-xs uppercase tracking-tight text-white">Nivel de Blindaje</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Grado de protección (1-7)</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5, 6, 7].map(lvl => (
                              <button
                                key={lvl}
                                onClick={() => setArmorLevel(lvl)}
                                className={cn(
                                  "w-8 h-8 rounded-lg font-black text-xs transition-all",
                                  armorLevel === lvl ? "bg-primary text-white shadow-lg" : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                                )}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-6 shadow-sm">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center block">Configuración Mecánica</Label>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Transmisión</Label>
                            <Select value={transmission} onValueChange={(v: any) => setTransmission(v)}>
                              <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="Sincrónica" className="font-bold">Sincrónica</SelectItem><SelectItem value="Automática" className="font-bold">Automática</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Motor</Label>
                            <Input value={engine} onChange={e => setEngine(e.target.value)} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-bold" placeholder="Ej: 1.8L Turbo" />
                          </div>
                        </div>
                      </div>

                      <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-6 shadow-sm">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center block">Detalles de la Unidad</Label>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">N° Puertas</Label>
                            <RadioGroup value={String(doorCount)} onValueChange={v => setDoorCount(Number(v) as any)} className="flex gap-4 mt-1">
                              <div className="flex items-center gap-1.5"><RadioGroupItem value="2" id="d2" /><Label htmlFor="d2" className="text-[10px] font-black uppercase">2 P</Label></div>
                              <div className="flex items-center gap-1.5"><RadioGroupItem value="4" id="d4" /><Label htmlFor="d4" className="text-[10px] font-black uppercase">4 P</Label></div>
                            </RadioGroup>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Dueños: <span className="text-slate-900 dark:text-white">{ownerCount}</span></Label>
                            <Input type="range" min={1} max={10} value={ownerCount} onChange={e => setOwnerCount(Number(e.target.value))} className="accent-primary" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Vida de Cauchos: <span className="text-primary font-black">{tireLife}%</span></Label>
                          <Input type="range" min={0} max={100} value={tireLife} onChange={e => setTireLife(Number(e.target.value))} className="accent-primary h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 4: VALUATION ─── */}
                {currentStep === 4 && (
                  <div className="space-y-8 animate-in fade-in scale-in-95 duration-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-8 relative overflow-hidden shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                          <DollarSign className="h-7 w-7" />
                        </div>
                        
                        <div className="text-center space-y-1.5">
                          <Label className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Precio de Venta</Label>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest max-w-[240px] mx-auto leading-relaxed">Establece el monto público.</p>
                        </div>

                        <div className="relative group w-full">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-200 dark:text-slate-800 group-focus-within:text-primary transition-all">$</span>
                          <Input 
                            type="number" 
                            value={precioVenta} 
                            onChange={e => setPrecioVenta(Number(e.target.value))} 
                            className="pl-10 h-16 rounded-2xl bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 focus:border-primary text-3xl font-black text-center text-primary shadow-lg transition-all" 
                            placeholder="0.00" 
                          />
                        </div>

                        {isLoadingMarket ? (
                          <div className="flex items-center gap-3 text-primary animate-pulse py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Analizando mercado...</span>
                          </div>
                        ) : marketInfo && (
                          <div className={cn(
                            "p-4 rounded-xl border flex items-center gap-3 w-full transition-all duration-500",
                            marketInfo.found ? "bg-white/80 dark:bg-slate-800 border-primary/20 text-primary" : "bg-slate-100 dark:bg-slate-900 border-transparent text-slate-400"
                          )}>
                            <TrendingUp className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Mercado Promedio</p>
                              <p className="text-[10px] font-bold leading-tight">{marketInfo.message}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        <div className={cn(
                          "p-8 rounded-3xl border transition-all shadow-sm space-y-6",
                          isLoss ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50" : "bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900/50"
                        )}>
                           <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg", isLoss ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600")}>
                                {isLoss ? <ShieldAlert className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                              </div>
                              <span className="text-xs font-black uppercase tracking-tight">{isLoss ? 'Rendimiento Negativo' : 'Rendimiento Óptimo'}</span>
                            </div>
                            {authGranted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                              <span className="text-slate-500">Costo Base + Gastos</span>
                              <span className="text-slate-900 dark:text-white">{formatCurrency(breakEven)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider border-t border-slate-100 dark:border-slate-800 pt-3">
                              <span className="text-slate-500">Margen de Ganancia</span>
                              <span className={cn("font-black", profit >= 0 ? "text-green-600" : "text-red-600")}>
                                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                              </span>
                            </div>
                          </div>

                          {isLoss && !authGranted && (
                            <div className="p-4 rounded-xl bg-white/50 dark:bg-black/20 border border-red-200 dark:border-red-900 flex items-start gap-3">
                              <CircleAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-[9px] font-bold text-red-600 uppercase leading-tight">
                                El precio de venta es inferior al costo total. Se requiere PIN de autorización para proceder.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-start gap-4 shadow-sm">
                          <Info className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                          <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed tracking-tighter">
                            Asegúrate de incluir el margen comercial. Si el precio es menor al costo, el sistema solicitará autorización superior antes de continuar.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 5: VISUALS ─── */}
                {currentStep === 5 && (
                  <div className="space-y-8 animate-in fade-in scale-in-95 duration-700">
                    <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 text-center sm:text-left flex-1">
                        <p className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm">Galería de Imágenes</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                          Sube entre <span className="text-primary">4 y 12 fotografías</span>. Selecciona la <Star className="h-2.5 w-2.5 inline text-primary fill-primary" /> como portada.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-lg font-black text-primary leading-none">{existingImages.length + imageFiles.length}</span>
                        <span className="text-[9px] font-black uppercase text-slate-400">/ 12</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {existingImages.map((img, i) => (
                        <div key={i} className={cn(
                          "relative aspect-square rounded-2xl overflow-hidden border-2 group transition-all duration-300 shadow-sm",
                          coverSelection?.type === 'existing' && coverSelection.index === i ? "border-primary shadow-lg shadow-primary/10" : "border-slate-100 dark:border-slate-800"
                        )}>
                          <Image src={img.url} alt="" fill className="object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <button onClick={() => removeExistingImage(i)} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-red-500 transition-colors shadow-lg"><X className="h-3.5 w-3.5" /></button>
                          <button 
                            onClick={() => setCoverSelection({ type: 'existing', index: i })} 
                            className={cn(
                              "absolute bottom-2 left-2 p-2 rounded-lg transition-all", 
                              coverSelection?.type === 'existing' && coverSelection.index === i 
                                ? "bg-primary text-white" 
                                : "bg-black/40 text-white/70 hover:bg-primary"
                            )}
                          >
                            <Star className={cn("h-4 w-4", coverSelection?.type === 'existing' && coverSelection.index === i ? "fill-white" : "")} />
                          </button>
                        </div>
                      ))}
                      {imagePreviews.map((preview, i) => (
                        <div key={i} className={cn(
                          "relative aspect-square rounded-2xl overflow-hidden border-2 group animate-in zoom-in-50 duration-300 shadow-sm",
                          coverSelection?.type === 'new' && coverSelection.index === i ? "border-primary shadow-lg shadow-primary/10" : "border-slate-100 dark:border-slate-800"
                        )}>
                          <Image src={preview} alt="" fill className="object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <button onClick={() => removeNewImage(i)} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-red-500 transition-colors shadow-lg"><X className="h-3.5 w-3.5" /></button>
                          <button 
                            onClick={() => setCoverSelection({ type: 'new', index: i })} 
                            className={cn(
                              "absolute bottom-2 left-2 p-2 rounded-lg transition-all", 
                              coverSelection?.type === 'new' && coverSelection.index === i 
                                ? "bg-primary text-white" 
                                : "bg-black/40 text-white/70 hover:bg-primary"
                            )}
                          >
                            <Star className={cn("h-4 w-4", coverSelection?.type === 'new' && coverSelection.index === i ? "fill-white" : "")} />
                          </button>
                        </div>
                      ))}
                      
                      {existingImages.length + imageFiles.length < 12 && (
                        <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-300 transition-all group shadow-sm">
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all shadow-sm"><Plus className="h-6 w-6" /></div>
                          <div className="text-center">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Añadir Fotos</span>
                          </div>
                          <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="p-6 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-4">
                <Button 
                  variant="ghost" 
                  onClick={(e) => { e.preventDefault(); currentStep > 1 ? prevStep() : onOpenChange(false); }} 
                  disabled={isSaving}
                  className="h-11 px-6 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all font-semibold"
                >
                  {currentStep > 1 ? <><ChevronLeft className="h-5 w-5 mr-1" /> Regresar</> : 'Cancelar'}
                </Button>

                <div className="flex items-center gap-3">
                  {currentStep < 5 ? (
                    <Button 
                      onClick={(e) => { e.preventDefault(); nextStep(); }}
                      className="h-11 px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all font-bold gap-2"
                    >
                      Continuar <ChevronRight className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={(e) => { e.preventDefault(); handleSubmit(); }} 
                      disabled={isSaving || (existingImages.length + imageFiles.length < 4)}
                      className="h-11 px-10 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all font-bold gap-2"
                    >
                      {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</> : <><CheckCircle2 className="h-5 w-5" /> Registrar en Stock</>}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Authorization PIN Dialog */}
      <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center shadow-inner animate-pulse">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Autorización Requerida</DialogTitle>
              <p className="text-sm text-slate-500 leading-relaxed">
                El precio de venta genera pérdida. Selecciona un nivel jerárquico e ingresa el PIN para continuar.
              </p>
            </div>

            <div className="space-y-4">
              <Select value={authUserId} onValueChange={setAuthUserId}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 font-bold"><SelectValue placeholder="Seleccionar Autorizador..." /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {staffList.filter(s => ['Dueño', 'Encargado'].includes(s.rol) && s.activo).map(s => (
                    <SelectItem key={s.id} value={s.id} className="font-bold">{s.nombre} ({s.rol})</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex justify-center gap-3">
                {authPin.map((digit, i) => (
                  <Input 
                    key={i} 
                    ref={pinRefs[i]} 
                    value={digit} 
                    onChange={e => handlePinInput(i, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Backspace' && !digit && i > 0) pinRefs[i-1].current?.focus(); }}
                    className="w-12 h-14 text-center text-2xl font-black bg-slate-100 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl focus:border-primary transition-all"
                    type="password"
                    maxLength={1}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setAuthModalOpen(false)} className="flex-1 h-12 rounded-xl text-slate-500 font-semibold">Cancelar</Button>
              <Button className="flex-1 h-12 rounded-xl font-bold shadow-lg" onClick={handleVerifyPin} disabled={isVerifyingPin || !authUserId}>
                {isVerifyingPin ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Autorizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Legal Modal */}
      {savedVehicleData && (
        <VehicleInfoExtraDialog
          open={legalModalOpen}
          onOpenChange={(val) => {
            setLegalModalOpen(val);
            if (!val) handleFinish();
          }}
          vehicle={savedVehicleData}
          concesionarioId={concesionarioId}
          onSave={() => {
            setLegalModalOpen(false);
            handleFinish();
          }}
        />
      )}
    </>
  );
}

function WindIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.7 7.7A7.1 7.1 0 1 1 5 14.5" /><path d="m15.5 13-3 3 3 3" /><path d="M12.5 16H22" /><path d="M5 22h14" /></svg>; }
function RefreshCcw(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>; }
function ShieldIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>; }
