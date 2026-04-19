'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { 
  Loader2, 
  Package, 
  Layers, 
  Banknote, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Info,
  DollarSign,
  Boxes,
  Eye,
  History,
  ShoppingCart,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  doc, 
  addDoc, 
  updateDoc, 
  collection, 
  serverTimestamp, 
  getDocs, 
  query, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { Producto, ProductCategory } from '@/lib/business-types';
import { PRODUCT_CATEGORY_LABELS } from '@/lib/business-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency } from '@/lib/utils';

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

const STEPS = [
  { id: 1, label: 'Básico', icon: Package },
  { id: 2, label: 'Detalles', icon: Layers },
  { id: 3, label: 'Precios', icon: Banknote },
  { id: 4, label: 'Inventario', icon: CheckCircle2 },
];

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: ProductFormDialogProps) {
  const firestore = useFirestore();
  const { concesionario } = useBusinessAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
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
      setStep(1);
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

  const totalInversion = useMemo(() => {
    const qty = parseFloat(form.stock_actual) || 0;
    const cost = parseFloat(form.costo_usd) || 0;
    return qty * cost;
  }, [form.stock_actual, form.costo_usd]);

  const handleSave = async () => {
    if (!concesionario?.id) return;
    if (!form.nombre.trim() || !form.codigo.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Código y nombre son obligatorios.' });
      setStep(1);
      return;
    }

    setIsSaving(true);
    try {
      const colRef = collection(firestore, 'concesionarios', concesionario.id, 'productos');

      // Double check if barcode (codigo) already exists
      const q = query(colRef, where('codigo', '==', form.codigo.trim()));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(d => d.id !== product?.id);

      if (isDuplicate) {
        toast({ 
          variant: 'destructive', 
          title: 'Código duplicado', 
          description: `El código "${form.codigo}" ya está registrado en otro producto.` 
        });
        setStep(1);
        setIsSaving(false);
        return;
      }

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

  const nextStep = async () => {
    // Only validate when moving from step 1 to 2
    if (step === 1) {
      if (!form.nombre.trim() || !form.codigo.trim()) {
        toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Por favor completa el código y nombre.' });
        return;
      }

      if (!concesionario?.id) return;
      setIsSaving(true);
      try {
        const colRef = collection(firestore, 'concesionarios', concesionario.id, 'productos');
        // VERY IMPORTANT: Explicitly use the imported 'where' and 'query'
        const barcodeQuery = query(colRef, where('codigo', '==', form.codigo.trim()));
        const snap = await getDocs(barcodeQuery);
        const isDuplicate = snap.docs.some(d => d.id !== product?.id);

        if (isDuplicate) {
          toast({ 
            variant: 'destructive', 
            title: 'Código duplicado', 
            description: `El código "${form.codigo}" ya pertenece a otro producto.` 
          });
          setIsSaving(false);
          return; // BLOCK PROGRESS
        }
      } catch (e) {
        console.error("Error validating code:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo validar el código. Intenta de nuevo.' });
        setIsSaving(false);
        return; // BLOCK PROGRESS ON ERROR
      } finally {
        setIsSaving(false);
      }
    }
    
    // Proceed if validation passed or not in Step 1
    setStep(s => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-white/95 backdrop-blur-3xl border-white/40 shadow-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="p-8 pb-4 border-b border-black/5 bg-white/5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold font-headline text-slate-900">{product?.id ? 'Editar Producto' : 'Cargar Producto'}</DialogTitle>
              <p className="text-muted-foreground text-sm mt-1">{product?.id ? 'Actualiza los detalles del catálogo' : 'Sigue los pasos para agregar un nuevo item'}</p>
            </div>
            {product?.id && (
              <div className="bg-black/5 rounded-2xl p-1 flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn("rounded-xl text-[10px] font-black uppercase tracking-widest h-8 px-4", step <= 4 && "bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => setStep(1)}
                >
                  <Info className="w-3 h-3 mr-1.5" /> Ficha
                </Button>
                <Tabs defaultValue="datos" className="contents">
                  <TabsList className="bg-transparent p-0 gap-1 h-auto">
                    <TabsTrigger 
                      value="historial" 
                      className="rounded-xl text-[10px] font-black uppercase tracking-widest h-8 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      onClick={() => setStep(5)}
                    >
                      <History className="w-3 h-3 mr-1.5" /> Historial
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
          </div>

          {step <= 4 && (
            <div className="flex items-center justify-between pt-8 px-4 relative">
              <div className="absolute top-[3.25rem] left-10 right-10 h-px bg-black/5 -z-10" />
              {STEPS.map((s) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isCompleted = step > s.id;
                return (
                  <div key={s.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => (isCompleted || isActive) && setStep(s.id)}>
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg",
                      isActive ? "bg-primary text-primary-foreground scale-110 shadow-primary/30" : 
                      isCompleted ? "bg-emerald-500 text-white shadow-emerald-500/20" : 
                      "bg-white border border-black/5 text-muted-foreground"
                    )}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground/60"
                    )}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Código de Barras / SKU *</Label>
                  <div className="relative group">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50 group-focus-within:opacity-100 transition-opacity" />
                    <Input placeholder="759123456..." value={form.codigo} onChange={set('codigo')} className="h-14 pl-12 rounded-2xl bg-white border-black/5 focus:border-primary/50 text-base font-medium transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Comercial *</Label>
                  <Input placeholder="Ej: Aceite Sintético 5W-30" value={form.nombre} onChange={set('nombre')} className="h-14 rounded-2xl bg-white border-black/5 focus:border-primary/50 text-base font-medium transition-all" />
                </div>
              </div>
              <div className="bg-primary/5 rounded-[2rem] p-8 border border-primary/10 flex flex-col items-center justify-center text-center space-y-4">
                <Info className="w-12 h-12 text-primary opacity-30" />
                <h4 className="font-bold text-primary">Información Básica</h4>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                  Asegúrate de que el código y el nombre coincidan con la factura física para mantener un inventario impecable.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoría del Producto</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v as ProductCategory }))}>
                    <SelectTrigger className="h-14 rounded-2xl bg-white border-black/5 text-base font-medium transition-all">
                      <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-primary" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-white/95 backdrop-blur-xl border-black/5 shadow-2xl">
                      {(Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]).map(cat => (
                        <SelectItem key={cat} value={cat} className="rounded-xl py-3 font-medium uppercase text-xs tracking-wide">{PRODUCT_CATEGORY_LABELS[cat]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Descripción Detallada</Label>
                  <Textarea placeholder="Indica especificaciones, compatibilidad..." value={form.descripcion} onChange={set('descripcion')} rows={4} className="rounded-2xl bg-white border-black/5 focus:border-primary/50 transition-all resize-none p-4" />
                </div>
              </div>
              <div className="bg-black/5 rounded-[2rem] p-8 border border-black/5 flex flex-col items-center justify-center text-center space-y-4">
                <Info className="w-12 h-12 text-primary opacity-30" />
                <h4 className="font-bold">Consejo de Ventas</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Una descripción detallada mejora la búsqueda interna y ayuda a los vendedores a cerrar ventas más rápido.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Precio de Venta Sugerido ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                    <Input type="number" step="0.01" placeholder="0.00" value={form.precio_venta_usd} onChange={set('precio_venta_usd')} className="h-14 pl-12 rounded-2xl bg-emerald-500/5 border-emerald-500/20 text-xl font-bold text-emerald-600 transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Costo de Adquisición ($)</Label>
                  <div className="relative">
                    <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                    <Input type="number" step="0.01" placeholder="0.00" value={form.costo_usd} onChange={set('costo_usd')} className="h-14 pl-12 rounded-2xl bg-white border-black/5 text-xl font-bold transition-all" />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-black/5 border border-black/5 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Margen de Ganancia</p>
                      <p className="text-2xl font-bold font-headline mt-1">
                        {parseFloat(form.precio_venta_usd) && parseFloat(form.costo_usd) 
                          ? `${(((parseFloat(form.precio_venta_usd) / parseFloat(form.costo_usd)) - 1) * 100).toFixed(1)}%` 
                          : '—'}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-black/5 group transition-all hover:bg-black/5">
                    <Switch 
                      id="aplica-iva"
                      checked={form.aplica_iva} 
                      onCheckedChange={v => setForm(p => ({ ...p, aplica_iva: v }))} 
                    />
                    <Label htmlFor="aplica-iva" className="flex-1 cursor-pointer">
                      <span className="font-bold text-sm block">Aplicar IVA (16%)</span>
                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Sujeto a normativa fiscal SENIAT</p>
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Stock Actual (Físico)</Label>
                  <div className="relative">
                    <Boxes className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                    <Input type="number" placeholder="0" value={form.stock_actual} onChange={set('stock_actual')} className="h-14 pl-12 rounded-2xl bg-white border-black/5 text-xl font-bold transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Stock Mínimo (Alerta)</Label>
                  <Input type="number" placeholder="5" value={form.stock_minimo} onChange={set('stock_minimo')} className="h-14 rounded-2xl bg-white border-black/5 text-xl font-bold transition-all" />
                </div>
              </div>
              <div className="flex flex-col justify-end">
                <div className="relative p-8 rounded-[2rem] bg-primary shadow-[0_0_25px_rgba(36,99,235,0.2)] overflow-hidden group">
                  <CheckCircle2 className="absolute -bottom-6 -right-6 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Resumen de Inversión</p>
                    <h3 className="text-4xl font-bold font-headline text-white">{formatCurrency(totalInversion)}</h3>
                    <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-white/40 uppercase tracking-widest">
                      <Info className="w-3 h-3" />
                      Inversión total en este inventario
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-500 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
              {selectedCompra ? (
                <div className="space-y-4">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCompra(null)} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground uppercase text-[10px] font-black tracking-widest">
                    <ChevronLeft className="w-3 h-3 mr-2" /> Volver al listado
                  </Button>
                  <div className="rounded-[2rem] border border-black/5 p-6 space-y-4 bg-white shadow-sm">
                     <div className="flex justify-between items-center border-b border-black/5 pb-4">
                       <p className="font-bold text-lg">{selectedCompra.proveedor_nombre || 'Proveedor'}</p>
                       <Badge variant="outline" className="border-primary/30 text-primary">Factura: {selectedCompra.numero_factura || 'S/N'}</Badge>
                     </div>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                       <div className="p-3 rounded-xl bg-black/5">
                         <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Fecha</p>
                         <p className="font-bold">{selectedCompra.created_at?.toDate ? selectedCompra.created_at.toDate().toLocaleDateString() : '—'}</p>
                       </div>
                       <div className="p-3 rounded-xl bg-black/5">
                         <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Monto Compra</p>
                         <p className="font-bold text-primary">${selectedCompra.total_usd?.toFixed(2)}</p>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Otros items en esta factura</p>
                       {selectedCompra.items?.map((it: any, i: number) => (
                         <div key={i} className={cn(
                           "flex justify-between p-3 rounded-xl border transition-all",
                           it.producto_id === product?.id ? "bg-primary/5 border-primary/30 shadow-[0_0_15px_rgba(36,99,235,0.05)]" : "bg-black/5 border-transparent"
                         )}>
                           <span className="truncate flex-1 pr-2 text-xs font-bold">{it.nombre} <span className="text-muted-foreground font-normal">× {it.cantidad}</span></span>
                           <span className="font-black text-xs text-primary">${it.costo_unitario_usd?.toFixed(2)}</span>
                         </div>
                       ))}
                     </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {isLoadingHistory ? (
                     <div className="flex justify-center p-12"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" /></div>
                  ) : history.length === 0 ? (
                     <div className="text-center p-12 bg-black/5 border border-dashed border-black/10 rounded-[2rem]">
                       <Eye className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                       <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Sin movimientos registrados</p>
                       <p className="text-xs text-muted-foreground mt-1">Este producto no ha sido cargado en compras.</p>
                     </div>
                  ) : (
                     history.map(comp => {
                        const itemData = comp.items?.find((i: any) => i.producto_id === product?.id);
                        return (
                           <div key={comp.id} onClick={() => setSelectedCompra(comp)} className="group cursor-pointer bg-white border border-black/5 rounded-2xl p-4 flex items-center justify-between hover:bg-black/5 hover:border-primary/30 hover:translate-x-1 transition-all">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <ShoppingCart className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                   <p className="font-bold text-sm">{comp.proveedor_nombre || 'Proveedor'}</p>
                                   <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">
                                      {comp.created_at?.toDate ? comp.created_at.toDate().toLocaleDateString() : ''} • Fact: {comp.numero_factura || '—'}
                                   </p>
                                </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-lg font-black text-primary">${itemData?.costo_unitario_usd?.toFixed(2) || '0.00'}</p>
                                 <p className="text-[9px] text-muted-foreground font-bold uppercase">Cant: {itemData?.cantidad || 0}</p>
                              </div>
                           </div>
                        )
                     })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-8 bg-black/5 border-t border-black/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {step > 1 && step <= 4 && (
              <Button variant="ghost" onClick={prevStep} className="rounded-2xl h-12 px-6 hover:bg-black/5 font-bold">
                <ChevronLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-2xl h-12 px-6 hover:bg-black/5 font-bold uppercase text-xs tracking-widest text-slate-600">Cancelar</Button>
            {step < 4 ? (
              <Button 
                onClick={nextStep} 
                disabled={isSaving}
                className="rounded-2xl h-12 px-8 bg-primary shadow-lg shadow-primary/20 font-bold text-white hover:bg-primary/90 min-w-[140px]"
              >
                {isSaving && step === 1 ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isSaving && step === 1 ? 'Validando...' : (
                  <>Siguiente <ChevronRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            ) : step === 4 ? (
              <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl h-12 px-10 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 font-bold text-white min-w-[180px]">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {product?.id ? 'Guardar Cambios' : 'Finalizar Carga'}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
