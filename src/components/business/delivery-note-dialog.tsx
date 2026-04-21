'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Package,
  RefreshCw,
  DollarSign,
  Check,
  ChevronDown,
  Search,
  CheckCircle2,
  Printer,
  Download,
  Hash,
  Calendar,
  Percent,
  Pencil,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  increment,
  where,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { Proveedor, Producto, CompraItem } from '@/lib/business-types';
import { cn } from '@/lib/utils';
import { ProductFormDialog } from '@/components/business/product-form-dialog';
import { SupplierFormDialog } from '@/components/business/supplier-form-dialog';
import { downloadPdf } from '@/lib/download-pdf';
import { DeliveryNotePrint } from './delivery-note-print';

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const IVA_RATE = 0.16;
const STEPS = ['Proveedor', 'Productos', 'Precios', 'Resumen', 'Finalizar'];

export function DeliveryNoteDialog({ open, onOpenChange, onSaved }: DeliveryNoteDialogProps) {
  const firestore = useFirestore();
  const { concesionario, staff } = useBusinessAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [successData, setSuccessData] = useState<any>(null);

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedProveedor, setSelectedProveedor] = useState<string>('');
  const [numeroOrden, setNumeroOrden] = useState('');
  const [fechaNota, setFechaNota] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState<'usd' | 'bs'>('bs');
  const [items, setItems] = useState<(CompraItem & { _key: string, costo_base_usd?: number, descuento_porcentaje?: number })[]>([]);
  const [tipoPago, setTipoPago] = useState<'contado' | 'credito' | 'por_pagar'>('por_pagar');
  const [diasCredito, setDiasCredito] = useState('30');
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [isTasaLoading, setIsTasaLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateNote, setDuplicateNote] = useState<any>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const [discountItemKey, setDiscountItemKey] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState('');

  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editCost, setEditCost] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCosto, setItemCosto] = useState('');
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);

  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  const printRootId = "delivery-wizard-print-root";

  // Helper: reload productos list (used after inline create)
  const reloadProductos = async () => {
    if (!concesionario?.id) return;
    const snap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'productos'), orderBy('nombre', 'asc')));
    setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setSupplierSearchOpen(false);
      }
    };
    if (supplierSearchOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [supplierSearchOpen]);

  useEffect(() => {
    if (!open || !concesionario?.id) return;
    setStep(0);
    setSelectedProveedor('');
    setItems([]);
    setNumeroOrden('');
    setFechaNota('');
    setInvoiceCurrency('bs');
    setSuccessData(null);
    setDuplicateNote(null);

    const col = (name: string) => collection(firestore, 'concesionarios', concesionario.id, name);
    Promise.all([
      getDocs(query(col('proveedores'), orderBy('created_at', 'desc'))),
      getDocs(query(col('productos'), orderBy('nombre', 'asc'))),
    ]).then(([provSnap, prodSnap]) => {
      setProveedores(provSnap.docs.map(d => ({ id: d.id, ...d.data() } as Proveedor)));
      setProductos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
    });

    const cfg = concesionario.configuracion as any;
    const manualRate = Number(cfg?.tasa_cambio_manual) || 0;
    if (cfg?.tasa_cambio_auto) {
      setIsTasaLoading(true);
      fetch('/api/business/exchange-rate')
        .then(r => r.json())
        .then(data => { if (data.tasa) setTasaCambio(data.tasa); else setTasaCambio(manualRate); })
        .catch(() => setTasaCambio(manualRate))
        .finally(() => setIsTasaLoading(false));
    } else setTasaCambio(manualRate);
  }, [open, concesionario, firestore]);

  const filteredProveedores = proveedores.filter(p => !supplierSearchQuery || `${p.nombre} ${p.rif}`.toLowerCase().includes(supplierSearchQuery.toLowerCase()));
  const filteredProductos = productos.filter(p => !searchQuery || `${p.nombre} ${p.codigo}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const subtotal = items.reduce((s, i) => s + i.subtotal_usd, 0);
  const ivaTotal = items.filter(i => i.aplica_iva).reduce((s, i) => s + i.subtotal_usd * IVA_RATE, 0);
  const total = subtotal + ivaTotal;
  const totalBs = total * tasaCambio;

  const handleNextStepZero = async () => {
    if (!concesionario?.id || !selectedProveedor || !numeroOrden.trim()) return;
    
    setIsCheckingDuplicate(true);
    try {
      // Check if a note with same number exists for this provider
      const q = query(
        collection(firestore, 'concesionarios', concesionario.id, 'compras'),
        where('proveedor_id', '==', selectedProveedor),
        where('numero_factura', '==', numeroOrden.trim())
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        setDuplicateNote(snap.docs[0].data());
        return;
      }
      
      setStep(1);
    } catch (e) {
      console.error(e);
      setStep(1); // Proceed on error to avoid blocking user completely
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleSave = async () => {
    if (!concesionario?.id || items.length === 0) return;
    setIsSaving(true);
    try {
      const proveedor = proveedores.find(p => p.id === selectedProveedor);
      const payload = {
        proveedor_id: selectedProveedor,
        proveedor_nombre: proveedor?.nombre || '',
        numero_factura: numeroOrden.trim() || 'S/N',
        numero_control: 'S/N',
        fecha_factura: fechaNota || null,
        items: items.map(({ _key, ...rest }) => rest),
        tipo_pago: tipoPago,
        subtotal_usd: subtotal,
        iva_monto: ivaTotal,
        total_usd: total,
        total_bs: totalBs,
        tasa_cambio: tasaCambio,
        moneda_original: invoiceCurrency,
        is_fiscal: false,
        estado: tipoPago === 'contado' ? 'pagada' : 'pendiente',
        creado_por: staff?.nombre || 'Sistema',
        created_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(firestore, 'concesionarios', concesionario.id, 'compras'), payload);

      await Promise.all(items.filter(i => !i.producto_id.startsWith('new-')).map(i => {
        const updates: any = { stock_actual: increment(i.cantidad), costo_usd: i.costo_unitario_usd, updated_at: serverTimestamp() };
        if ((i as any).nuevo_precio_usd) updates.precio_venta_usd = (i as any).nuevo_precio_usd;
        return updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'productos', i.producto_id), updates);
      }));

      // Ensure successData includes the ID and all fields for printing
      setSuccessData({ id: docRef.id, ...payload });
      setStep(STEPS.length);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al registrar nota.' });
    } finally { setIsSaving(false); }
  };

  const addItem = () => {
    const prod = productos.find(p => p.id === selectedProductId);
    if (!prod || !itemQty || !itemCosto) return;
    const qty = parseInt(itemQty);
    const cost = parseFloat(itemCosto) || 0;
    const costoUsd = invoiceCurrency === 'bs' && tasaCambio > 0 ? cost / tasaCambio : cost;
    setItems(prev => [...prev, { _key: `${Date.now()}`, producto_id: prod.id, codigo: prod.codigo, nombre: prod.nombre, cantidad: qty, costo_unitario_usd: parseFloat(costoUsd.toFixed(8)), subtotal_usd: parseFloat((qty * costoUsd).toFixed(8)), aplica_iva: prod.aplica_iva }]);
    setSelectedProductId(''); setItemCosto(''); setSearchQuery('');
  };

  const applyDiscount = () => {
    const pct = parseFloat(discountValue) || 0;
    if (pct < 0 || pct > 100) {
      toast({ variant: 'destructive', title: 'Porcentaje inválido.' });
      return;
    }

    setItems(prev => prev.map(item => {
      if (item._key === discountItemKey) {
        const baseCost = item.costo_base_usd || item.costo_unitario_usd;
        const newCost = baseCost * (1 - pct / 100);
        return {
          ...item,
          costo_base_usd: baseCost,
          descuento_porcentaje: pct,
          costo_unitario_usd: parseFloat(newCost.toFixed(8)),
          subtotal_usd: parseFloat((item.cantidad * newCost).toFixed(8)),
        };
      }
      return item;
    }));

    setDiscountItemKey(null);
    setDiscountValue('');
    toast({ title: '✓ Descuento actualizado.' });
  };

  const startEditing = (item: any) => {
    setEditingItemKey(item._key);
    setEditQty(String(item.cantidad));
    setEditCost(invoiceCurrency === 'bs' && tasaCambio > 0 ? (item.costo_unitario_usd * tasaCambio).toFixed(2) : String(item.costo_unitario_usd));
  };

  const saveEdit = () => {
    const qty = parseInt(editQty);
    const cost = parseFloat(editCost) || 0;
    const isBs = invoiceCurrency === 'bs';
    const costoUsd = isBs && tasaCambio > 0 ? cost / tasaCambio : cost;

    if (qty <= 0 || cost < 0) {
      toast({ variant: 'destructive', title: 'Valores inválidos.' });
      return;
    }

    setItems(prev => prev.map(item => {
      if (item._key === editingItemKey) {
        const pct = item.descuento_porcentaje || 0;
        const newCostWithDiscount = costoUsd * (1 - pct / 100);
        return {
          ...item,
          cantidad: qty,
          costo_base_usd: costoUsd,
          costo_unitario_usd: parseFloat(newCostWithDiscount.toFixed(8)),
          subtotal_usd: parseFloat((qty * newCostWithDiscount).toFixed(8))
        };
      }
      return item;
    }));
    setEditingItemKey(null);
  };

  const handlePrint = () => {
    setTimeout(() => {
      const element = document.getElementById(printRootId);
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  const handleDownload = async () => {
    const filename = `Nota_Entrega_${successData?.numero_factura || 'S_N'}.pdf`;
    await downloadPdf({ elementId: printRootId, filename });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-50/95 backdrop-blur-xl border-slate-200 shadow-2xl p-0 rounded-[2rem]">
        {step < STEPS.length && (
          <DialogHeader className="p-6 pb-2 shrink-0 space-y-4">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-700">
              <div className="p-2.5 bg-slate-200 rounded-xl"><Package className="h-6 w-6 text-slate-600" /></div>
              Nota de Entrega (Control Administrativo)
            </DialogTitle>
            <div className="relative flex items-center justify-between px-2 pt-2">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 -z-10 rounded-full" />
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-col items-center gap-2 relative z-10">
                  <div className={cn('flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold border-2 transition-all duration-500', i < step ? 'bg-slate-600 border-slate-600 text-white scale-90' : i === step ? 'bg-white border-slate-600 text-slate-700 ring-4 ring-slate-200 scale-110' : 'bg-slate-100 border-slate-200 text-slate-400')}>{i < step ? <Check className="h-5 w-5" /> : i + 1}</div>
                  <span className={cn('text-[11px] font-semibold uppercase', i === step ? 'text-slate-700' : 'text-slate-400')}>{s}</span>
                </div>
              ))}
            </div>
          </DialogHeader>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-400" /> Seleccionar Proveedor *
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={supplierDropdownRef}>
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full h-12 px-4 text-sm justify-between font-normal text-left bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 hover:border-slate-400 transition-all rounded-xl shadow-sm"
                      onClick={() => setSupplierSearchOpen(!supplierSearchOpen)}
                    >
                      <span className="truncate flex items-center gap-2">
                        {selectedProveedor ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                            {proveedores.find((p) => p.id === selectedProveedor)?.nombre}
                          </>
                        ) : (
                          "Busca o elige un proveedor..."
                        )}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 opacity-50 shrink-0 transition-transform duration-300", supplierSearchOpen && "rotate-180")} />
                    </Button>

                    {supplierSearchOpen && (
                      <div
                        className="absolute top-full left-0 w-full z-[100] mt-2 bg-white dark:bg-slate-900 text-popover-foreground rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in-0 zoom-in-95 overflow-hidden backdrop-blur-xl"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              ref={supplierInputRef}
                              placeholder="Escribe nombre o RIF..."
                              value={supplierSearchQuery}
                              onChange={(e) => setSupplierSearchQuery(e.target.value)}
                              className="pl-10 h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-slate-400/20 rounded-xl"
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setSupplierSearchOpen(false);
                              }}
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-[280px]">
                          <div className="p-2 space-y-1">
                            {filteredProveedores.length === 0 ? (
                              <div className="p-8 text-center space-y-2">
                                <Search className="h-8 w-8 text-slate-200 dark:text-slate-800 mx-auto" />
                                <p className="text-sm text-slate-400 italic">No se encontraron proveedores</p>
                              </div>
                            ) : (
                              filteredProveedores.map((p) => (
                                <Button
                                  key={p.id}
                                  variant="ghost"
                                  className={cn(
                                    "w-full justify-start font-normal h-auto py-3 px-4 rounded-xl transition-all duration-200 text-slate-700 dark:text-slate-300 hover:text-slate-600",
                                    selectedProveedor === p.id ? "bg-slate-100 text-slate-900 font-semibold" : "hover:bg-slate-50"
                                  )}
                                  onClick={() => {
                                    setSelectedProveedor(p.id);
                                    setSupplierSearchOpen(false);
                                    setSupplierSearchQuery('');
                                  }}
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                      selectedProveedor === p.id ? "bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                    )}>
                                      {p.nombre.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col items-start overflow-hidden flex-1">
                                      <span className="truncate w-full text-left text-sm font-medium">{p.nombre}</span>
                                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{p.rif}</span>
                                    </div>
                                    {selectedProveedor === p.id && <Check className="h-4 w-4 shrink-0 text-slate-600" />}
                                  </div>
                                </Button>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-12 w-12 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 hover:text-slate-600 transition-all shadow-sm"
                    onClick={() => setNewSupplierDialogOpen(true)}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Hash className="h-4 w-4 text-slate-500" /> N° de Factura
                  </Label>
                  <Input
                    placeholder="00001612"
                    value={numeroOrden}
                    onChange={e => setNumeroOrden(e.target.value)}
                    className="h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-slate-400 focus:ring-slate-400/20 transition-all rounded-xl pl-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-slate-500" /> ¿Calcular con IVA?
                  </Label>
                  <div className="flex items-center gap-3 h-11 px-4 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <Switch checked={true} disabled />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Siempre Activado (16%)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" /> Fecha de la Factura
                  </Label>
                  <Input
                    type="date"
                    value={fechaNota}
                    onChange={e => setFechaNota(e.target.value)}
                    className="h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-slate-400 focus:ring-slate-400/20 transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <RefreshCw className={cn("h-4 w-4 text-slate-500", isTasaLoading && "animate-spin")} /> Tasa BCV (Bs/$)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="ej: 50.50"
                      value={tasaCambio || ''}
                      onChange={e => setTasaCambio(parseFloat(e.target.value) || 0)}
                      className="h-11 pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-slate-400 focus:ring-slate-400/20 transition-all rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-slate-500" /> Moneda del Documento
                </Label>
                <div className="flex gap-3">
                  {['bs', 'usd'].map(curr => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setInvoiceCurrency(curr as any)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all duration-300 shadow-sm',
                        invoiceCurrency === curr
                          ? 'border-slate-600 bg-slate-100 text-slate-900 scale-[1.02] shadow-slate-200'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", invoiceCurrency === curr ? "bg-slate-600 animate-pulse" : "bg-slate-300")} />
                      {curr === 'bs' ? 'Bolívares (VES)' : 'Dólares (USD)'}
                    </button>
                  ))}
                </div>
                {invoiceCurrency === 'bs' && (
                  <div className="flex items-start gap-2 text-[11px] p-3 rounded-lg bg-slate-100 dark:bg-slate-800/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800/30">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>
                      {tasaCambio > 0
                        ? `Los precios se convertirán a tasa de ${tasaCambio.toFixed(2)} Bs/$ automáticamente.`
                        : "¡Atención! Sin tasa configurada los precios no se convertirán."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Add product */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Plus className="h-4 w-4 text-slate-500" /> Agregar Producto a la Nota
                  </h3>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700 border-none font-bold">
                    {items.length} {items.length === 1 ? 'Item' : 'Items'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-10 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-slate-400/20 transition-all"
                        placeholder="Buscar producto por nombre o código..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSelectedProductId(''); }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 h-11 px-4 gap-2 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                      onClick={() => setNewProductDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> Nuevo
                    </Button>
                  </div>
                  {searchQuery && filteredProductos.length > 0 && !selectedProductId && (
                    <div className="absolute z-50 w-full mt-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 max-h-56 overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
                      {filteredProductos.slice(0, 10).map(p => (
                        <button
                          key={p.id}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setSearchQuery(p.nombre);
                            setItemCosto(invoiceCurrency === 'bs' && tasaCambio > 0 ? (p.costo_usd * tasaCambio).toFixed(2) : String(p.costo_usd));
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                              {p.nombre.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900 dark:text-slate-100">{p.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{p.codigo}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-600">${p.costo_usd.toFixed(2)}</span>
                            <ChevronRight className="h-3 w-3 inline ml-2 text-slate-300 group-hover:text-slate-600 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <Hash className="h-3 w-3" /> Cantidad
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      value={itemQty}
                      onChange={e => setItemQty(e.target.value)}
                      className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-slate-400/20 text-center font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3" /> Costo ({invoiceCurrency === 'bs' ? 'Bs' : '$'})
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {invoiceCurrency === 'bs' ? 'Bs' : '$'}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={itemCosto}
                        onChange={e => setItemCosto(e.target.value)}
                        className="h-11 pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-slate-400/20 text-right font-bold"
                      />
                    </div>
                  </div>
                </div>
                <Button size="lg" onClick={addItem} className="w-full rounded-xl shadow-md hover:shadow-lg transition-all font-bold gap-2 bg-slate-700 hover:bg-slate-800">
                  <Plus className="h-5 w-5" /> Añadir a la Lista
                </Button>
              </div>

              {/* Items list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 px-1">
                  <Package className="h-3.5 w-3.5" /> Detalle de Items
                </h4>

                {items.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <Trash2 className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-slate-400 italic">No has añadido productos todavía</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                            <th className="text-left p-4 font-bold text-slate-500">Producto</th>
                            <th className="text-center p-4 font-bold text-slate-500 w-20">Cant</th>
                            <th className="text-right p-4 font-bold text-slate-500 w-32">Costo ({invoiceCurrency === 'bs' ? 'Bs' : '$'})</th>
                            <th className="text-right p-4 font-bold text-slate-500 w-32">Subtotal</th>
                            <th className="text-center p-4 font-bold text-slate-500 w-20">IVA</th>
                            <th className="p-4 w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {items.map((item, idx) => (
                            <tr key={item._key} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.nombre}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{item.codigo}</span>
                                  {item.descuento_porcentaje && item.descuento_porcentaje > 0 && (
                                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">Dto: {item.descuento_porcentaje}%</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                {editingItemKey === item._key ? (
                                  <Input
                                    type="number"
                                    className="w-16 h-8 text-center text-xs font-bold rounded-lg"
                                    value={editQty}
                                    onChange={e => setEditQty(e.target.value)}
                                    autoFocus
                                  />
                                ) : (
                                  <Badge variant="outline" className="rounded-md font-bold px-2.5 py-0.5 bg-slate-50 dark:bg-slate-900">
                                    {item.cantidad}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-4 text-right font-medium">
                                {editingItemKey === item._key ? (
                                  <div className="relative">
                                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">{invoiceCurrency === 'bs' ? 'Bs' : '$'}</span>
                                    <Input
                                      type="number"
                                      className="w-24 h-8 text-right text-xs font-bold rounded-lg pl-5"
                                      value={editCost}
                                      onChange={e => setEditCost(e.target.value)}
                                    />
                                  </div>
                                ) : discountItemKey === item._key ? (
                                  <div className="relative flex items-center justify-end">
                                    <Input
                                      type="number"
                                      className="w-16 h-8 text-center text-xs font-bold rounded-lg"
                                      placeholder="0%"
                                      value={discountValue}
                                      onChange={e => setDiscountValue(e.target.value)}
                                      autoFocus
                                      onKeyDown={e => e.key === 'Enter' && applyDiscount()}
                                    />
                                    <span className="ml-1 text-[10px] font-bold text-slate-400">%</span>
                                  </div>
                                ) : (
                                  invoiceCurrency === 'bs' && tasaCambio > 0
                                    ? (item.costo_unitario_usd * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : item.costo_unitario_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                )}
                              </td>
                              <td className="p-4 text-right font-bold text-slate-900 dark:text-white">
                                {invoiceCurrency === 'bs' && tasaCambio > 0
                                  ? `Bs ${(item.subtotal_usd * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                                  : `$ ${item.subtotal_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setItems(prev => prev.map((it, i) => i === idx ? { ...it, aplica_iva: !it.aplica_iva } : it))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-md text-[10px] font-black tracking-tight border transition-all shadow-sm",
                                    item.aplica_iva
                                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent opacity-50'
                                  )}
                                >
                                  {item.aplica_iva ? 'IVA 16%' : 'EXENTO'}
                                </button>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {editingItemKey === item._key ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-600 hover:bg-slate-50 rounded-lg"
                                        onClick={saveEdit}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:bg-slate-50 rounded-lg"
                                        onClick={() => setEditingItemKey(null)}
                                      >
                                        <Plus className="h-4 w-4 rotate-45" />
                                      </Button>
                                    </>
                                  ) : discountItemKey === item._key ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-emerald-500 hover:bg-emerald-50 rounded-lg"
                                        onClick={applyDiscount}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:bg-slate-50 rounded-lg"
                                        onClick={() => setDiscountItemKey(null)}
                                      >
                                        <Plus className="h-4 w-4 rotate-45" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                        onClick={() => startEditing(item)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                        onClick={() => {
                                          setDiscountItemKey(item._key);
                                          setDiscountValue(String(item.descuento_porcentaje || ''));
                                        }}
                                      >
                                        <Percent className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-300 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
                                        onClick={() => {
                                          setItems(prev => prev.filter(i => i._key !== item._key));
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50/50 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-slate-800">
                          <tr>
                            <td colSpan={3} className="p-4 text-right text-slate-500 uppercase text-xs tracking-wider">Subtotal Estimado (+ IVA)</td>
                            <td className="p-4 text-right text-lg text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              {invoiceCurrency === 'bs' && tasaCambio > 0
                                ? `Bs ${(total * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `$ ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-slate-400" /> Ajuste de Precios Administrativos
                  </h3>
                  <p className="text-xs text-slate-500">Ajusta los márgenes de ganancia para tus productos.</p>
                </div>
                <Badge variant="outline" className="h-7 px-3 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  Modo: {invoiceCurrency === 'bs' ? 'Bolívares' : 'Dólares'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {items.map((item, idx) => {
                  const prod = productos.find(p => p.id === item.producto_id);
                  const isBs = invoiceCurrency === 'bs';
                  const tasa = tasaCambio > 0 ? tasaCambio : 1;

                  const costoUnitarioBs = item.costo_unitario_usd * tasa;
                  const precioAnteriorUsd = prod?.precio_venta_usd || 0;
                  const precioAnteriorBs = precioAnteriorUsd * tasa;
                  const itemConPrecio = item as any;
                  const costWithIvaUsd = item.aplica_iva ? item.costo_unitario_usd * 1.16 : item.costo_unitario_usd;

                  const handleMargenChange = (val: string) => {
                    const margen = parseFloat(val) || 0;
                    const factor = (1 - margen / 100);
                    const newPriceUsd = factor > 0 ? costWithIvaUsd / factor : 0;

                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], nuevo_margen: margen, nuevo_precio_usd: newPriceUsd } as any;
                    setItems(newItems);
                  };

                  const handlePrecioUsdChange = (val: string) => {
                    const priceUsd = parseFloat(val) || 0;
                    const margen = priceUsd > 0 ? (1 - (costWithIvaUsd / priceUsd)) * 100 : 0;

                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], nuevo_margen: margen, nuevo_precio_usd: priceUsd } as any;
                    setItems(newItems);
                  };

                  const handlePrecioBsChange = (val: string) => {
                    const priceBs = parseFloat(val) || 0;
                    const priceUsd = tasa > 0 ? priceBs / tasa : priceBs;
                    const margen = priceUsd > 0 ? (1 - (costWithIvaUsd / priceUsd)) * 100 : 0;

                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], nuevo_margen: margen, nuevo_precio_usd: priceUsd } as any;
                    setItems(newItems);
                  };

                  const currentMargen = itemConPrecio.nuevo_margen ?? (
                    prod?.costo_usd && prod?.precio_venta_usd && prod.costo_usd > 0 
                      ? (1 - ((prod.aplica_iva ? prod.costo_usd * 1.16 : prod.costo_usd) / prod.precio_venta_usd)) * 100 
                      : 0
                  );

                  const getPriceFromMargen = (m: number, baseUsd: number, aplicaIva: boolean) => {
                    const cIva = aplicaIva ? baseUsd * 1.16 : baseUsd;
                    const f = (1 - m / 100);
                    return f > 0 ? cIva / f : 0;
                  };

                  const currentPriceUsd = itemConPrecio.nuevo_precio_usd !== undefined 
                    ? itemConPrecio.nuevo_precio_usd 
                    : (itemConPrecio.nuevo_margen !== undefined 
                        ? getPriceFromMargen(itemConPrecio.nuevo_margen, item.costo_unitario_usd, item.aplica_iva) 
                        : precioAnteriorUsd);
                  
                  const currentPriceBs = currentPriceUsd * tasa;

                  return (
                    <div key={item._key} className="relative group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm hover:shadow-md hover:border-slate-400 transition-all duration-300">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.codigo}</span>
                            <Badge variant="secondary" className="text-[9px] h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 border-none">STOCK: {prod?.stock_actual || 0}</Badge>
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white truncate text-base">{item.nombre}</h4>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Costo de Entrada</span>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {isBs ? `${costoUnitarioBs.toFixed(2)} Bs` : `$${item.costo_unitario_usd.toFixed(2)}`}
                              </span>
                            </div>
                            <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Precio Anterior</span>
                              <span className="text-sm font-medium text-slate-500">
                                {isBs ? `${precioAnteriorBs.toFixed(2)} Bs` : `$${precioAnteriorUsd.toFixed(2)}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="space-y-1.5 w-20">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Margen</Label>
                            <div className="relative">
                              <Input
                                type="text"
                                className="h-9 text-center font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg focus:ring-slate-400/20 px-1"
                                value={editValues[`${item._key}-margen`] ?? currentMargen.toFixed(1)}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  setEditValues(prev => ({ ...prev, [`${item._key}-margen`]: val }));
                                  handleMargenChange(val);
                                }}
                                onBlur={() => setEditValues(prev => { const n = { ...prev }; delete n[`${item._key}-margen`]; return n; })}
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">%</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 w-32">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Precio en Bs</Label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Bs</span>
                              <Input
                                type="text"
                                className="h-9 text-right font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg focus:ring-slate-400/20 pr-2 pl-6"
                                value={editValues[`${item._key}-precio-bs`] ?? currentPriceBs.toFixed(2)}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  setEditValues(prev => ({ ...prev, [`${item._key}-precio-bs`]: val }));
                                  handlePrecioBsChange(val);
                                }}
                                onBlur={() => setEditValues(prev => { const n = { ...prev }; delete n[`${item._key}-precio-bs`]; return n; })}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5 w-28">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Ref en $</Label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                              <Input
                                type="text"
                                className="h-9 text-right font-black text-slate-700 bg-white dark:bg-slate-950 border-slate-400/20 dark:border-slate-400/30 rounded-lg focus:ring-slate-400/20 pr-2 pl-5"
                                value={editValues[`${item._key}-precio-usd`] ?? currentPriceUsd.toFixed(2)}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  setEditValues(prev => ({ ...prev, [`${item._key}-precio-usd`]: val }));
                                  handlePrecioUsdChange(val);
                                }}
                                onBlur={() => setEditValues(prev => { const n = { ...prev }; delete n[`${item._key}-precio-usd`]; return n; })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-start gap-4">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-slate-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Control Administrativo Interno</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Este documento no constituye una factura fiscal oficial. Se utilizará exclusivamente para el control de inventario y cuentas por pagar internas.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 space-y-5 shadow-sm">
                <div className="space-y-3">
                  {items.map((i, idx) => (
                    <div key={i._key} className="flex justify-between items-start text-sm group">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {i.cantidad} × {i.nombre}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{i.codigo}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {invoiceCurrency === 'bs' && tasaCambio > 0
                            ? `Bs ${(i.subtotal_usd * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                            : `$${i.subtotal_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        </p>
                        {invoiceCurrency === 'bs' && tasaCambio > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">${i.subtotal_usd.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="bg-slate-100 dark:bg-slate-800" />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">Monto Neto (Base)</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {invoiceCurrency === 'bs' && tasaCambio > 0
                        ? `Bs ${(subtotal * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                        : `$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">I.V.A. Referencial (16%)</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {invoiceCurrency === 'bs' && tasaCambio > 0
                        ? `Bs ${(ivaTotal * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                        : `$${ivaTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  <div className="pt-4 flex justify-between items-end border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Documento</span>
                      <p className="text-xs text-slate-400 font-medium">
                        {invoiceCurrency === 'bs' ? `Tasa: ${tasaCambio.toFixed(2)} Bs/$` : 'Expresado en Dólares'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">
                        {invoiceCurrency === 'bs' && tasaCambio > 0
                          ? `Bs ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                          : `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </span>
                      {invoiceCurrency === 'bs' && (
                        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                          Ref: ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-4">
                <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-500" /> Condición de la Operación
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'contado', label: 'Pagado', desc: 'Cancelado al momento' },
                    { id: 'por_pagar', label: 'Por Pagar', desc: 'Carga a cuenta corriente' },
                    { id: 'credito', label: 'Crédito', desc: 'Acuerdo con proveedor' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTipoPago(opt.id as any)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 gap-1 text-center",
                        tipoPago === opt.id
                          ? 'border-slate-600 bg-slate-50 dark:bg-slate-900 shadow-lg shadow-slate-200/50'
                          : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 opacity-60 hover:opacity-100'
                      )}
                    >
                      <span className={cn("font-bold text-sm", tipoPago === opt.id ? 'text-slate-900 dark:text-white' : 'text-slate-500')}>{opt.label}</span>
                      <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8 rounded-[2.5rem] bg-slate-900 dark:bg-slate-950 text-white space-y-6 relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-slate-800 rounded-full blur-3xl opacity-20 -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
                <Package className="absolute -bottom-10 -right-10 w-40 h-40 opacity-5 -rotate-12 group-hover:rotate-0 transition-all duration-700" />

                <div className="flex justify-between items-center relative z-10">
                  <div className="space-y-1">
                    <span className="text-slate-400 uppercase text-[10px] font-black tracking-widest">Total a Cargar</span>
                    <p className="text-slate-500 text-xs font-medium">I.V.A Incluido Referencial</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black tracking-tighter">${total.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Dólares Americanos</p>
                  </div>
                </div>

                <Separator className="bg-white/10" />

                <div className="flex items-center gap-3 relative z-10 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mb-0.5">Aviso Importante</p>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      Documento para control interno. No constituye factura fiscal oficial según Providencia 00071 del SENIAT.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {step < STEPS.length && (
          <DialogFooter className="p-6 bg-white dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(s => s - 1) : onOpenChange(false)}
              className="h-12 px-6 rounded-2xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Regresar
            </Button>
            <Button
              onClick={() => step === 0 ? handleNextStepZero() : (step === STEPS.length - 1 ? handleSave() : setStep(s => s + 1))}
              disabled={isSaving || isCheckingDuplicate || (step === 1 && items.length === 0) || (step === 0 && (!selectedProveedor || !numeroOrden.trim()))}
              className="h-12 px-10 rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold shadow-xl shadow-slate-200 dark:shadow-none transition-all duration-300 gap-2 min-w-[160px]"
            >
              {isSaving || isCheckingDuplicate ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  {step === STEPS.length - 1 ? 'Confirmar Entrada' : 'Continuar'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </DialogFooter>
        )}

        {step === STEPS.length && successData && (
          <div className="p-10 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500 bg-white dark:bg-slate-950 h-full justify-center">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-inner relative">
              <div className="absolute inset-0 bg-slate-400 rounded-[2.5rem] blur-xl opacity-20 animate-pulse" />
              <CheckCircle2 className="w-12 h-12 text-slate-600 relative z-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">¡Registro Exitoso!</h2>
              <p className="text-slate-500 text-sm font-medium max-w-xs mx-auto">
                La nota de entrega se ha procesado correctamente. El inventario y los costos han sido actualizados.
              </p>
            </div>
            
            <div className="flex flex-col items-center w-full max-w-sm gap-6 pt-2">
              <div className="w-full">
                <div className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 max-w-[220px] mx-auto">
                  <div className="p-4 flex flex-col items-center gap-3">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-slate-100 transition-colors">
                      <Printer className="w-5 h-5 text-slate-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Resumen Nota</span>
                    <div className="flex w-full gap-1 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                      <Button variant="ghost" size="sm" className="flex-1 h-9 gap-2 rounded-lg" onClick={handlePrint}>
                        <Printer className="w-3.5 h-3.5" /> <span className="text-[10px] font-bold uppercase">Imprimir</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="w-9 h-9 rounded-lg" onClick={handleDownload}>
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button
                  onClick={() => { onSaved(); onOpenChange(false); }}
                  className="w-full h-14 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold shadow-xl shadow-slate-200/50 dark:shadow-none transition-all active:scale-[0.98] text-base"
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <Dialog open={!!duplicateNote} onOpenChange={(o) => !o && setDuplicateNote(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center shadow-inner animate-pulse">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Nota Duplicada</DialogTitle>
              <p className="text-sm text-slate-500 leading-relaxed">
                Detectamos que este n° de nota ya fue registrado previamente para este proveedor.
              </p>
            </div>

            {duplicateNote && (
              <div className="relative group overflow-hidden bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-left transition-all">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                  <Package className="w-12 h-12" />
                </div>
                <div className="space-y-2 text-sm font-medium">
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400">N° Documento</span>
                    <span className="text-slate-900 dark:text-white font-bold font-mono">{duplicateNote.numero_factura}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400">Proveedor</span>
                    <span className="text-slate-900 dark:text-white font-bold">{duplicateNote.proveedor_nombre}</span>
                  </div>
                  {duplicateNote.total_usd && (
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Monto Total</span>
                      <span className="text-slate-900 dark:text-white font-black">${duplicateNote.total_usd.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setDuplicateNote(null)}
                className="h-12 rounded-2xl font-bold border-slate-200 dark:border-slate-800"
              >
                Volver a corregir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProductFormDialog
        open={newProductDialogOpen}
        onOpenChange={setNewProductDialogOpen}
        onSaved={reloadProductos}
      />

      <SupplierFormDialog
        open={newSupplierDialogOpen}
        onOpenChange={setNewSupplierDialogOpen}
        onSaved={async () => {
          if (!concesionario?.id) return;
          const snap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'proveedores'), orderBy('created_at', 'desc')));
          setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Proveedor)));
        }}
      />

      <DeliveryNotePrint data={successData} concesionario={concesionario} id={printRootId} />
    </Dialog>
  );
}
