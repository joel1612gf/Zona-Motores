'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, getDocs, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useFirestore, useStorage } from '@/firebase';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Package,
  Eye,
  Loader2,
  Wrench,
  Globe,
  BookmarkCheck,
  CheckCircle2,
  Car,
  PauseCircle,
  DollarSign,
  FileText,
  Pencil,
  Send,
  Gauge,
  Lock,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import type { StockVehicle, StockStatus } from '@/lib/business-types';
import { VehicleFormDialog } from '@/components/business/vehicle-form-dialog';
import { VehicleCostsDialog } from '@/components/business/vehicle-costs-dialog';
import { VehicleInfoExtraDialog } from '@/components/business/vehicle-info-extra-dialog';
import { PreInvoiceDialog } from '@/components/business/pre-invoice-dialog';
import { formatCurrency, cn } from '@/lib/utils';

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  privado_taller: { 
    label: 'En Taller', 
    color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30', 
    icon: Wrench 
  },
  publico_web: { 
    label: 'Publicado', 
    color: 'bg-blue-600 text-white border-transparent shadow-lg shadow-blue-500/20', 
    icon: Globe 
  },
  pausado: { 
    label: 'Pausado', 
    color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700', 
    icon: PauseCircle 
  },
  reservado: { 
    label: 'Reservado', 
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30', 
    icon: BookmarkCheck 
  },
  vendido: { 
    label: 'Vendido', 
    color: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent', 
    icon: CheckCircle2 
  },
};

