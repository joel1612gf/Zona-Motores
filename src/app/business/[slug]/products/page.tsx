'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Package,
  Loader2,
  Building2,
  ShoppingCart,
  AlertTriangle,
  Pencil,
  Trash2,
  ChevronDown,
  FileClock,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Producto, ProductCategory } from '@/lib/business-types';
import { PRODUCT_CATEGORY_LABELS, CAN_SEE_PURCHASE_COSTS } from '@/lib/business-types';
import type { BusinessRole } from '@/lib/business-types';
import { ProductFormDialog } from '@/components/business/product-form-dialog';
import { SuppliersDialog } from '@/components/business/suppliers-dialog';
import { PurchaseOrderDialog } from '@/components/business/purchase-order-dialog';
import { PurchaseHistoryDialog } from '@/components/business/purchase-history-dialog';

export default function ProductsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { concesionario, hasPermission, currentRole } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseHistoryOpen, setPurchaseHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('todos');
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [isSellerMode, setIsSellerMode] = useState(false);

  const hasManageRole = currentRole === 'dueno' || currentRole === 'encargado' || currentRole === 'secretario';
  const roleCanSeeCosts = currentRole ? CAN_SEE_PURCHASE_COSTS[currentRole as BusinessRole] : false;

  const permission = hasPermission('products');
  const isReadOnly = permission === 'read' || isSellerMode;
  const canManage = (currentRole === 'dueno' || currentRole === 'encargado') && !isSellerMode;
  const canSeeCosts = roleCanSeeCosts && !isSellerMode;

  const loadProductos = async () => {
    if (!concesionario?.id) return;
    setIsLoading(true);
    try {
      const ref = collection(firestore, 'concesionarios', concesionario.id, 'productos');
      const snap = await getDocs(query(ref, orderBy('nombre', 'asc')));
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al cargar productos.' });
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProductos(); }, [concesionario?.id]);

  useEffect(() => {
    if (!concesionario?.id) return;
    const cfg = concesionario.configuracion as any;
    const manualRate = Number(cfg?.tasa_cambio_manual) || 0;
    const autoEnabled = cfg?.tasa_cambio_auto === true || cfg?.tasa_cambio_auto === 'true';

    if (autoEnabled) {
      fetch('/api/business/exchange-rate')
        .then(r => r.json())
        .then(data => { if (data.tasa) setTasaCambio(Number(data.tasa)); else setTasaCambio(manualRate); })
        .catch(() => setTasaCambio(manualRate));
    } else {
      setTasaCambio(manualRate);
    }
  }, [concesionario]);

  const handleDelete = async (id: string) => {
    if (!concesionario?.id) return;
    try {
      await deleteDoc(doc(firestore, 'concesionarios', concesionario.id, 'productos', id));
      toast({ title: 'Producto eliminado' });
      loadProductos();
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar.' });
    }
  };

  const lowStockProducts = useMemo(() => productos.filter(p => p.stock_actual <= p.stock_minimo), [productos]);

  const filteredProductos = useMemo(() => {
    let list = productos;
    if (activeTab === 'bajo_stock') list = list.filter(p => p.stock_actual <= p.stock_minimo);
    if (categoryFilter !== 'todos') list = list.filter(p => p.categoria === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => `${p.nombre} ${p.codigo}`.toLowerCase().includes(q));
    }
    return list;
  }, [productos, activeTab, categoryFilter, searchQuery]);

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-slate-900">Productos</h1>
          <p className="text-muted-foreground mt-1">{productos.length} producto{productos.length !== 1 ? 's' : ''} en catálogo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasManageRole && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-full border border-slate-200 shadow-sm transition-all hover:bg-slate-100">
              <Switch id="seller-mode" checked={isSellerMode} onCheckedChange={setIsSellerMode} />
              <Label htmlFor="seller-mode" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-slate-500 whitespace-nowrap">Modo Vendedor</Label>
            </div>
          )}
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setSuppliersOpen(true)} className="rounded-xl font-bold">
                <Building2 className="h-4 w-4 mr-2" /> Proveedores
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl font-bold">
                    <ShoppingCart className="h-4 w-4 mr-2" /> Compras <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl shadow-xl">
                  <DropdownMenuItem onSelect={() => setTimeout(() => setPurchaseOpen(true), 100)} className="font-bold">
                    <Plus className="mr-2 h-4 w-4" /> Nueva Compra
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTimeout(() => setPurchaseHistoryOpen(true), 100)} className="font-bold">
                    <FileClock className="mr-2 h-4 w-4" /> Historial
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {!isReadOnly && (
            <Button onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }} className="rounded-xl font-bold shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar por nombre o código..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl h-12 border-slate-200 focus:border-primary/50 transition-all" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[220px] h-12 rounded-xl border-slate-200"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="todos">Todas las categorías</SelectItem>
            {(Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]).map(cat => (
              <SelectItem key={cat} value={cat}>{PRODUCT_CATEGORY_LABELS[cat]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-12 border border-slate-200/60 shadow-inner">
          <TabsTrigger value="todos" className="rounded-xl px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold">
            Todos <Badge variant="secondary" className="ml-1.5 text-[10px] bg-slate-200 text-slate-600 font-black">{productos.length}</Badge>
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="bajo_stock" className="gap-1.5 rounded-xl px-6 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md transition-all font-bold">
              <AlertTriangle className="h-3.5 w-3.5" />
              Stock Bajo
              {lowStockProducts.length > 0 && <Badge variant="secondary" className="ml-0.5 text-[10px] bg-amber-100 text-amber-600 font-black">{lowStockProducts.length}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-0 focus-visible:ring-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
            </div>
          ) : filteredProductos.length === 0 ? (
            <Card className="bg-white border-slate-200 shadow-sm rounded-[2rem] overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center h-80 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Package className="h-10 w-10 text-slate-300" />
                </div>
                <p className="text-xl font-bold font-headline text-slate-900">No hay productos</p>
                <p className="text-muted-foreground text-sm mt-2 max-w-[250px]">
                  {searchQuery ? 'No se encontraron resultados para tu búsqueda.' : 'Tu catálogo está vacío por ahora.'}
                </p>
                {!isReadOnly && !searchQuery && (
                  <Button className="mt-8 rounded-2xl h-12 px-8 shadow-lg shadow-primary/20" onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> Agregar Producto
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <div className={cn(
                  "grid gap-4 px-6 py-3 mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400",
                  "grid-cols-[1fr_120px_120px]",
                  canSeeCosts && "grid-cols-[1fr_120px_120px_120px]",
                  !isReadOnly && canSeeCosts ? "grid-cols-[1fr_120px_120px_120px_100px_80px_100px]" : 
                  !isReadOnly && !canSeeCosts ? "grid-cols-[1fr_120px_120px_100px_80px_100px]" :
                  isReadOnly && canSeeCosts ? "grid-cols-[1fr_120px_120px_120px_100px_80px]" :
                  "grid-cols-[1fr_120px_120px_100px_80px]"
                )}>
                  <div>Producto</div>
                  <div>Categoría</div>
                  <div className="text-right">Precio</div>
                  {canSeeCosts && <div className="text-right">Costo</div>}
                  <div className="text-center">Stock</div>
                  <div className="text-center">IVA</div>
                  {!isReadOnly && <div className="text-right">Acciones</div>}
                </div>
                <div className="space-y-3">
                  {filteredProductos.map(p => {
                    const isLow = p.stock_actual <= p.stock_minimo;
                    const gridCols = cn(
                      "grid items-center gap-4 p-4 px-6 bg-white border border-slate-200 rounded-[1.5rem] hover:border-primary/20 hover:translate-y-[-2px] transition-all duration-300 shadow-sm group",
                      !isReadOnly && canSeeCosts ? "grid-cols-[1fr_120px_120px_120px_100px_80px_100px]" : 
                      !isReadOnly && !canSeeCosts ? "grid-cols-[1fr_120px_120px_100px_80px_100px]" :
                      isReadOnly && canSeeCosts ? "grid-cols-[1fr_120px_120px_120px_100px_80px]" :
                      "grid-cols-[1fr_120px_120px_100px_80px]"
                    );
                    return (
                      <div key={p.id} className={gridCols}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <Package className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold truncate text-sm text-slate-900">{p.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{p.codigo}</p>
                          </div>
                        </div>
                        
                        <div>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-transparent text-[10px] font-bold uppercase tracking-tight rounded-lg">
                            {PRODUCT_CATEGORY_LABELS[p.categoria]}
                          </Badge>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-primary">${p.precio_venta_usd.toFixed(2)}</p>
                          {tasaCambio > 0 && (
                            <p className="text-[9px] text-slate-400 font-medium uppercase">Bs {(p.precio_venta_usd * tasaCambio).toFixed(2)}</p>
                          )}
                        </div>

                        {canSeeCosts && (
                          <div className="text-right">
                            <p className="font-bold text-slate-500 text-sm">${p.costo_usd.toFixed(2)}</p>
                            {tasaCambio > 0 && (
                              <p className="text-[9px] text-slate-300 font-medium uppercase">Bs {(p.costo_usd * tasaCambio).toFixed(2)}</p>
                            )}
                          </div>
                        )}

                        <div className="text-center">
                          <div className={cn(
                            "inline-flex flex-col items-center justify-center min-w-[50px] py-1 px-2 rounded-xl border transition-colors shadow-sm",
                            isLow ? "bg-red-50 border-red-100 text-red-600" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                          )}>
                            <span className="text-sm font-black leading-none">{p.stock_actual}</span>
                            <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5 opacity-60">Físico</span>
                          </div>
                        </div>

                        <div className="text-center">
                          {p.aplica_iva ? (
                            <Badge variant="outline" className="text-[10px] font-black border-primary/20 text-primary bg-primary/5 rounded-lg">16%</Badge>
                          ) : (
                            <span className="text-[10px] font-black text-slate-200">—</span>
                          )}
                        </div>

                        {!isReadOnly && (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white rounded-[2rem] border-slate-200 shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-2xl font-bold font-headline text-slate-900">¿Eliminar producto?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-500">Esta acción no se puede deshacer y eliminará permanentemente "{p.nombre}" del catálogo.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6 gap-3">
                                  <AlertDialogCancel className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest h-12">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700 rounded-xl px-8 font-bold h-12" onClick={() => handleDelete(p.id)}>
                                    Sí, Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Grid View */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredProductos.map(p => {
                  const isLow = p.stock_actual <= p.stock_minimo;
                  return (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-[2rem] p-5 space-y-4 shadow-sm active:scale-[0.98] transition-all">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-base truncate leading-tight text-slate-900">{p.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">{p.codigo}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-transparent text-[9px] font-black uppercase tracking-tight rounded-lg shrink-0">
                          {PRODUCT_CATEGORY_LABELS[p.categoria]}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio</p>
                          <p className="text-xl font-bold text-primary">${p.precio_venta_usd.toFixed(2)}</p>
                          {tasaCambio > 0 && <p className="text-[10px] font-bold text-slate-300">Bs {(p.precio_venta_usd * tasaCambio).toFixed(2)}</p>}
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En Stock</p>
                          <div className={cn(
                            "inline-flex items-center gap-1.5 font-bold",
                            isLow ? "text-red-500" : "text-emerald-600"
                          )}>
                            <span className="text-xl">{p.stock_actual}</span>
                            <span className="text-[10px] uppercase">UND</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Impuesto</span>
                            {p.aplica_iva ? (
                              <span className="text-[10px] font-black text-primary uppercase">IVA 16%</span>
                            ) : (
                              <span className="text-[10px] font-black text-slate-300 uppercase">Exento</span>
                            )}
                          </div>
                        </div>
                        
                        {!isReadOnly && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="rounded-xl h-9 px-4 border-slate-200 bg-white hover:bg-slate-50 font-bold" onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="rounded-xl h-9 w-9 text-slate-300 p-0 border border-slate-100 hover:bg-red-50 hover:text-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="w-[90vw] rounded-[2rem] bg-white border-slate-200 shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-bold font-headline">¿Eliminar?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-500">Se borrará permanentemente "{p.nombre}".</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-row gap-3 mt-6">
                                  <AlertDialogCancel className="flex-1 rounded-xl m-0 h-12 font-bold uppercase text-[10px]">No</AlertDialogCancel>
                                  <AlertDialogAction className="flex-1 rounded-xl m-0 bg-red-600 h-12 font-bold" onClick={() => handleDelete(p.id)}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        onSaved={loadProductos}
      />
      <SuppliersDialog open={suppliersOpen} onOpenChange={setSuppliersOpen} />
      <PurchaseOrderDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} onSaved={loadProductos} />
      <PurchaseHistoryDialog open={purchaseHistoryOpen} onOpenChange={setPurchaseHistoryOpen} onPurchaseDeleted={loadProductos} />
    </div>
  );
}
