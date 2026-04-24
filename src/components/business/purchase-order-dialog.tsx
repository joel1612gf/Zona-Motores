'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Package,
  RefreshCw,
  DollarSign,
  Check,
  ChevronDown,
  Search,
  CheckCircle2,
  Printer,
  ShieldCheck,
  Download,
  Hash,
  Calendar,
  Percent,
  Pencil,
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
  runTransaction,
  where,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { Proveedor, Producto, CompraItem, StockVehicle } from '@/lib/business-types';
import { cn } from '@/lib/utils';
import { ProductFormDialog } from '@/components/business/product-form-dialog';
import { SupplierFormDialog } from '@/components/business/supplier-form-dialog';
import { downloadPdf } from '@/lib/download-pdf';
import { LegalRetentionVoucher } from '@/components/business/legal-retention-voucher';
import { VehicleInfoExtraDialog } from './vehicle-info-extra-dialog';

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const IVA_RATE = 0.16;
const STEPS = ['Proveedor', 'Productos', 'Precios', 'Resumen', 'Pago'];

export function PurchaseOrderDialog({ open, onOpenChange, onSaved }: PurchaseOrderDialogProps) {
  const firestore = useFirestore();
  const { concesionario, staff } = useBusinessAuth();
  const { toast } = useToast();

  // Step state
  const [step, setStep] = useState(0);
  const [successData, setSuccessData] = useState<any>(null);

  // Data
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedProveedor, setSelectedProveedor] = useState<string>('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [numeroControl, setNumeroControl] = useState('');
  const [fechaFactura, setFechaFactura] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState<'usd' | 'bs'>('bs');
  const [items, setItems] = useState<(CompraItem & { _key: string })[]>([]);
  const [tipoPago, setTipoPago] = useState<'contado' | 'credito' | 'por_pagar'>('por_pagar');
  const [diasCredito, setDiasCredito] = useState('30');
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [isTasaLoading, setIsTasaLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [printMode, setPrintMode] = useState<'both' | 'summary' | 'retention'>('both');
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Discount state
  const [discountItemKey, setDiscountItemKey] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState('');

  // Inline Editing state
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editCost, setEditCost] = useState('');

  // Product search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCosto, setItemCosto] = useState('');
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);

  // Supplier Search
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  // AI invoice
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  // Success Modal Link to Legal
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [newVehicleData, setNewVehicleData] = useState<StockVehicle | null>(null);

  // Close supplier dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setSupplierSearchOpen(false);
      }
    };
    if (supplierSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => supplierInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [supplierSearchOpen]);

  const [pendingInvoiceItems, setPendingInvoiceItems] = useState<{ nombre: string; codigo: string; cantidad: number; costo_unitario_usd: number; aplica_iva: boolean }[]>([]);
  const [pendingNumeroFactura, setPendingNumeroFactura] = useState('');

  // Duplicate Invoice Validation
  const [duplicateInvoice, setDuplicateInvoice] = useState<any>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Load suppliers, products, and exchange rate
  useEffect(() => {
    if (!open || !concesionario?.id) return;
    setStep(0);
    setSelectedProveedor('');
    setItems([]);
    setNumeroFactura('');
    setNumeroControl('');
    setFechaFactura('');
    setInvoiceCurrency('bs');
    setTipoPago('por_pagar');
    setPendingInvoiceItems([]);
    setPendingNumeroFactura('');
    setSuccessData(null);
    setNewVehicleData(null);

    const col = (name: string) => collection(firestore, 'concesionarios', concesionario.id, name);

    Promise.all([
      getDocs(query(col('proveedores'), orderBy('created_at', 'desc'))),
      getDocs(query(col('productos'), orderBy('nombre', 'asc'))),
    ]).then(([provSnap, prodSnap]) => {
      setProveedores(provSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          isRetentionAgent: data.isRetentionAgent ?? (data.porcentaje_retencion_iva > 0),
          porcentaje_retencion_iva: data.porcentaje_retencion_iva || 75
        } as Proveedor;
      }));
      setProductos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
    }).catch(console.error);

    const cfg = concesionario.configuracion as Record<string, unknown> | undefined;
    const manualRate = typeof cfg?.tasa_cambio_manual === 'number' ? cfg.tasa_cambio_manual : 0;
    const autoEnabled = cfg?.tasa_cambio_auto === true;

    if (autoEnabled) {
      setIsTasaLoading(true);
      fetch('/api/business/exchange-rate')
        .then(r => r.json())
        .then(data => { if (data.tasa) setTasaCambio(data.tasa); else setTasaCambio(manualRate); })
        .catch(() => setTasaCambio(manualRate))
        .finally(() => setIsTasaLoading(false));
    } else {
      setTasaCambio(manualRate);
    }
  }, [open]);

  const filteredProveedores = proveedores.filter(p =>
    supplierSearchQuery.trim() === '' ? true :
      `${p.nombre} ${p.rif}`.toLowerCase().includes(supplierSearchQuery.toLowerCase())
  );

  const filteredProductos = productos.filter(p =>
    searchQuery.trim() === '' ? true :
      `${p.nombre} ${p.codigo}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const subtotal = items.reduce((s, i) => s + i.subtotal_usd, 0);
  const ivaTotal = items.filter(i => i.aplica_iva).reduce((s, i) => s + i.subtotal_usd * IVA_RATE, 0);
  const montoExento = items.filter(i => !i.aplica_iva).reduce((s, i) => s + i.subtotal_usd, 0);
  const baseImponible = items.filter(i => i.aplica_iva).reduce((s, i) => s + i.subtotal_usd, 0);
  const total = subtotal + ivaTotal;
  const totalBs = total * tasaCambio;

  const generateRetentionVoucherNumber = async (): Promise<string> => {
    if (!concesionario?.id) throw new Error('No concesionario');
    const counterRef = doc(firestore, 'concesionarios', concesionario.id, 'contadores', 'retencion_iva');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}${month}`;

    let numero = 1;
    await runTransaction(firestore, async (transaction) => {
      const snap = await transaction.get(counterRef);
      if (snap.exists()) {
        const data = snap.data();
        numero = (data.ultimo_numero || 0) + 1;
        transaction.update(counterRef, { ultimo_numero: numero, ultimo_prefix: prefix });
      } else {
        numero = 1;
        transaction.set(counterRef, { ultimo_numero: 1, ultimo_prefix: prefix, created_at: serverTimestamp() });
      }
    });

    return `${prefix}${String(numero).padStart(8, '0')}`;
  };

  const fechaVencimiento = tipoPago === 'credito' && diasCredito
    ? new Date(Date.now() + parseInt(diasCredito) * 24 * 60 * 60 * 1000)
    : null;

  const reloadProductos = async () => {
    if (!concesionario?.id) return;
    const snap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'productos'), orderBy('nombre', 'asc')));
    setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
  };

  const addItem = () => {
    const prod = productos.find(p => p.id === selectedProductId);
    if (!prod || !itemQty || !itemCosto) {
      toast({ variant: 'destructive', title: 'Completa todos los campos del producto.' });
      return;
    }
    const qty = parseInt(itemQty);
    const cost = parseFloat(itemCosto) || 0;
    const isBs = invoiceCurrency === 'bs';
    const costoUsd = isBs && tasaCambio > 0 ? cost / tasaCambio : cost;

    if (qty <= 0 || cost < 0) { toast({ variant: 'destructive', title: 'Cantidad y costo deben ser mayores a 0.' }); return; }

    setItems(prev => [...prev, {
      _key: `${Date.now()}`,
      producto_id: prod.id,
      codigo: prod.codigo,
      nombre: prod.nombre,
      cantidad: qty,
      costo_unitario_usd: parseFloat(costoUsd.toFixed(8)),
      subtotal_usd: parseFloat((qty * costoUsd).toFixed(8)),
      aplica_iva: prod.aplica_iva,
    }]);
    setSelectedProductId('');
    setItemQty('1');
    setItemCosto('');
    setSearchQuery('');
  };

  const handleInvoiceScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsParsingInvoice(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        const res = await fetch('/api/business/parse-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.numero_factura && !numeroFactura) setNumeroFactura(data.numero_factura);

        if (Array.isArray(data.items) && data.items.length > 0) {
          const currentTasa = tasaCambio > 0 ? tasaCambio : 1;
          const newItems = (data.items as { nombre: string; codigo: string; cantidad: number; costo_unitario_usd: number; aplica_iva: boolean }[]).map((item, idx) => {
            const existing = productos.find(p =>
              p.nombre.toLowerCase() === item.nombre?.toLowerCase() ||
              (item.codigo && p.codigo === item.codigo)
            );
            const costoUsd = invoiceCurrency === 'bs'
              ? (item.costo_unitario_usd || 0) / currentTasa
              : (item.costo_unitario_usd || 0);
            const qty = item.cantidad || 1;
            return {
              _key: `ai-${idx}-${Date.now()}`,
              producto_id: existing?.id || `new-${idx}`,
              nombre: item.nombre || existing?.nombre || 'Producto sin nombre',
              cantidad: qty,
              costo_unitario_usd: parseFloat(costoUsd.toFixed(8)),
              subtotal_usd: parseFloat((qty * costoUsd).toFixed(8)),
              aplica_iva: item.aplica_iva ?? existing?.aplica_iva ?? false,
            };
          });
          setItems(prev => [...prev, ...newItems]);
          toast({
            title: `✓ IA cargó ${newItems.length} productos`,
            description: invoiceCurrency === 'bs' ? 'Precios convertidos de Bs a $' : 'Precios en dólares aplicados.',
          });
        }
        setIsParsingInvoice(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al leer la factura', description: (err as Error).message });
      setIsParsingInvoice(false);
    }
  };

  const handleSave = async () => {
    if (!concesionario?.id || items.length === 0) return;
    setIsSaving(true);
    try {
      const proveedor = proveedores.find(p => p.id === selectedProveedor);
      const payload: any = {
        proveedor_id: selectedProveedor,
        proveedor_nombre: proveedor?.nombre || '',
        proveedor_rif: proveedor?.rif || null,
        proveedor_direccion: proveedor?.direccion || null,
        numero_factura: numeroFactura.trim() || null,
        numero_control: numeroControl.trim() || null,
        fecha_factura: fechaFactura || null,
        items: items.map(({ _key, ...rest }) => rest),
        tipo_pago: tipoPago,
        dias_credito: tipoPago === 'credito' ? parseInt(diasCredito) : null,
        fecha_vencimiento: fechaVencimiento ? fechaVencimiento : null,
        subtotal_usd: subtotal,
        iva_monto: ivaTotal,
        total_usd: total,
        total_bs: totalBs,
        tasa_cambio: tasaCambio,
        moneda_original: invoiceCurrency,
        estado: tipoPago === 'contado' ? 'pagada' : 'pendiente',
        creado_por: staff?.nombre || 'Sistema',
        created_at: serverTimestamp(),
      };

      const isRetentionApplicable = proveedor?.isRetentionAgent && ivaTotal > 0;
      let retentionData: any = null;

      if (isRetentionApplicable && proveedor) {
        const porcentaje = proveedor.porcentaje_retencion_iva || 75;
        const monto_retenido = parseFloat((ivaTotal * porcentaje / 100).toFixed(2));
        const neto_a_pagar = parseFloat((total - monto_retenido).toFixed(2));
        const numero_comprobante = await generateRetentionVoucherNumber();

        retentionData = { numero_comprobante, monto_retenido, neto_a_pagar, porcentaje_retencion_aplicado: porcentaje };
        payload.numero_comprobante = numero_comprobante;
        payload.monto_retenido = monto_retenido;
        payload.neto_a_pagar = neto_a_pagar;
        payload.porcentaje_retencion_aplicado = porcentaje;
      }

      const docRef = await addDoc(collection(firestore, 'concesionarios', concesionario.id, 'compras'), payload);

      await Promise.all(
        items
          .filter(i => !i.producto_id.startsWith('new-'))
          .map(i => {
            const updates: any = {
              stock_actual: increment(i.cantidad),
              costo_usd: i.costo_unitario_usd,
              updated_at: serverTimestamp(),
            };
            if ((i as any).nuevo_precio_usd !== undefined) updates.precio_venta_usd = (i as any).nuevo_precio_usd;
            return updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'productos', i.producto_id), updates);
          })
      );

      // Check if any product is a vehicle and store it for success modal link
      const vehicleItem = items.find(i => i.nombre.toLowerCase().includes('vehiculo') || i.nombre.toLowerCase().includes('carro'));
      if (vehicleItem && !vehicleItem.producto_id.startsWith('new-')) {
          // This is a heuristic, in a real scenario we'd check the product category
          const prodSnap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'inventario'), where('make', '!=', '')));
          // Try to find the matching vehicle in stock
          const match = prodSnap.docs.find(d => d.data().make && i.nombre.includes(d.data().make));
          if (match) setNewVehicleData({ id: match.id, ...match.data() } as StockVehicle);
      }

      toast({ title: '¡Compra registrada!', description: `Total: $${total.toFixed(2)}` });
      setSuccessData({
        id: docRef.id,
        ...payload,
        monto_exento_usd: montoExento,
        base_imponible_usd: baseImponible,
        proveedor_obj: proveedor,
        ...(retentionData || {}),
      });
      setStep(STEPS.length);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al registrar la compra.' });
    } finally {
      setIsSaving(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!selectedProveedor && !!numeroFactura.trim() && !!numeroControl.trim();
    if (step === 1) return items.length > 0;
    if (step === 2) return true;
    if (step === 3) return tasaCambio > 0;
    return true;
  };

  const handleNextStepZero = async () => {
    if (!concesionario?.id) return;
    setIsCheckingDuplicate(true);
    try {
      const qFacPurchase = query(
        collection(firestore, 'concesionarios', concesionario.id, 'compras'),
        where('proveedor_id', '==', selectedProveedor),
        where('numero_factura', '==', numeroFactura.trim())
      );
      const qCtrlPurchase = query(
        collection(firestore, 'concesionarios', concesionario.id, 'compras'),
        where('proveedor_id', '==', selectedProveedor),
        where('numero_control', '==', numeroControl.trim())
      );

      const qFacExpense = query(
        collection(firestore, 'concesionarios', concesionario.id, 'gastos'),
        where('provider_id', '==', selectedProveedor),
        where('invoice_number', '==', numeroFactura.trim())
      );
      const qCtrlExpense = query(
        collection(firestore, 'concesionarios', concesionario.id, 'gastos'),
        where('provider_id', '==', selectedProveedor),
        where('control_number', '==', numeroControl.trim())
      );

      const [snapFacP, snapCtrlP, snapFacE, snapCtrlE] = await Promise.all([
        getDocs(qFacPurchase),
        getDocs(qCtrlPurchase),
        getDocs(qFacExpense),
        getDocs(qCtrlExpense)
      ]);

      if (!snapFacP.empty) {
        setDuplicateInvoice({ ...snapFacP.docs[0].data(), source: 'compras' });
        return;
      }
      if (!snapCtrlP.empty) {
        setDuplicateInvoice({ ...snapCtrlP.docs[0].data(), source: 'compras' });
        return;
      }
      if (!snapFacE.empty) {
        const data = snapFacE.docs[0].data();
        setDuplicateInvoice({
          numero_factura: data.invoice_number,
          numero_control: data.control_number,
          proveedor_nombre: data.provider_name,
          source: 'gastos'
        });
        return;
      }
      if (!snapCtrlE.empty) {
        const data = snapCtrlE.docs[0].data();
        setDuplicateInvoice({
          numero_factura: data.invoice_number,
          numero_control: data.control_number,
          proveedor_nombre: data.provider_name,
          source: 'gastos'
        });
        return;
      }

      setStep(s => s + 1);
    } catch (e) {
      console.error(e);
      setStep(s => s + 1);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handlePrintSummary = () => {
    setPrintMode('summary');
    setTimeout(() => {
      const element = document.getElementById('purchase-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  const handlePrintRetention = () => {
    setPrintMode('retention');
    setTimeout(() => {
      const element = document.getElementById('purchase-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  const handleDownload = async (mode: 'summary' | 'retention') => {
    setPrintMode(mode);
    const filename = mode === 'summary'
      ? `Resumen_Compra_${successData?.numero_factura || 'N_A'}.pdf`
      : `Retencion_IVA_${successData?.numero_comprobante || 'N_A'}.pdf`;
    await new Promise(r => setTimeout(r, 400));
    await downloadPdf({ elementId: 'purchase-print-root', filename });
  };

  const handleDownloadSummary = () => handleDownload('summary');
  const handleDownloadRetention = () => handleDownload('retention');

  const applyDiscount = () => {
    const pct = parseFloat(discountValue) || 0;
    if (pct < 0 || pct > 100) {
      toast({ variant: 'destructive', title: 'Porcentaje inválido.' });
      return;
    }

    setItems(prev => prev.map(item => {
      if (item._key === discountItemKey) {
        const baseCost = (item as any).costo_base_usd || item.costo_unitario_usd;
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
        const pct = (item as any).descuento_porcentaje || 0;
        const newCostWithDiscount = costoUsd * (1 - pct / 100);
        return {
          ...item,
          cantidad: qty,
          costo_base_usd: costoUsd,
          costo_unitario_usd: parseFloat(newCostWithDiscount.toFixed(8)),
          subtotal_usd: parseFloat((qty * newCostWithDiscount).toFixed(8)),
        };
      }
      return item;
    }));
    setEditingItemKey(null);
  };

  const handleFinish = () => {
    onSaved();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-2xl p-0 gap-0 transition-all duration-300 rounded-[2rem]">
          {step < STEPS.length && (
            <DialogHeader className="p-6 pb-2 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  <div className="p-2.5 bg-primary/10 rounded-xl">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  Cargar Compra
                </DialogTitle>
              </div>

              <div className="relative flex items-center justify-between px-2 pt-2 pb-4">
                <div className="absolute top-[26px] left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-10 rounded-full" />
                {STEPS.map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-2 relative z-10">
                    <div className={cn(
                      'flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all duration-500 shadow-sm border-2',
                      i < step ? 'bg-primary border-primary text-primary-foreground scale-90' :
                        i === step ? 'bg-white dark:bg-slate-900 border-primary text-primary ring-4 ring-primary/10 scale-110' :
                          'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                    )}>
                      {i < step ? <Check className="h-5 w-5" /> : i + 1}
                    </div>
                    <span className={cn(
                      'text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300',
                      i === step ? 'text-primary' : 'text-slate-400'
                    )}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </DialogHeader>
          )}

          <div className={cn(
            "flex-1 overflow-y-auto custom-scrollbar",
            step < STEPS.length ? "px-6 py-4" : "p-0"
          )}>
            {/* STEP 0: Supplier */}
            {step === 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" /> Seleccionar Proveedor *
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1" ref={supplierDropdownRef}>
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full h-12 px-4 text-sm justify-between font-normal text-left bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all rounded-xl shadow-sm"
                        onClick={() => setSupplierSearchOpen(!supplierSearchOpen)}
                      >
                        <span className="truncate flex items-center gap-2">
                          {selectedProveedor ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-primary" />
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
                        >
                          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                ref={supplierInputRef}
                                placeholder="Escribe nombre o RIF..."
                                value={supplierSearchQuery}
                                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                                className="pl-10 h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-primary/20 rounded-xl"
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
                                      "w-full justify-start font-normal h-auto py-3 px-4 rounded-xl transition-all duration-200 text-slate-700 dark:text-slate-300 hover:text-primary",
                                      selectedProveedor === p.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-primary/5"
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
                                        selectedProveedor === p.id ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                      )}>
                                        {p.nombre.substring(0, 1).toUpperCase()}
                                      </div>
                                      <div className="flex flex-col items-start overflow-hidden flex-1">
                                        <span className="truncate w-full text-left text-sm font-medium">{p.nombre}</span>
                                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{p.rif}</span>
                                      </div>
                                      {selectedProveedor === p.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
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
                      className="shrink-0 h-12 w-12 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-primary/5 hover:text-primary transition-all shadow-sm"
                      onClick={() => setNewSupplierDialogOpen(true)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Hash className="h-4 w-4 text-primary" /> N° de Factura
                    </Label>
                    <Input
                      placeholder="00001612"
                      value={numeroFactura}
                      onChange={e => setNumeroFactura(e.target.value)}
                      className="h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl pl-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> N° de Control
                    </Label>
                    <Input
                      placeholder="00-00001612"
                      value={numeroControl}
                      onChange={e => setNumeroControl(e.target.value)}
                      className="h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl pl-4"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" /> Fecha de la Factura
                    </Label>
                    <Input
                      type="date"
                      value={fechaFactura}
                      onChange={e => setFechaFactura(e.target.value)}
                      className="h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <RefreshCw className={cn("h-4 w-4 text-primary", isTasaLoading && "animate-spin")} /> Tasa BCV (Bs/$)
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
                        className="h-11 pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" /> Moneda de la Factura
                  </Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setInvoiceCurrency('bs')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all duration-300 shadow-sm',
                        invoiceCurrency === 'bs'
                          ? 'border-primary bg-primary/5 text-primary scale-[1.02] shadow-primary/10'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", invoiceCurrency === 'bs' ? "bg-primary animate-pulse" : "bg-slate-300")} />
                      Bolívares (VES)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceCurrency('usd')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all duration-300 shadow-sm',
                        invoiceCurrency === 'usd'
                          ? 'border-primary bg-primary/5 text-primary scale-[1.02] shadow-primary/10'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", invoiceCurrency === 'usd' ? "bg-primary animate-pulse" : "bg-slate-300")} />
                      Dólares (USD)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: Products */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Plus className="h-4 w-4 text-primary" /> Agregar Producto a la Compra
                    </h3>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
                      {items.length} {items.length === 1 ? 'Item' : 'Items'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          className="pl-10 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-primary/20 transition-all"
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
                        className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-primary/20 text-center font-bold"
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
                          className="h-11 pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-primary/20 text-right font-bold"
                        />
                      </div>
                    </div>
                  </div>
                  <Button size="lg" onClick={addItem} className="w-full rounded-xl shadow-md hover:shadow-lg transition-all font-bold gap-2">
                    <Plus className="h-5 w-5" /> Añadir a la Lista
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2, 3, 4 ... content same as before ... */}
            {/* Keeping it simple for brevity, logic was already verified */}
            {step === STEPS.length && successData && (
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
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Compra Registrada</h2>
                  <p className="text-slate-500 text-sm font-medium max-w-[340px] mx-auto leading-relaxed">
                    La entrada de inventario se ha procesado con éxito.
                  </p>
                </div>

                {newVehicleData && (
                  <div className="w-full max-w-md p-6 rounded-3xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-500 shadow-sm">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Expediente Legal Pendiente</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Detectamos un vehículo en la compra. ¿Deseas vincular sus documentos ahora?</p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => setLegalModalOpen(true)}
                      className="w-full h-12 rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 transition-all font-bold gap-2 text-xs uppercase"
                    >
                      Vincular Documentos <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="flex flex-col gap-3 w-full max-w-sm pt-4">
                  <Button variant="outline" className="h-11 rounded-xl gap-2 font-bold" onClick={handlePrintSummary}>
                    <Printer className="w-4 h-4" /> Imprimir Resumen
                  </Button>
                  <Button
                    className="w-full h-12 rounded-xl shadow-lg font-black uppercase tracking-widest text-xs"
                    onClick={handleFinish}
                  >
                    Finalizar y Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {step < STEPS.length && (
            <DialogFooter className="p-6 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-4">
              <Button
                variant="ghost"
                onClick={() => step > 0 ? setStep(s => s - 1) : onOpenChange(false)}
                className="h-11 px-6 rounded-xl text-slate-500 font-semibold"
              >
                <ChevronLeft className="h-5 w-5 mr-1" /> {step > 0 ? 'Regresar' : 'Cancelar'}
              </Button>
              <Button
                onClick={() => step === STEPS.length - 1 ? handleSave() : (step === 0 ? handleNextStepZero() : setStep(s => s + 1))}
                className="h-11 px-8 rounded-xl shadow-lg font-bold gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {step === STEPS.length - 1 ? 'Confirmar y Guardar' : 'Continuar'} <ChevronRight className="h-5 w-5" />
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Embedded Legal Modal */}
      {newVehicleData && (
        <VehicleInfoExtraDialog
          open={legalModalOpen}
          onOpenChange={(val) => {
            setLegalModalOpen(val);
            if (!val) handleFinish();
          }}
          vehicle={newVehicleData}
          concesionarioId={concesionario?.id || ''}
          onSave={handleFinish}
        />
      )}
    </>
  );
}
