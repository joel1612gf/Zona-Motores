'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, addDoc, updateDoc, collection, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { Producto, ProductCategory } from '@/lib/business-types';
import { PRODUCT_CATEGORY_LABELS } from '@/lib/business-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Producto | null;
  onSaved: () => void;
}

const EMPTY_FORM = {
  codigo: '',
  nombre: '',
  descripcion: '',
  categoria: 'otros' as ProductCategory,
  precio_venta_usd: '',
  costo_usd: '',
  stock_actual: '',
  stock_minimo: '',
  aplica_iva: false,
  proveedor_id: '',
};

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: ProductFormDialogProps) {
  const firestore = useFirestore();
  const { concesionario } = useBusinessAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState<any | null>(null);

  useEffect(() => {
    if (product) {
      setForm({
        codigo: product.codigo,
        nombre: product.nombre,
        descripcion: product.descripcion || '',
        categoria: product.categoria,
        precio_venta_usd: String(product.precio_venta_usd),
        costo_usd: String(product.costo_usd),
        stock_actual: String(product.stock_actual),
        stock_minimo: String(product.stock_minimo),
        aplica_iva: product.aplica_iva,
        proveedor_id: product.proveedor_id || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [product, open]);

  useEffect(() => {
    if (open && product?.id && concesionario?.id) {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
           const snap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'compras'), orderBy('created_at', 'desc')));
           const docs = snap.docs.map(skip => ({ id: skip.id, ...skip.data() }));
           const found = docs.filter(skip => skip.items?.some((i: any) => i.producto_id === product.id));
           setHistory(found);
        } catch (e) {
           console.error('Error fetching history:', e);
        }
        setIsLoadingHistory(false);
      };
      fetchHistory();
    } else {
      setHistory([]);
      setSelectedCompra(null);
    }
  }, [open, product, concesionario, firestore]);

  const handleSave = async () => {
    if (!concesionario?.id) return;
    if (!form.nombre.trim() || !form.codigo.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Código y nombre son obligatorios.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        categoria: form.categoria,
        precio_venta_usd: parseFloat(form.precio_venta_usd) || 0,
        costo_usd: parseFloat(form.costo_usd) || 0,
        stock_actual: parseInt(form.stock_actual) || 0,
        stock_minimo: parseInt(form.stock_minimo) || 0,
        aplica_iva: form.aplica_iva,
        proveedor_id: form.proveedor_id || null,
        updated_at: serverTimestamp(),
      };

      const colRef = collection(firestore, 'concesionarios', concesionario.id, 'productos');

      if (product?.id) {
        await updateDoc(doc(colRef, product.id), payload);
      } else {
        await addDoc(colRef, { ...payload, created_at: serverTimestamp() });
      }

      toast({ title: product?.id ? 'Producto actualizado' : 'Producto creado', description: form.nombre });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el producto.' });
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.id ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="datos" className="w-full flex-col flex" onValueChange={() => setSelectedCompra(null)}>
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="datos">Datos del Producto</TabsTrigger>
            <TabsTrigger value="historial" disabled={!product?.id}>Historial de Compras</TabsTrigger>
          </TabsList>

          <TabsContent value="datos" className="space-y-4">
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código / Cód. Barras *</Label>
              <Input placeholder="ej: 7591234567890" value={form.codigo} onChange={set('codigo')} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v as ProductCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]).map(cat => (
                    <SelectItem key={cat} value={cat}>{PRODUCT_CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nombre del Producto *</Label>
            <Input placeholder="ej: Aceite Sintetico 5W-30 1L" value={form.nombre} onChange={set('nombre')} />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea placeholder="Descripción opcional..." value={form.descripcion} onChange={set('descripcion')} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Precio de Venta ($)</Label>
              <Input type="number" min={0} step={0.01} placeholder="0.00" value={form.precio_venta_usd} onChange={set('precio_venta_usd')} />
            </div>
            <div className="space-y-1.5">
              <Label>Último Costo ($)</Label>
              <Input type="number" min={0} step={0.01} placeholder="0.00" value={form.costo_usd} onChange={set('costo_usd')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stock Actual</Label>
              <Input type="number" min={0} placeholder="0" value={form.stock_actual} onChange={set('stock_actual')} />
            </div>
            <div className="space-y-1.5">
              <Label>Stock Mínimo (alerta)</Label>
              <Input type="number" min={0} placeholder="5" value={form.stock_minimo} onChange={set('stock_minimo')} />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <Switch
              id="aplica_iva"
              checked={form.aplica_iva}
              onCheckedChange={v => setForm(p => ({ ...p, aplica_iva: v }))}
            />
            <Label htmlFor="aplica_iva" className="cursor-pointer">
              Este producto aplica IVA (16%)
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-4 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {product?.id ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </DialogFooter>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4 max-h-[60vh] overflow-y-auto">
          {selectedCompra ? (
            <div className="space-y-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCompra(null)} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
                &larr; Volver al listado
              </Button>
              <div className="rounded-lg border p-3 space-y-2 text-sm bg-muted/10">
                 <div className="flex justify-between border-b pb-2">
                   <p className="font-semibold text-base">{selectedCompra.proveedor_nombre || 'Proveedor'}</p>
                   <p className="font-medium text-primary">Factura: {selectedCompra.numero_factura || 'S/N'}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-2 pb-2 border-b">
                   <div>
                     <p className="text-xs text-muted-foreground">Fecha Compra</p>
                     <p>{selectedCompra.created_at?.toDate ? selectedCompra.created_at.toDate().toLocaleDateString() : 'N/A'}</p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground">Tipo Pago</p>
                     <p className="capitalize">{selectedCompra.tipo_pago}</p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground">Total USD</p>
                     <p className="font-medium">${selectedCompra.total_usd?.toFixed(2)}</p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground">Tasa BCV</p>
                     <p>{selectedCompra.tasa_cambio ? `Bs. ${selectedCompra.tasa_cambio}` : 'N/A'}</p>
                   </div>
                 </div>
                 <div>
                   <p className="font-medium mb-1 mt-1 text-xs uppercase tracking-wider">Artículos en la factura</p>
                   <div className="space-y-1.5 flex flex-col gap-1">
                     {selectedCompra.items?.map((it: any, i: number) => (
                       <div key={i} className={`flex justify-between p-2 rounded-md ${it.producto_id === product?.id ? 'bg-primary/10 border-l-2 border-primary' : 'bg-muted/30 border'}`}>
                         <span className="truncate flex-1 pr-2 text-xs font-medium">{it.nombre} <span className="text-muted-foreground font-normal">× {it.cantidad}</span></span>
                         <span className="font-semibold text-xs text-primary">${it.costo_unitario_usd?.toFixed(2)} c/u</span>
                       </div>
                     ))}
                   </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {isLoadingHistory ? (
                 <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : history.length === 0 ? (
                 <div className="text-center p-8 bg-muted/20 border border-dashed rounded-lg">
                   <p className="text-sm text-muted-foreground font-medium">No hay historial de compras.</p>
                   <p className="text-xs text-muted-foreground mt-1">Este producto no se ha registrado en ninguna compra todavía.</p>
                 </div>
              ) : (
                 history.map(comp => {
                    const itemData = comp.items?.find((i: any) => i.producto_id === product?.id);
                    return (
                       <div key={comp.id} onClick={() => setSelectedCompra(comp)} className="cursor-pointer border rounded-md p-3 space-y-2 text-sm hover:border-primary hover:bg-muted/30 transition-colors">
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="font-semibold">{comp.proveedor_nombre || 'Proveedor Desconocido'}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                   Factura: {comp.numero_factura || 'N/A'} • {comp.created_at?.toDate ? comp.created_at.toDate().toLocaleDateString() : ''}
                                </p>
                             </div>
                             <div className="text-right">
                                <p className="font-medium bg-primary/10 text-primary px-2 py-0.5 rounded text-xs inline-block">
                                   ${itemData?.costo_unitario_usd?.toFixed(2) || '0.00'} c/u
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-1 text-right w-full">Comprados: {itemData?.cantidad || 0}</p>
                             </div>
                          </div>
                       </div>
                    )
                 })
              )}
            </div>
          )}
        </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