export default function InventoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { concesionario, hasPermission, canSeeCosts, currentRole } = useBusinessAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<StockVehicle | null>(null);
  const [costsTarget, setCostsTarget] = useState<StockVehicle | null>(null);
  const [infoExtraTarget, setInfoExtraTarget] = useState<StockVehicle | null>(null);
  const [preInvoiceTarget, setPreInvoiceTarget] = useState<StockVehicle | null>(null);
  const [vendorModeEnabled, setVendorModeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('zm_vendor_mode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('zm_vendor_mode', vendorModeEnabled ? 'true' : 'false');
    }
  }, [vendorModeEnabled]);


  const permission = hasPermission('inventory');
  const canToggleVendorMode = currentRole === 'dueno' || currentRole === 'encargado' || currentRole === 'secretario';
  const isVendorMode = currentRole === 'vendedor' || vendorModeEnabled;

  // Load vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      if (!concesionario?.id) return;
      setIsLoading(true);
      try {
        const ref = collection(firestore, 'concesionarios', concesionario.id, 'inventario');
        const q = query(ref, orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockVehicle));
        setVehicles(list);

        // Cleanup: delete images of vehicles sold more than 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const toClean = list.filter(v =>
          v.estado_stock === 'vendido' &&
          v.images && v.images.length > 0 &&
          v.fecha_venta && v.fecha_venta.toDate() < thirtyDaysAgo
        );
        if (toClean.length > 0) {
          for (const v of toClean) {
            try {
              await Promise.all(v.images.map(img => {
                try { return deleteObject(storageRef(storage, img.url)).catch(() => {}); }
                catch { return Promise.resolve(); }
              }));
              await updateDoc(doc(firestore, 'concesionarios', concesionario!.id, 'inventario', v.id), { images: [] });
            } catch (e) {
              console.warn('[Inventory] Could not clean images for', v.id, e);
            }
          }
          setVehicles(prev => prev.map(v =>
            toClean.some(tc => tc.id === v.id) ? { ...v, images: [] } : v
          ));
        }
      } catch (error) {
        console.error('[Inventory] Error loading:', error);
        toast({ title: 'Error', description: 'No se pudo cargar el inventario.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concesionario?.id]);

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    let list = vehicles;

    // Filter by tab
    if (activeTab === 'todos') {
      // Exclude sold from "Todos"
      list = list.filter(v => v.estado_stock !== 'vendido');
    } else {
      list = list.filter(v => v.estado_stock === activeTab);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        `${v.make} ${v.model} ${v.year} ${v.placa || ''}`.toLowerCase().includes(q)
      );
    }

    return list;
  }, [vehicles, activeTab, searchQuery]);

  const statusCounts = useMemo(() => {
    const nonSoldCount = vehicles.filter(v => v.estado_stock !== 'vendido').length;
    const counts: Record<string, number> = { todos: nonSoldCount };
    vehicles.forEach(v => {
      counts[v.estado_stock] = (counts[v.estado_stock] || 0) + 1;
    });
    return counts;
  }, [vehicles]);

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setDialogOpen(true);
  };

  const handleSave = (_vehicleId?: string) => {
    window.location.reload();
  };

  if (permission === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium text-lg">No tienes permisos para acceder al inventario.</p>
        </div>
      </div>
    );
  }

  const isReadOnly = isVendorMode || permission === 'read';
  const effectiveCanSeeCosts = !isVendorMode && canSeeCosts;

  return (
    <div className="flex flex-col min-h-screen">
      {/* ─── FLOATING HEADER - SYNCED WITH PRODUCTS/DASHBOARD ─── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 -mx-6 px-6 py-4 mb-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
                <Car className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold font-headline tracking-tight text-slate-900 dark:text-white">Inventario</h1>
            </div>
            <p className="text-muted-foreground font-medium flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {statusCounts.todos} Unidades en Stock
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canToggleVendorMode && (
              <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:bg-slate-100">
                <Switch
                  id="vendor-mode"
                  checked={vendorModeEnabled}
                  onCheckedChange={setVendorModeEnabled}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="vendor-mode" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-slate-500 whitespace-nowrap">Modo Vendedor</Label>
              </div>
            )}
            {!isReadOnly && (
              <Button onClick={handleAddVehicle} className="rounded-xl font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95 px-6 h-11">
                <Plus className="h-5 w-5 mr-2" />
                Nueva Unidad
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto w-full space-y-8 px-2 sm:px-0">
        {/* ─── FILTERS & SEARCH ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-6 items-end">
          <div className="space-y-4 w-full">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl h-12 border border-slate-200/60 dark:border-slate-800/60 shadow-inner w-full justify-start overflow-x-auto no-scrollbar">
                <TabsTrigger value="todos" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold text-xs gap-2">
                  Todos <Badge variant="secondary" className="ml-1.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-black">{statusCounts.todos || 0}</Badge>
                </TabsTrigger>
                {(Object.keys(STATUS_CONFIG) as StockStatus[]).map(status => {
                  const config = STATUS_CONFIG[status];
                  const Icon = config.icon;
                  return (
                    <TabsTrigger key={status} value={status} className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold text-xs gap-2 whitespace-nowrap">
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                      <Badge variant="secondary" className="ml-1.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-black">{(statusCounts[status] || 0)}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="relative group max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Buscar por marca, modelo, año o placa..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-primary/50 transition-all shadow-sm font-medium"
              />
            </div>
          </div>
        </div>

        {/* ─── GRID ─── */}
        <div className="pb-20">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-3xl border-4 border-primary/10 border-t-primary animate-spin" />
                <Car className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-headline text-slate-900 dark:text-white">Cargando Inventario</p>
                <p className="text-slate-500 text-sm font-medium italic">Sincronizando unidades...</p>
              </div>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] bg-slate-50/50 dark:bg-slate-900/50 p-12 text-center">
              <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-8">
                <Car className="h-12 w-12 text-slate-300 dark:text-slate-700" />
              </div>
              <h3 className="text-3xl font-black font-headline tracking-tight mb-2 text-slate-900 dark:text-white uppercase">Inventario Vacío</h3>
              <p className="text-slate-500 max-w-sm mx-auto font-medium text-lg leading-relaxed">
                {searchQuery ? `No encontramos unidades que coincidan con "${searchQuery}"` : 'No hay vehículos registrados en este concesionario todavía.'}
              </p>
              {!isReadOnly && !searchQuery && (
                <Button onClick={handleAddVehicle} size="lg" className="mt-8 rounded-2xl px-8 h-14 text-lg font-bold shadow-xl shadow-primary/20">
                  <Plus className="h-6 w-6 mr-2" />
                  Registrar mi primer vehículo
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
              {filteredVehicles.map(vehicle => {
                const statusConf = STATUS_CONFIG[vehicle.estado_stock];
                const StatusIcon = statusConf.icon;
                const mainImage = vehicle.images?.[0];
                const totalGastos = vehicle.gastos_adecuacion?.reduce((sum, g) => sum + g.monto, 0) || 0;
                const totalInvertido = (vehicle.costo_compra || 0) + totalGastos;
                const ganancia = (vehicle.precio_venta || 0) - totalInvertido;

                return (
                  <div 
                    key={vehicle.id} 
                    className="group relative flex flex-col bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
                  >
                    {/* Visual Badge (Top Left) */}
                    <div className="absolute top-4 left-4 z-20 pointer-events-none">
                       <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-sm",
                        statusConf.color
                      )}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">{statusConf.label}</span>
                      </div>
                    </div>

                    {/* Image Container */}
                    <div 
                      className="relative w-full pt-[65%] cursor-pointer overflow-hidden bg-slate-100 dark:bg-slate-900"
                      onClick={() => router.push(`/business/${slug}/inventory/${vehicle.id}`)}
                    >
                      {mainImage ? (
                        <Image
                          src={mainImage.url}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          fill
                          className="object-cover transition-transform duration-1000 group-hover:scale-110"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Car className="h-16 w-16 text-slate-200 dark:text-slate-800" />
                        </div>
                      )}
                      
                      {/* Price Overlay (Bottom Right) */}
                      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-5 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl">
                        <p className="text-xl font-black font-headline text-primary">
                          {formatCurrency(vehicle.precio_venta)}
                        </p>
                      </div>

                      {vehicle.es_consignacion && (
                        <div className="absolute top-4 right-4 z-20 pointer-events-none">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 text-white shadow-lg">
                            <Sparkles className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Consignación</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex-1 flex flex-col space-y-6">
                      {/* Title & Basics */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between">
                          <h3 className="text-xl font-bold font-headline leading-tight tracking-tight text-slate-900 dark:text-white line-clamp-1">
                            {vehicle.make} {vehicle.model}
                          </h3>
                          <span className="text-sm font-black text-slate-400">{vehicle.year}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {vehicle.placa && (
                            <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-lg tracking-widest text-slate-500">{vehicle.placa}</span>
                          )}
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Gauge className="h-3 w-3" /> {vehicle.mileage?.toLocaleString()} KM
                          </span>
                        </div>
                      </div>

                      {/* Financial Insight (Only if allowed) */}
                      {effectiveCanSeeCosts && (
                        <div className="grid grid-cols-2 gap-3 p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inversión Total</p>
                            <p className="font-bold text-sm tracking-tight text-slate-700 dark:text-slate-300">{formatCurrency(totalInvertido)}</p>
                          </div>
                          <div className="space-y-0.5 text-right border-l border-slate-200 dark:border-slate-800 pl-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Utilidad Est.</p>
                            <p className={cn(
                              "font-black text-sm tracking-tight",
                              ganancia >= 0 ? 'text-blue-600' : 'text-red-500'
                            )}>
                              {ganancia >= 0 ? '+' : ''}{formatCurrency(ganancia)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Primary Action */}
                      <div className="space-y-4">
                        {isVendorMode && vehicle.estado_stock !== 'reservado' && vehicle.estado_stock !== 'vendido' && (
                          <Button
                            onClick={(e) => { e.stopPropagation(); setPreInvoiceTarget(vehicle); }}
                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-base shadow-lg shadow-primary/20 transition-all active:scale-95 group/btn"
                          >
                            <Send className="h-5 w-5 mr-2 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                            Enviar a Caja
                          </Button>
                        )}

                        {/* Admin Tools Re-organized */}
                        {!isReadOnly && (
                          <div className="grid grid-cols-3 gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingVehicle(vehicle); setDialogOpen(true); }}
                              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors group/tool"
                            >
                              <Pencil className="h-4 w-4 text-slate-400 group-hover/tool:text-primary transition-colors" />
                              <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">Editar</span>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCostsTarget(vehicle); }}
                              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-orange-50 transition-colors group/tool"
                            >
                              <DollarSign className="h-4 w-4 text-orange-500" />
                              <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">Gastos</span>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setInfoExtraTarget(vehicle); }}
                              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-blue-50 transition-colors group/tool"
                            >
                              <FileText className="h-4 w-4 text-blue-500" />
                              <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">Legal</span>
                            </button>
                          </div>
                        )}
                        
                        <Button
                          variant="ghost"
                          className="w-full text-xs font-bold text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl h-9 transition-all"
                          onClick={(e) => { e.stopPropagation(); router.push(`/business/${slug}/inventory/${vehicle.id}`); }}
                        >
                          Ficha técnica y descripción completa
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── DIALOGS ─── */}
      <VehicleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingVehicle={editingVehicle}
        concesionarioId={concesionario?.id || ''}
        onSave={handleSave}
      />

      {costsTarget && (
        <VehicleCostsDialog
          open={!!costsTarget}
          onOpenChange={(open) => { if (!open) setCostsTarget(null); }}
          vehicle={costsTarget}
          concesionarioId={concesionario?.id || ''}
          onSave={handleSave}
        />
      )}

      {infoExtraTarget && (
        <VehicleInfoExtraDialog
          open={!!infoExtraTarget}
          onOpenChange={(open) => { if (!open) setInfoExtraTarget(null); }}
          vehicle={infoExtraTarget}
          concesionarioId={concesionario?.id || ''}
          onSave={handleSave}
        />
      )}

      <PreInvoiceDialog
        open={!!preInvoiceTarget}
        onOpenChange={(open) => { if (!open) setPreInvoiceTarget(null); }}
        vehicle={preInvoiceTarget}
        concesionarioId={concesionario?.id || ''}
        onSave={handleSave}
      />
    </div>
  );
}
