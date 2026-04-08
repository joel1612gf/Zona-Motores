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
          <h1 className="text-3xl font-bold font-headline">Productos</h1>
          <p className="text-muted-foreground mt-1">{productos.length} producto{productos.length !== 1 ? 's' : ''} en catálogo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasManageRole && (
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-full border border-border/60">
              <Switch id="seller-mode" checked={isSellerMode} onCheckedChange={setIsSellerMode} />
              <Label htmlFor="seller-mode" className="text-sm font-medium cursor-pointer text-muted-foreground whitespace-nowrap">Modo Vendedor</Label>
            </div>
          )}
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setSuppliersOpen(true)}>
                <Building2 className="h-4 w-4 mr-2" /> Proveedores
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <ShoppingCart className="h-4 w-4 mr-2" /> Cargar Compra <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setTimeout(() => setPurchaseOpen(true), 100)}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Compra
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTimeout(() => setPurchaseHistoryOpen(true), 100)}>
                    <FileClock className="mr-2 h-4 w-4" /> Historial
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {!isReadOnly && (
            <Button onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {canManage && lowStockProducts.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p><strong>{lowStockProducts.length} producto{lowStockProducts.length > 1 ? 's con' : ' con'} stock bajo:</strong> {lowStockProducts.slice(0, 3).map(p => p.nombre).join(', ')}{lowStockProducts.length > 3 ? '...' : ''}</p>
          <Button variant="link" size="sm" className="ml-auto text-amber-700 p-0 h-auto" onClick={() => setActiveTab('bajo_stock')}>Ver todos</Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o código..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las categorías</SelectItem>
            {(Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]).map(cat => (
              <SelectItem key={cat} value={cat}>{PRODUCT_CATEGORY_LABELS[cat]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">
            Todos <Badge variant="secondary" className="ml-1.5 text-xs">{productos.length}</Badge>
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="bajo_stock" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Stock Bajo
              {lowStockProducts.length > 0 && <Badge variant="secondary" className="ml-0.5 text-xs bg-amber-100 text-amber-700">{lowStockProducts.length}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProductos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No hay productos</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchQuery ? 'No se encontraron resultados.' : 'Agrega tu primer producto al catálogo.'}
                </p>
                {!isReadOnly && !searchQuery && (
                  <Button className="mt-4" onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> Agregar Producto
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Producto</th>
                    <th className="text-left p-3 font-semibold hidden sm:table-cell">Categoría</th>
                    <th className="text-right p-3 font-semibold">Precio $</th>
                    {canSeeCosts && <th className="text-right p-3 font-semibold hidden md:table-cell">Costo $</th>}
                    <th className="text-center p-3 font-semibold">Stock</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">IVA</th>
                    {!isReadOnly && <th className="p-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProductos.map(p => {
                    const isLow = p.stock_actual <= p.stock_minimo;
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <p className="font-medium">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.codigo}</p>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <Badge variant="secondary" className="text-xs">{PRODUCT_CATEGORY_LABELS[p.categoria]}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-semibold text-primary">${p.precio_venta_usd.toFixed(2)}</span>
                          {tasaCambio > 0 ? (
                            <span className="block text-xs text-muted-foreground mt-0.5">Bs {(p.precio_venta_usd * tasaCambio).toFixed(2)}</span>
                          ) : (
                            <span className="block text-xs text-muted-foreground mt-0.5 opacity-50" title="Tasa de cambio no configurada">Bs ---</span>
                          )}
                        </td>
                        {canSeeCosts && (
                          <td className="p-3 text-right hidden md:table-cell">
                            <span className="text-muted-foreground">${p.costo_usd.toFixed(2)}</span>
                            {tasaCambio > 0 ? (
                              <span className="block text-xs text-muted-foreground opacity-70 mt-0.5">Bs {(p.costo_usd * tasaCambio).toFixed(2)}</span>
                            ) : (
                              <span className="block text-xs text-muted-foreground opacity-50 mt-0.5" title="Tasa de cambio no configurada">Bs ---</span>
                            )}
                          </td>
                        )}
                        <td className="p-3 text-center">
                          <Badge variant={isLow ? 'destructive' : 'secondary'} className={isLow ? '' : 'bg-green-100 text-green-700'}>
                            {isLow && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {p.stock_actual}
                          </Badge>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          {p.aplica_iva ? <Badge variant="outline" className="text-xs">16%</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        {!isReadOnly && (
                          <td className="p-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción no se puede deshacer y eliminará "{p.nombre}" del catálogo.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(p.id)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
      <PurchaseHistoryDialog open={purchaseHistoryOpen} onOpenChange={setPurchaseHistoryOpen} />
    </div>
  );
}
