'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Gauge,
  Palette,
  Settings2,
  Car,
  Wrench,
  Globe,
  BookmarkCheck,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  UserRound,
  User,
  Sparkles,
  PauseCircle,
  X,
  Info,
  ShieldCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PhotoSlider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import type { StockVehicle, StockStatus } from '@/lib/business-types';
import { VehicleFormDialog } from '@/components/business/vehicle-form-dialog';
import { formatCurrency } from '@/lib/utils';

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  privado_taller: { label: 'En Taller', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', icon: Wrench },
  publico_web: { label: 'Publicado', color: 'bg-green-500/10 text-green-700 border-green-500/30', icon: Globe },
  pausado: { label: 'Pausado', color: 'bg-orange-500/10 text-orange-700 border-orange-500/30', icon: PauseCircle },
  reservado: { label: 'Reservado', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30', icon: BookmarkCheck },
  vendido: { label: 'Vendido', color: 'bg-gray-500/10 text-gray-500 border-gray-500/30', icon: CheckCircle2 },
};

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const vehicleId = params.vehicleId as string;
  const { concesionario, hasPermission, canSeeCosts, staffList, currentRole } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [vehicle, setVehicle] = useState<StockVehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [marketPrice, setMarketPrice] = useState<{ message: string; found: boolean } | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);

  const permission = hasPermission('inventory');
  const [vendorModeEnabled] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('zm_vendor_mode') === 'true';
    return false;
  });

  const isVendorMode = currentRole === 'vendedor' || vendorModeEnabled;
  const isReadOnly = isVendorMode || permission === 'read';
  const effectiveCanSeeCosts = !isVendorMode && canSeeCosts;

  const loadVehicle = useCallback(async (showLoading = true) => {
    if (!concesionario?.id || !vehicleId) return;
    if (showLoading) setIsLoading(true);
    try {
      const docRef = doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicleId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setVehicle({ id: snap.id, ...snap.data() } as StockVehicle);
      } else {
        toast({ title: 'No encontrado', description: 'El vehículo no existe.', variant: 'destructive' });
        router.push(`/business/${slug}/inventory`);
      }
    } catch (error) {
      console.error('[VehicleDetail] Error loading:', error);
      toast({ title: 'Error', description: 'No se pudo cargar la información.', variant: 'destructive' });
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [concesionario?.id, firestore, router, slug, toast, vehicleId]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  useEffect(() => {
    if (!vehicle?.make || !vehicle?.model) return;
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/vehicle-market-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ make: vehicle.make, model: vehicle.model, year: vehicle.year }),
        });
        const data = await res.json();
        setMarketPrice(data);
      } catch { setMarketPrice(null); }
    };
    fetchPrice();
  }, [vehicle?.make, vehicle?.model, vehicle?.year]);

  const handleDelete = async () => {
    if (!concesionario?.id || !vehicleId) return;
    setIsDeleting(true);
    try {
      if (vehicle?.estado_stock === 'publico_web' || vehicle?.estado_stock === 'pausado') {
        await deleteDoc(doc(firestore, 'users', concesionario.owner_uid, 'vehicleListings', vehicleId));
      }
      await deleteDoc(doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicleId));
      toast({ title: 'Eliminado', description: 'Vehículo eliminado del inventario.' });
      router.push(`/business/${slug}/inventory`);
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally { setIsDeleting(false); }
  };

  const handleStatusChange = async (newStatus: StockStatus) => {
    if (!concesionario?.id || !vehicleId || !vehicle) return;
    setIsChangingStatus(true);
    try {
      await updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicleId), { 
        estado_stock: newStatus, updated_at: serverTimestamp() 
      });
      if (concesionario.owner_uid && (vehicle.estado_stock === 'publico_web' || vehicle.estado_stock === 'pausado') && (newStatus !== 'publico_web' && newStatus !== 'pausado')) {
        await deleteDoc(doc(firestore, 'users', concesionario.owner_uid, 'vehicleListings', vehicleId));
      }
      setVehicle({ ...vehicle, estado_stock: newStatus });
      toast({ title: 'Estado actualizado' });
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally { setIsChangingStatus(false); }
  };

  const nextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!vehicle?.images) return;
    setMainPhotoIndex((prev) => (prev + 1) % vehicle.images.length);
  };

  const prevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!vehicle?.images) return;
    setMainPhotoIndex((prev) => (prev - 1 + vehicle.images.length) % vehicle.images.length);
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground font-medium">Abriendo expediente...</p>
    </div>
  );

  if (!vehicle) return null;

  const statusConf = STATUS_CONFIG[vehicle.estado_stock];
  const StatusIcon = statusConf.icon;
  const totalGastos = vehicle.gastos_adecuacion?.reduce((sum, g) => sum + g.monto, 0) || 0;
  const totalInvertido = (vehicle.costo_compra || 0) + totalGastos;
  const ganancia = (vehicle.precio_venta || 0) - totalInvertido;

  return (
    <div className="max-w-7xl mx-auto pb-24">
      {/* ─── HEADER & ACTIONS ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 px-2 md:px-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-2xl h-12 w-12 border bg-background" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black font-headline tracking-tight">
                {vehicle.make} {vehicle.model}
              </h1>
              {!isVendorMode && (
                <Badge variant="outline" className={cn('h-7 px-3 text-[10px] font-black uppercase tracking-widest shrink-0', statusConf.color)}>
                  <StatusIcon className="h-3 w-3 mr-1.5" />
                  {statusConf.label}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground font-bold mt-1.5 flex items-center gap-2 text-xs uppercase tracking-tighter">
              <span className="bg-muted px-2 py-0.5 rounded-lg">{vehicle.year}</span>
              <span className="opacity-40">•</span>
              <span className="text-primary/70">{vehicle.placa || 'SIN PLACA'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isReadOnly && (
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl h-11 px-4 md:px-6 font-bold border-2" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 md:mr-2 text-primary" /> <span className="hidden md:inline">Editar</span>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="rounded-xl h-11 w-11 p-0 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-black font-headline">¿Eliminar unidad?</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg">Esta acción es permanente e irreversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-6 gap-3">
                    <AlertDialogCancel className="rounded-xl h-12 font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="rounded-xl h-12 font-bold bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={isDeleting}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {!isVendorMode && (
            <>
              <Separator orientation="vertical" className="h-8 mx-2 hidden md:block" />

              <Select value={vehicle.estado_stock} onValueChange={(v) => handleStatusChange(v as StockStatus)} disabled={isReadOnly || isChangingStatus}>
                <SelectTrigger className={cn("h-11 min-w-[160px] md:min-w-[180px] rounded-xl border-2 font-black uppercase text-[10px] tracking-widest", statusConf.color)}>
                  {isChangingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <StatusIcon className="h-4 w-4 mr-2" />}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  {(Object.keys(STATUS_CONFIG) as StockStatus[]).map(s => (
                    <SelectItem key={s} value={s} className="rounded-lg font-bold uppercase text-[10px] tracking-widest my-1">{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* ─── LEFT COLUMN: PHOTOS & DESC ─── */}
        <div className="lg:col-span-2 space-y-10">
          {/* Interactive Gallery Card */}
          <div className="bg-card rounded-[2.5rem] border border-border/50 overflow-hidden shadow-xl">
            <div className="relative aspect-video bg-muted group overflow-hidden">
              {vehicle.images?.[mainPhotoIndex] ? (
                <>
                  <Image 
                    src={vehicle.images[mainPhotoIndex].url} 
                    alt="" 
                    fill 
                    className="object-cover cursor-pointer" 
                    onClick={() => { setViewerIndex(mainPhotoIndex); setViewerVisible(true); }} 
                  />
                  {/* Navigation Arrows */}
                  {vehicle.images.length > 1 && (
                    <>
                      <button 
                        onClick={prevPhoto}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button 
                        onClick={nextPhoto}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-20">
                  <Car className="h-20 w-20" />
                  <p className="text-xs font-black uppercase tracking-widest">Sin material visual</p>
                </div>
              )}
              {/* Responsive Price Badge */}
              <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 bg-background/90 backdrop-blur-xl px-4 py-3 md:px-8 md:py-5 rounded-2xl md:rounded-[2rem] border border-white/20 shadow-2xl">
                <p className="text-[9px] md:text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-0.5 md:mb-1">Precio de Venta</p>
                <p className="text-2xl md:text-4xl font-black font-headline text-primary tracking-tighter leading-none">
                  {formatCurrency(vehicle.precio_venta)}
                </p>
              </div>
            </div>
            
            {/* Thumbnails */}
            {vehicle.images && vehicle.images.length > 1 && (
              <div className="p-4 md:p-6 flex gap-3 border-t border-border/40 bg-muted/20 overflow-x-auto no-scrollbar">
                {vehicle.images.map((img, i) => (
                  <button
                    key={i}
                    className={cn(
                      "relative min-w-[70px] md:min-w-[100px] aspect-square rounded-xl overflow-hidden border-2 transition-all active:scale-95 shrink-0",
                      mainPhotoIndex === i ? "border-primary shadow-md scale-105" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                    onClick={() => setMainPhotoIndex(i)}
                  >
                    <Image src={img.url} alt="" fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description Card */}
          <div className="bg-card rounded-[2.5rem] border border-border/50 p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-primary/10" />
            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Nota de la Unidad
            </h2>
            <p className="text-xl font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {vehicle.description || 'No se ha redactado una descripción para esta unidad.'}
            </p>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: SPECS & FINANCIAL ─── */}
        <div className="space-y-10">
          {/* Quick Specs Grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Gauge, label: 'Kilometraje', val: `${vehicle.mileage?.toLocaleString()} KM`, color: 'text-blue-600 bg-blue-50' },
              { icon: Settings2, label: 'Transmisión', val: vehicle.transmission, color: 'text-orange-600 bg-orange-50' },
              { icon: Palette, label: 'Color Ext.', val: vehicle.exteriorColor, color: 'text-gray-600 bg-gray-50' },
              { icon: UserRound, label: 'N° Dueños', val: vehicle.ownerCount, color: 'text-purple-600 bg-purple-50' },
            ].map((spec, i) => (
              <div key={i} className="bg-card border border-border/40 p-5 rounded-[2rem] shadow-sm flex flex-col items-center text-center gap-2 group hover:shadow-md transition-all">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", spec.color)}>
                  <spec.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{spec.label}</p>
                  <p className="text-sm font-black tracking-tight">{spec.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Financial Scoreboard */}
          {effectiveCanSeeCosts && (
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 opacity-80">
                  <DollarSign className="h-4 w-4" /> Estado Financiero
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold uppercase opacity-50">Inversión Administrativa</p>
                  <p className="text-4xl font-black font-headline tracking-tighter">{formatCurrency(totalInvertido)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase opacity-40">Retorno Neto</p>
                    <p className={cn("text-xl font-black font-headline tracking-tight", ganancia >= 0 ? "text-green-300" : "text-red-300")}>
                      {ganancia >= 0 ? '+' : ''}{formatCurrency(ganancia)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[9px] font-bold uppercase opacity-40">ROI Est.</p>
                    <p className="text-xl font-black font-headline tracking-tight">
                      {((ganancia / (totalInvertido || 1)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {marketPrice && (
                  <div className="mt-2 p-4 bg-white/10 rounded-2xl border border-white/5 flex items-center gap-3 text-xs font-bold leading-tight">
                    <Globe className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="opacity-90">{marketPrice.message}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ficha Técnica Card */}
          <Card className="rounded-[2.5rem] border border-border/40 shadow-sm bg-card/50">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                 Ficha Técnica
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-3">
              {[
                { l: 'Motor', v: vehicle.engine || 'N/D' },
                { l: 'Neumáticos', v: `${vehicle.tireLife}% de vida` },
                { l: 'Tracción', v: vehicle.is4x4 ? '4x4 / AWD' : '4x2 / FWD' },
                { l: 'Puertas', v: `${vehicle.doorCount} P` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm border-b border-border/30 pb-3 last:border-0 last:pb-0">
                  <span className="font-bold text-muted-foreground/60">{item.l}</span>
                  <span className="font-black uppercase tracking-tight">{item.v}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Configuration Badges */}
          <div className="p-8 rounded-[2.5rem] bg-muted/20 border border-border/30">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] text-center mb-6">Equipamiento y Atributos</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: 'A/C Operativo', value: vehicle.hasAC },
                { label: 'Unidad Rodando', value: vehicle.isOperational },
                { label: 'Firma de Título', value: vehicle.isSignatory },
                { label: 'Tracción 4x4', value: vehicle.is4x4 },
                { label: 'Sonido Premium', value: vehicle.hasSoundSystem },
                { label: 'Blindaje', value: vehicle.isArmored },
                { label: 'Acepta Cambio', value: vehicle.acceptsTradeIn },
                { label: 'Choque Fuerte', value: vehicle.hadMajorCrash, isAlert: true },
              ].map((attr, i) => {
                const isActive = attr.value;
                const isAlert = attr.isAlert;

                return (
                  <div key={i} className={cn(
                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all duration-300",
                    isActive && !isAlert ? "bg-blue-500/10 border-blue-500/20 text-blue-700" :
                    isActive && isAlert ? "bg-red-500/10 border-red-500/20 text-red-700 shadow-inner" :
                    "bg-muted/50 border-transparent text-muted-foreground/30 opacity-50 grayscale"
                  )}>
                    {attr.label}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Assignment / Consignment */}
          {!isVendorMode && (vehicle.es_consignacion || vehicle.asignado_a) && (
            <div className="p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-6">
              <div className="flex items-center gap-3">
                <BookmarkCheck className="h-5 w-5 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest text-primary">Información de Gestión</h3>
              </div>
              
              <div className="flex flex-col gap-6">
                {vehicle.es_consignacion && (
                  <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                    
                    <div className="flex items-center gap-2 relative z-10">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <User className="h-4 w-4" />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos del Propietario</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 relative z-10">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Nombre Completo</p>
                        <p className="font-black text-sm text-slate-900 dark:text-white truncate">{ (vehicle.consignacion_info as any)?.owner_name || 'No especificado' }</p>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4 py-3 border-y border-slate-50 dark:border-slate-800">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Teléfono</p>
                          <p className="font-black text-sm text-slate-900 dark:text-white">{(vehicle.consignacion_info as any)?.owner_phone || 'No especificado'}</p>
                        </div>
                        {(vehicle.consignacion_info as any)?.owner_phone && (
                          <Button size="sm" variant="outline" className="rounded-xl h-9 text-[10px] font-bold uppercase bg-blue-50/50 hover:bg-blue-100 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-400" asChild>
                            <a href={`https://wa.me/${(vehicle.consignacion_info as any)?.owner_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>
                          </Button>
                        )}
                      </div>
                      
                      <div className="pt-1 flex items-center justify-between">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Precio Pactado</p>
                        <p className="font-black text-xl text-primary">{formatCurrency((vehicle.consignacion_info as any)?.owner_asking_price || 0)}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {vehicle.asignado_a && (
                  <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                    
                    <div className="flex items-center gap-2 relative z-10">
                      <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable Interno</p>
                    </div>
                    
                    <div className="flex items-center justify-between gap-4 relative z-10">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Vendedor Asignado</p>
                        <p className="font-black text-sm text-slate-900 dark:text-white">
                          {staffList.find(s => s.id === vehicle.asignado_a)?.nombre || 'Desconocido'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Jerarquía</p>
                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[9px] uppercase tracking-tighter rounded-lg">
                          {staffList.find(s => s.id === vehicle.asignado_a)?.rol || 'Staff'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODALS ─── */}
      <VehicleFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingVehicle={vehicle}
        concesionarioId={concesionario?.id || ''}
        onSave={() => loadVehicle(false)}
      />

      <PhotoSlider
        images={vehicle.images?.map(img => ({ src: img.url, key: img.url })) || []}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </div>
  );
}
