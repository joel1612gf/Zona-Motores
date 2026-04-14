'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
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
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  X,
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
import type { StockVehicle, StockStatus, GastoCategoria } from '@/lib/business-types';
import { GASTO_CATEGORIA_LABELS, ROLE_LABELS } from '@/lib/business-types';
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
  const { concesionario, hasPermission, canSeeCosts, staffList } = useBusinessAuth();
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

  const permission = hasPermission('inventory');
  
  // Initialize vendor mode from session storage
  const [vendorModeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('zm_vendor_mode') === 'true';
    }
    return false;
  });

  const currentRole = useBusinessAuth().currentRole;
  const isVendorMode = currentRole === 'vendedor' || vendorModeEnabled;
  const isReadOnly = isVendorMode || permission === 'read';
  const effectiveCanSeeCosts = !isVendorMode && canSeeCosts;

  // Load vehicle
  useEffect(() => {
    const loadVehicle = async () => {
      if (!concesionario?.id || !vehicleId) return;
      setIsLoading(true);
      try {
        const docRef = doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicleId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setVehicle({ id: snap.id, ...snap.data() } as StockVehicle);
        }
      } catch (error) {
        console.error('[VehicleDetail] Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadVehicle();
  }, [concesionario?.id, vehicleId, firestore]);

  // Market price
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

  const assignedStaff = useMemo(() => {
    if (!vehicle?.asignado_a) return null;
    return staffList.find(s => s.id === vehicle.asignado_a);
  }, [vehicle?.asignado_a, staffList]);

  const handleChangeStatus = async (newStatus: StockStatus) => {
    if (!concesionario?.id || !vehicle) return;
    setIsChangingStatus(true);
    try {
      const docRef = doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicle.id);
      await updateDoc(docRef, { estado_stock: newStatus });
      
      // SYNC TO MARKETPLACE
      if (concesionario.owner_uid) {
        const publicRef = doc(firestore, 'users', concesionario.owner_uid, 'vehicleListings', vehicle.id);
        
        if (newStatus === 'publico_web' || newStatus === 'pausado') {
          // Prepare complete data (mostly based on current vehicle state)
          const publicVehicleData = {
            id: vehicle.id,
            sellerId: concesionario.owner_uid,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            priceUSD: vehicle.precio_venta,
            mileage: vehicle.mileage,
            bodyType: vehicle.bodyType || 'Sedán',
            transmission: vehicle.transmission,
            engine: vehicle.engine || '—',
            exteriorColor: vehicle.exteriorColor || 'Otro',
            ownerCount: 1,
            tireLife: 100,
            hasAC: true,
            hasSoundSystem: true,
            hadMajorCrash: false,
            isOperational: true,
            isSignatory: true,
            acceptsTradeIn: false,
            description: vehicle.description || '',
            images: vehicle.images || [],
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
              city: 'Caracas', // Default to Caracas for now or use business location if exists
              state: 'Miranda',
              lat: concesionario.geolocalizacion?.latitude || 10.4806,
              lon: concesionario.geolocalizacion?.longitude || -66.9036
            },
            asignado_a: vehicle.asignado_a || null,
            assignedSeller: vehicle.asignado_a ? (() => {
              const staff = staffList.find(s => s.id === vehicle.asignado_a);
              return staff ? { nombre: staff.nombre, telefono: staff.telefono || '' } : null;
            })() : null,
            createdAt: (vehicle as any).created_at || serverTimestamp(),
            status: newStatus === 'publico_web' ? 'active' : 'paused'
          };
          await setDoc(publicRef, publicVehicleData);
        } else if (vehicle.estado_stock === 'publico_web' || vehicle.estado_stock === 'pausado') {
          // It was in the marketplace, now it's not -> delete
          await deleteDoc(publicRef);
        }
      }

      setVehicle({ ...vehicle, estado_stock: newStatus });
      toast({ title: 'Estado actualizado', description: `El vehículo ahora está: ${STATUS_CONFIG[newStatus].label}` });
    } catch (error) {
      console.error('[VehicleDetail] Error changing status:', error);
      toast({ title: 'Error', description: 'No se pudo cambiar el estado.', variant: 'destructive' });
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!concesionario?.id || !vehicle) return;
    setIsDeleting(true);
    try {
      const docRef = doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicle.id);
      await deleteDoc(docRef);
      toast({ title: 'Eliminado', description: 'El vehículo fue eliminado del inventario.' });
      router.push(`/business/${slug}/inventory`);
    } catch (error) {
      console.error('[VehicleDetail] Error deleting:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el vehículo.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Car className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Vehículo no encontrado</p>
        <Button variant="outline" onClick={() => router.push(`/business/${slug}/inventory`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver al inventario
        </Button>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[vehicle.estado_stock];
  const StatusIcon = statusConf.icon;
  const totalGastos = vehicle.gastos_adecuacion?.reduce((sum, g) => sum + g.monto, 0) || 0;
  const totalInvertido = (vehicle.costo_compra || 0) + totalGastos;
  const ganancia = (vehicle.precio_venta || 0) - totalInvertido;

  // Group expenses by category
  const gastosPorCategoria: Record<string, { items: typeof vehicle.gastos_adecuacion; total: number }> = {};
  (vehicle.gastos_adecuacion || []).forEach(g => {
    const cat = g.categoria || 'otros';
    if (!gastosPorCategoria[cat]) gastosPorCategoria[cat] = { items: [], total: 0 };
    gastosPorCategoria[cat].items.push(g);
    gastosPorCategoria[cat].total += g.monto;
  });

  return (
    <div className={cn(
      "space-y-6 transition-all duration-300",
      isVendorMode ? "max-w-5xl mx-auto p-4 sm:p-6" : ""
    )}>
      {/* Back + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => router.push(`/business/${slug}/inventory`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Inventario
        </Button>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este vehículo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. El vehículo será eliminado permanentemente del inventario.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className={cn(
        "grid gap-6 items-start transition-all duration-300",
        isVendorMode ? "grid-cols-1" : "md:grid-cols-3"
      )}>
        {/* Main Column */}
        <div className={cn(
          "space-y-6",
          isVendorMode ? "w-full" : "md:col-span-2"
        )}>
          {/* Image Gallery */}
          {vehicle.images && vehicle.images.length > 0 ? (
            <>
              <Carousel className="w-full">
                <CarouselContent>
                  {vehicle.images.map((image, index) => (
                    <CarouselItem key={index}>
                      <Card className="overflow-hidden">
                        <CardContent 
                          className="flex aspect-video items-center justify-center p-0 relative cursor-pointer group hover:opacity-95 transition-opacity"
                          onClick={() => {
                            setViewerIndex(index);
                            setViewerVisible(true);
                          }}
                        >
                          <Image
                            src={image.url}
                            alt={image.alt || "Vehículo"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          />
                          {vehicle.images!.length > 1 && (
                            <Badge variant="secondary" className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm z-10 pointer-events-none">
                              {index + 1} / {vehicle.images!.length}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {vehicle.images.length > 1 && (
                  <>
                    <CarouselPrevious className="ml-12" />
                    <CarouselNext className="mr-12" />
                  </>
                )}
              </Carousel>

              <PhotoSlider
                images={vehicle.images.map((item) => ({ src: item.url, key: item.url }))}
                visible={viewerVisible}
                onClose={() => setViewerVisible(false)}
                index={viewerIndex}
                onIndexChange={setViewerIndex}
                maskClosable={true}
              />
            </>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="flex aspect-video items-center justify-center bg-muted">
                <Car className="h-16 w-16 text-muted-foreground/30" />
              </CardContent>
            </Card>
          )}

          {/* Vehicle Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl sm:text-3xl font-headline">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={statusConf.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConf.label}
                    </Badge>
                    {vehicle.es_consignacion && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                        Consignación
                      </Badge>
                    )}
                  </div>
                </div>
                {vehicle.precio_venta > 0 && (
                  <div className="text-right">
                    <p className="text-3xl font-bold font-headline text-primary">
                      {formatCurrency(vehicle.precio_venta)}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Market price */}
              {marketPrice?.found && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm">
                    📊 <span className="font-medium">{marketPrice.message}</span>
                  </p>
                </div>
              )}

              <Separator />

              {/* Specs Grid */}
              {/* Specs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Gauge className="h-4 w-4 shrink-0" />
                    <span>Kilometraje</span>
                  </div>
                  <p className="font-semibold text-base">{vehicle.mileage?.toLocaleString() || 0} km</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Palette className="h-4 w-4 shrink-0" />
                    <span>Color</span>
                  </div>
                  <p className="font-semibold text-base">{vehicle.exteriorColor || '—'}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Settings2 className="h-4 w-4 shrink-0" />
                    <span>Motor</span>
                  </div>
                  <p className="font-semibold text-base">{vehicle.engine || '—'}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Car className="h-4 w-4 shrink-0" />
                    <span>Transmisión</span>
                  </div>
                  <p className="font-semibold text-base">{vehicle.transmission || '—'}</p>
                </div>
              </div>

              {/* Description */}
              {vehicle.description && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Descripción</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vehicle.description}</p>
                  </div>
                </>
              )}

              {/* Assigned seller */}
              {assignedStaff && !isVendorMode && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserRound className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Asignado a: {assignedStaff.nombre}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[assignedStaff.rol]}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        {!isVendorMode && (
          <div className="space-y-4">
            {/* Status Change */}
            {!isReadOnly && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Cambiar Estado</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={vehicle.estado_stock}
                    onValueChange={(v) => handleChangeStatus(v as StockStatus)}
                    disabled={isChangingStatus}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="privado_taller">🔧 En Taller</SelectItem>
                      <SelectItem value="publico_web">🌐 Publicado</SelectItem>
                      <SelectItem value="pausado">🟠 Pausado</SelectItem>
                      <SelectItem value="reservado">📌 Reservado</SelectItem>
                      <SelectItem value="vendido">✅ Vendido</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Costs Card - only for authorized roles */}
            {effectiveCanSeeCosts && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Costos e Inversión
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Purchase cost */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Costo de compra</span>
                    <span className="font-medium">{formatCurrency(vehicle.costo_compra || 0)}</span>
                  </div>

                  {/* Expenses by category */}
                  {Object.entries(gastosPorCategoria).length > 0 && (
                    <div className="space-y-2">
                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Gastos de Adecuación</p>
                      {Object.entries(gastosPorCategoria).map(([cat, data]) => (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{GASTO_CATEGORIA_LABELS[cat as GastoCategoria] || cat}</Badge>
                            </span>
                            <span className="font-medium">{formatCurrency(data.total)}</span>
                          </div>
                          {data.items.map((item, i) => (
                            <p key={i} className="text-xs text-muted-foreground pl-4">
                              — {item.descripcion}: {formatCurrency(item.monto)}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />

                  {/* Totals */}
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total invertido</span>
                    <span>{formatCurrency(totalInvertido)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Precio de venta</span>
                    <span className="font-medium">{formatCurrency(vehicle.precio_venta || 0)}</span>
                  </div>

                  <Separator />

                  <div className={`flex justify-between items-center text-base font-bold ${ganancia >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Ganancia
                    </span>
                    <span>{ganancia >= 0 ? '+' : ''}{formatCurrency(ganancia)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Consignment info */}
            {vehicle.es_consignacion && vehicle.consignacion_info && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Info Consignación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendedor particular</span>
                    <span>{vehicle.consignacion_info.vendedor_particular_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comisión acordada</span>
                    <span>{vehicle.consignacion_info.comision_acordada}%</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <VehicleFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingVehicle={vehicle}
        concesionarioId={concesionario?.id || ''}
        onSave={() => window.location.reload()}
      />
    </div>
  );
}
