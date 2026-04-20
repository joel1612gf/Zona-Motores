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
import type { Proveedor, Producto, CompraItem } from '@/lib/business-types';
import { cn } from '@/lib/utils';
import { ProductFormDialog } from '@/components/business/product-form-dialog';
import { SupplierFormDialog } from '@/components/business/supplier-form-dialog';
import { downloadPdf } from '@/lib/download-pdf';
import { LegalRetentionVoucher } from '@/components/business/legal-retention-voucher';

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
  // (no more currency-prompt modals — user picks currency before scanning)
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  // Close supplier dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setSupplierSearchOpen(false);
      }
    };
    if (supplierSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Delayed focus to avoid focus-trap conflicts
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

    // Load tasa from settings
    const cfg = concesionario.configuracion as Record<string, unknown> | undefined;
    const manualRate = typeof cfg?.tasa_cambio_manual === 'number' ? cfg.tasa_cambio_manual : 0;
    const autoEnabled = cfg?.tasa_cambio_auto === true;

    if (autoEnabled) {
      // Try BCV fetch but fall back to manual
      setIsTasaLoading(true);
      fetch('/api/business/exchange-rate')
        .then(r => r.json())
        .then(data => { if (data.tasa) setTasaCambio(data.tasa); else setTasaCambio(manualRate); })
        .catch(() => setTasaCambio(manualRate))
        .finally(() => setIsTasaLoading(false));
    } else {
      setTasaCambio(manualRate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Filtered suppliers for search
  const filteredProveedores = proveedores.filter(p =>
    supplierSearchQuery.trim() === '' ? true :
      `${p.nombre} ${p.rif}`.toLowerCase().includes(supplierSearchQuery.toLowerCase())
  );

  // Filtered products for search
  const filteredProductos = productos.filter(p =>
    searchQuery.trim() === '' ? true :
      `${p.nombre} ${p.codigo}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Computed totals
  const subtotal = items.reduce((s, i) => s + i.subtotal_usd, 0);
  const ivaTotal = items.filter(i => i.aplica_iva).reduce((s, i) => s + i.subtotal_usd * IVA_RATE, 0);
  const montoExento = items.filter(i => !i.aplica_iva).reduce((s, i) => s + i.subtotal_usd, 0);
  const baseImponible = items.filter(i => i.aplica_iva).reduce((s, i) => s + i.subtotal_usd, 0);
  const total = subtotal + ivaTotal;
  const totalBs = total * tasaCambio;

  // Generate legal retention voucher number: YYYYMM + 8-digit sequential
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

  // Helper: reload productos list (used after inline create)
  const reloadProductos = async () => {
    if (!concesionario?.id) return;
    const snap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'productos'), orderBy('nombre', 'asc')));
    setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
  };

  // Add product item
  const addItem = () => {
    const prod = productos.find(p => p.id === selectedProductId);
    if (!prod || !itemQty || !itemCosto) {
      toast({ variant: 'destructive', title: 'Completa todos los campos del producto.' });
      return;
    }
    const qty = parseInt(itemQty);
    const cost = parseFloat(itemCosto) || 0;
    const isBs = invoiceCurrency === 'bs';
    // If input is in Bs, convert it to USD. If input is direct in USD, use it directly.
    // Notice that itemCosto was initialized as String((p.costo_usd * tasa).toFixed(2)) when selecting, or just p.costo_usd
    // So the typed cost is interpreted as Bs if invoiceCurrency === 'bs'.
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

  // Handle AI invoice scan — currency already chosen via invoiceCurrency state
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

        // Apply items using already-selected currency
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

  // (applyInvoiceItems is no longer needed — currency is chosen before scan)

  // Save purchase
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

      // Check if retention applies
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

      // Update stock and prices for each product
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

      toast({ title: '¡Compra registrada!', description: `Total: $${total.toFixed(2)}` });
      setSuccessData({
        id: docRef.id,
        ...payload,
        // computed values for PDF
        monto_exento_usd: montoExento,
        base_imponible_usd: baseImponible,
        proveedor_obj: proveedor,
        ...(retentionData || {}),
      });
      setStep(STEPS.length); // Trigger success step
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
    if (step === 2) return true; // Precios: user can modify or skip
    if (step === 3) return tasaCambio > 0; // Resumen: need tasa
    return true;
  };

  const handleNextStepZero = async () => {
    if (!concesionario?.id) return;
    setIsCheckingDuplicate(true);
    try {
      // Check in 'compras'
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

      // Check in 'gastos' (LEGALLY a provider cannot repeat invoice numbers even for different services/products)
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

  // Helpers to set print mode and print
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

    // Wait for React to commit the portal with new printMode
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
        // Recuperamos el costo base (antes de cualquier descuento previo)
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
        // Al editar manualmente, el nuevo costo se convierte en el nuevo 'costo_base'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-2xl p-0 gap-0 transition-all duration-300 rounded-[2rem]">
        {step < STEPS.length && (
          <DialogHeader className="p-6 pb-2 space-y-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                Cargar Compra
              </DialogTitle>
            </div>

            {/* Step indicator */}
            <div className="relative flex items-center justify-between px-2 pt-2">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-10 rounded-full" />
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
                  <div className="relative group">
                    <Input
                      placeholder="00001612"
                      value={numeroFactura}
                      onChange={e => setNumeroFactura(e.target.value)}
                      className="h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl pl-4"
                    />
                  </div>
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

              {/* Currency selector */}
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
                    Bs Bolívares (VES)
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
                    $ Dólares (USD)
                  </button>
                </div>
                {invoiceCurrency === 'bs' && (
                  <div className="flex items-start gap-2 text-[11px] p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
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

          {/* STEP 1: Products */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Add product */}
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
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:bg-primary group-hover:text-white transition-colors">
                              {p.nombre.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900 dark:text-slate-100">{p.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{p.codigo}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-primary">${p.costo_usd.toFixed(2)}</span>
                            <ChevronRight className="h-3 w-3 inline ml-2 text-slate-300 group-hover:text-primary transition-colors" />
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
                                      ? 'bg-primary/10 text-primary border-primary/30'
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
                                        className="h-8 w-8 text-blue-500 hover:bg-blue-50 rounded-lg"
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
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                        onClick={() => startEditing(item)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        onClick={() => {
                                          setDiscountItemKey(item._key);
                                          setDiscountValue(String((item as any).descuento_porcentaje || ''));
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
                            <td className="p-4 text-right text-lg text-primary whitespace-nowrap">
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

          {/* STEP 2: Precios */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" /> Definir Precios de Venta
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

                  const currentMargen = itemConPrecio.nuevo_margen ?? (prod?.costo_usd && prod?.precio_venta_usd && prod.costo_usd > 0 ? (1 - ((prod.aplica_iva ? prod.costo_usd * 1.16 : prod.costo_usd) / prod.precio_venta_usd)) * 100 : 0);

                  const getPriceFromMargen = (m: number, baseUsd: number, aplicaIva: boolean) => {
                    const cIva = aplicaIva ? baseUsd * 1.16 : baseUsd;
                    const f = (1 - m / 100);
                    return f > 0 ? cIva / f : 0;
                  };

                  const currentPriceUsd = itemConPrecio.nuevo_precio_usd !== undefined ? itemConPrecio.nuevo_precio_usd : (itemConPrecio.nuevo_margen !== undefined ? getPriceFromMargen(itemConPrecio.nuevo_margen, item.costo_unitario_usd, item.aplica_iva) : precioAnteriorUsd);
                  const currentPriceBs = currentPriceUsd * tasa;

                  return (
                    <div key={item._key} className="relative group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">{item.codigo}</span>
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
                                className="h-9 text-center font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg focus:ring-primary/20 px-1"
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
                                className="h-9 text-right font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg focus:ring-primary/20 pr-2 pl-6"
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
                            <Label className="text-[10px] font-bold text-slate-500 uppercase text-primary">Ref en $</Label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/60">$</span>
                              <Input
                                type="text"
                                className="h-9 text-right font-black text-primary bg-white dark:bg-slate-950 border-primary/20 dark:border-primary/30 rounded-lg focus:ring-primary/20 pr-2 pl-5"
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

          {/* STEP 3: Summary */}
          {step === 3 && (() => {
            const selectedProveedorObj = proveedores.find(p => p.id === selectedProveedor);
            const willHaveRetention = selectedProveedorObj?.isRetentionAgent && ivaTotal > 0;
            const pct = selectedProveedorObj?.porcentaje_retencion_iva || 75;

            // Lógica exacta del comprobante:
            const subtotalPlusIva = subtotal + ivaTotal;
            const igtfUsd = invoiceCurrency === 'usd' ? subtotalPlusIva * 0.03 : 0;
            const totalConIgtf = subtotalPlusIva + igtfUsd;

            const montoRetenidoUsd = ivaTotal * (pct / 100);
            const netoATransferirUsd = totalConIgtf - montoRetenidoUsd;

            return (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="px-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" /> Verificación de Montos
                  </h3>
                  <p className="text-xs text-slate-500">Revisa los totales antes de confirmar el pago.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                  <div className="p-5 space-y-4">
                    <div className="space-y-3">
                      {items.map(i => (
                        <div key={i._key} className="flex justify-between items-center text-sm group">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-md bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              {i.cantidad}
                            </div>
                            <span className="text-slate-600 dark:text-slate-400 font-medium">{i.nombre}</span>
                            {i.aplica_iva && <Badge className="text-[9px] h-4 bg-primary/10 text-primary border-none font-black px-1.5">IVA</Badge>}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">${i.subtotal_usd.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator className="bg-slate-100 dark:bg-slate-800" />

                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Subtotal</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">IVA (16%)</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">${ivaTotal.toFixed(2)}</span>
                      </div>
                      {igtfUsd > 0 && (
                        <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400 font-medium">
                          <span>IGTF (3%)</span>
                          <span>${igtfUsd.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
                        <div className="flex justify-between items-end">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Total Factura</span>
                            <span className="text-3xl font-black text-primary leading-none tracking-tight">${totalConIgtf.toFixed(2)}</span>
                          </div>
                          {tasaCambio > 0 && (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Equivalente en VES</span>
                              <span className="text-lg font-bold text-slate-700 dark:text-slate-300">Bs {(totalConIgtf * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {willHaveRetention && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/20">
                        <ShieldCheck className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">Comprobante de Retención</p>
                        <p className="text-xs text-slate-500">Se generará automáticamente un comprobante legal.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-primary/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Monto Retenido</p>
                        <p className="font-black text-primary">Bs {(montoRetenidoUsd * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[9px] text-slate-400">${montoRetenidoUsd.toFixed(2)} USD</p>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-primary/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Neto a Transferir</p>
                        <p className="font-black text-slate-900 dark:text-white">Bs {(netoATransferirUsd * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[9px] text-slate-400">${netoATransferirUsd.toFixed(2)} USD</p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedProveedorObj?.isRetentionAgent && ivaTotal === 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-5 flex gap-4 animate-pulse">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg shrink-0">
                      <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">Advertencia de Retención</p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                        El proveedor es agente de retención pero no hay ítems con IVA.
                        <strong> Regresa al paso anterior</strong> si esto es un error.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* STEP 4: Payment */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="px-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" /> Condiciones de Pago
                </h3>
                <p className="text-xs text-slate-500">Define cómo se liquidará esta obligación financiera.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Forma de Pago</Label>
                  <Select value={tipoPago} onValueChange={v => setTipoPago(v as 'contado' | 'credito' | 'por_pagar')}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      <SelectItem value="por_pagar" className="py-3 font-bold text-primary">Por pagar</SelectItem>
                      <SelectItem value="contado" className="py-3">Al Contado (Pago Inmediato)</SelectItem>
                      <SelectItem value="credito" className="py-3">A Crédito (Cuentas por Pagar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tipoPago === 'credito' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Días de Crédito</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        placeholder="30"
                        value={diasCredito}
                        onChange={e => setDiasCredito(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shadow-sm pr-12 font-bold text-center"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">Días</span>
                    </div>
                  </div>
                )}
              </div>

              {tipoPago === 'credito' && fechaVencimiento && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Esta deuda vencerá el <strong>{fechaVencimiento.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                  </p>
                </div>
              )}

              {/* Final summary card */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 shadow-sm group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <CheckCircle2 className="h-32 w-32 text-primary" />
                </div>

                <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Resumen Final del Registro
                </h4>

                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Proveedor</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                      {proveedores.find(p => p.id === selectedProveedor)?.nombre}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Inventario</span>
                    <Badge variant="outline" className="font-bold border-slate-200 dark:border-slate-800">
                      +{items.length} productos nuevos
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Estado de Operación</span>
                    <Badge className={cn(
                      "font-black uppercase tracking-tighter shadow-sm px-3",
                      tipoPago === 'contado' ? "bg-green-500 hover:bg-green-600" :
                        tipoPago === 'por_pagar' ? "bg-primary hover:bg-primary/90" :
                          "bg-amber-500 hover:bg-amber-600"
                    )}>
                      {tipoPago === 'contado' ? 'Pagada' :
                        tipoPago === 'por_pagar' ? 'Por pagar' :
                          `Crédito ${diasCredito}d`}
                    </Badge>
                  </div>

                  <Separator className="bg-slate-200 dark:bg-slate-800" />

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Compromiso Total</span>
                    <div className="text-right">
                      <p className="text-2xl font-black text-primary leading-none tracking-tight">${total.toFixed(2)}</p>
                      {tasaCambio > 0 && <p className="text-[10px] font-bold text-slate-400 mt-1">Bs {totalBs.toLocaleString('es-VE')}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {step < STEPS.length && (
          <DialogFooter className="p-6 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(s => s - 1) : onOpenChange(false)}
              disabled={isSaving}
              className="h-11 px-6 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all font-semibold"
            >
              <ChevronLeft className="h-5 w-5 mr-1" /> {step > 0 ? 'Regresar' : 'Cancelar'}
            </Button>

            <div className="flex items-center gap-3">
              {step < STEPS.length - 1 ? (
                <Button
                  onClick={() => step === 0 ? handleNextStepZero() : setStep(s => s + 1)}
                  disabled={!canNext() || isCheckingDuplicate}
                  className="h-11 px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all font-bold gap-2"
                >
                  {isCheckingDuplicate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continuar <ChevronRight className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={isSaving || items.length === 0}
                  className="h-11 px-10 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all font-bold gap-2"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar y Guardar
                </Button>
              )}
            </div>
          </DialogFooter>
        )}

        {/* Success View */}
        {step === STEPS.length && successData && (
          <div className="flex flex-col items-center justify-center p-8 sm:p-10 space-y-6 text-center animate-in zoom-in-95 duration-500 bg-white dark:bg-slate-950 min-h-[400px]">
            <div className="relative">
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center relative overflow-hidden shadow-inner">
                <CheckCircle2 className="w-12 h-12 animate-[bounce_1s_ease-out_1]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">¡Registro Exitoso!</h2>
              <p className="text-slate-500 text-sm max-w-[300px] mx-auto leading-relaxed">
                La compra se ha procesado correctamente. El inventario y los costos han sido actualizados.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm pt-2">
              {successData.numero_comprobante && (
                <div className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="p-3 flex flex-col items-center gap-2">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Retención IVA</span>
                    <div className="flex w-full gap-1 border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
                      <Button variant="ghost" size="sm" className="flex-1 h-8 gap-2 rounded-lg" onClick={handlePrintRetention}>
                        <Printer className="w-3 h-3" /> <span className="text-[9px] font-bold uppercase">Imprimir</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="w-8 h-8 rounded-lg" onClick={handleDownloadRetention}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className={cn(
                "group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300",
                !successData.numero_comprobante && "sm:col-span-2 sm:max-w-[180px] mx-auto w-full"
              )}>
                <div className="p-3 flex flex-col items-center gap-2">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Printer className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Resumen Compra</span>
                  <div className="flex w-full gap-1 border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
                    <Button variant="ghost" size="sm" className="flex-1 h-8 gap-2 rounded-lg" onClick={handlePrintSummary}>
                      <Printer className="w-3 h-3" /> <span className="text-[9px] font-bold uppercase">Imprimir</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="w-8 h-8 rounded-lg" onClick={handleDownloadSummary}>
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 w-full max-w-[240px]">
              <Button
                size="lg"
                className="w-full h-11 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                onClick={() => {
                  onSaved();
                  onOpenChange(false);
                }}
              >
                Cerrar y Continuar
              </Button>
            </div>
          </div>
        )}      </DialogContent>

      <Dialog open={!!duplicateInvoice} onOpenChange={(open) => !open && setDuplicateInvoice(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center shadow-inner animate-pulse">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Factura Duplicada</DialogTitle>
              <p className="text-sm text-slate-500 leading-relaxed">
                Detectamos que este documento ya fue registrado previamente en el sistema.
              </p>
            </div>

            {duplicateInvoice && (
              <div className="relative group overflow-hidden bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-left transition-all">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                  <Package className="w-12 h-12" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-primary" />
                  Origen: {duplicateInvoice.source === 'gastos' ? 'Módulo de Gastos' : 'Módulo de Compras'}
                </p>
                <div className="space-y-2 text-sm font-medium">
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400">N° Factura</span>
                    <span className="text-slate-900 dark:text-white font-bold font-mono">{duplicateInvoice.numero_factura}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-slate-400">Proveedor</span>
                    <span className="text-slate-900 dark:text-white font-bold">{duplicateInvoice.proveedor_nombre}</span>
                  </div>
                  {duplicateInvoice.total_usd && (
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Monto Total</span>
                      <span className="text-primary font-black">${duplicateInvoice.total_usd.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button variant="default" onClick={() => { setDuplicateInvoice(null); onOpenChange(false); }} className="h-12 rounded-xl font-bold uppercase tracking-wider shadow-lg">
                Revisar Historial
              </Button>
              <Button variant="ghost" onClick={() => setDuplicateInvoice(null)} className="h-12 rounded-xl text-slate-500 font-semibold">
                Corregir Datos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline new-product dialog — reloads list then auto-selects the newly created product */}
      <ProductFormDialog
        open={newProductDialogOpen}
        onOpenChange={setNewProductDialogOpen}
        product={null}
        onSaved={async () => {
          await reloadProductos();
          if (concesionario?.id) {
            const snap = await getDocs(
              query(
                collection(firestore, 'concesionarios', concesionario.id, 'productos'),
                orderBy('created_at', 'desc')
              )
            );
            if (!snap.empty) {
              const newest = { id: snap.docs[0].id, ...snap.docs[0].data() } as Producto;
              setSelectedProductId(newest.id);
              setSearchQuery(newest.nombre);
              setItemCosto(String(newest.costo_usd));
            }
          }
        }}
      />

      <SupplierFormDialog
        open={newSupplierDialogOpen}
        onOpenChange={setNewSupplierDialogOpen}
        supplier={null}
        onSaved={async () => {
          if (!concesionario?.id) return;
          const snap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'proveedores'), orderBy('created_at', 'desc')));
          const data = snap.docs.map(d => {
            const dataObj = d.data();
            return {
              id: d.id,
              ...dataObj,
              isRetentionAgent: dataObj.isRetentionAgent ?? (dataObj.porcentaje_retencion_iva > 0),
              porcentaje_retencion_iva: dataObj.porcentaje_retencion_iva || 75
            } as Proveedor;
          });
          setProveedores([...data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
          if (data.length > 0) setSelectedProveedor(data[0].id);
        }}
      />

      {/* Printable Sheets */}
      {successData && (() => {
        const isBs = successData.moneda_original === 'bs';
        const sym = isBs ? 'Bs' : '$';
        const formatAmt = (usd: number) => (isBs && successData.tasa_cambio ? usd * successData.tasa_cambio : usd).toFixed(2);
        const hasIva = successData.iva_monto > 0;
        const hasRetention = !!successData.numero_comprobante;

        const formatDateVE = (dateStr: string) => {
          if (!dateStr) return 'N/A';
          if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            return y + '/' + m.padStart(2, '0') + '/' + d.padStart(2, '0');
          }
          return dateStr;
        };

        const montoExento = (successData.items || []).reduce((acc: number, item: any) => !item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);
        const montoGravable = (successData.items || []).reduce((acc: number, item: any) => item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);
        const getBsEquiv = (usd: number) => (usd * (successData.tasa_cambio || 1));
        const subtotalPlusIva = montoExento + montoGravable + (successData.iva_monto || 0);
        const igtfUsd = !isBs ? subtotalPlusIva * 0.03 : 0;
        const finalTotalUsd = subtotalPlusIva + igtfUsd;
        const now = new Date();
        const registeredAt = successData.created_at?.toDate ? successData.created_at.toDate() : now;

        return (
          <div id="purchase-print-root" style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '210mm', background: 'white', color: 'black', zIndex: 9999 }}>
            <style dangerouslySetInnerHTML={{ __html: '@media print { body * { visibility: hidden !important; } #purchase-print-root, #purchase-print-root * { visibility: visible !important; } #purchase-print-root { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; } } @page { size: A4 portrait; margin: 0; } .print-root { width: 100%; background: white !important; } .page-break-after { page-break-after: always; break-after: page; }' }} />
            <div className="print-root text-black font-sans bg-white w-[210mm]">
              {(printMode === 'both' || printMode === 'summary') && (
                <div
                  data-print-page="summary"
                  className={hasRetention && printMode === 'both' ? 'page-break-after' : ''}
                  style={{ padding: '8mm 15mm 5mm 15mm', height: '297mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>{concesionario?.logo_url
                      ? <img src={concesionario.logo_url} alt="Logo" crossOrigin="anonymous" style={{ width: 65, height: 65, objectFit: 'contain' }} />
                      : <div style={{ width: 65, height: 65, background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 4 }}>ZM</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', color: '#2563eb', letterSpacing: 1, margin: 0 }}>{concesionario?.nombre_empresa}</h1>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>RIF: {concesionario?.rif || 'N/A'}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Resumen de Compra</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f9fafb', border: '1px solid #dbeafe', padding: 14, borderRadius: 6, fontSize: 12 }}>
                    <div>
                      <p style={{ margin: '2px 0' }}><strong>N° Factura:</strong> {successData.numero_factura || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>N° Control:</strong> {successData.numero_control || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {successData.proveedor_nombre} {successData.proveedor_rif ? '(' + successData.proveedor_rif + ')' : ''}</p>
                      {successData.fecha_factura && <p style={{ margin: '2px 0' }}><strong>Fecha Factura:</strong> {formatDateVE(successData.fecha_factura)}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {registeredAt.getFullYear() + '/' + String(registeredAt.getMonth() + 1).padStart(2, '0') + '/' + String(registeredAt.getDate()).padStart(2, '0')}</p>
                      <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {successData.tasa_cambio ? 'Bs ' + successData.tasa_cambio.toFixed(2) : 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {successData.creado_por || 'Administrador'}</p>
                      {hasRetention && <p style={{ margin: '2px 0' }}><strong>N° Retención IVA:</strong> {successData.numero_comprobante}</p>}
                    </div>
                    <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, paddingTop: 6, borderTop: '0.5px solid #e5e7eb' }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Este documento no tiene validez fiscal.</p>
                    </div>
                  </div>
                  <h3 style={{ fontWeight: 'bold', borderBottom: '1.5px solid #dbeafe', paddingBottom: 4, marginBottom: 7, fontSize: 12, color: '#2563eb', textTransform: 'uppercase' }}>Lista de Productos</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', width: 80 }}>Código</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Descripción</th>
                        <th style={{ padding: '4px 8px', textAlign: 'center', width: 60 }}>Cant.</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', width: 110 }}>P. Unit. {sym}</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', width: 110 }}>Total {sym}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(successData.items || []).map((item: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{item.codigo || 'N/A'}</td>
                          <td style={{ padding: '6px 8px' }}>{item.nombre}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.cantidad}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{sym}{formatAmt(item.costo_unitario_usd || 0)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{sym}{formatAmt(item.subtotal_usd || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginLeft: 'auto', width: 260, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d1d5db', paddingTop: 6, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Monto Exento:</span><span>{sym}{formatAmt(montoExento)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Monto Gravable:</span><span>{sym}{formatAmt(montoGravable)}</span>
                    </div>
                    {hasIva && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>IVA (16%):</span><span>{sym}{formatAmt(successData.iva_monto || 0)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontWeight: 600 }}>IGTF (3%):</span>
                        <span>{sym}{formatAmt(igtfUsd)}</span>
                      </div>
                      {!isBs && successData.tasa_cambio && (
                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>Bs {getBsEquiv(igtfUsd).toFixed(2)}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '2px solid #d1d5db', paddingTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: 15 }}>
                        <span>Total:</span><span style={{ color: '#2563eb' }}>{sym}{formatAmt(finalTotalUsd)}</span>
                      </div>
                      {!isBs && successData.tasa_cambio && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Equivalente: Bs {getBsEquiv(finalTotalUsd).toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {hasRetention && (printMode === 'both' || printMode === 'retention') && (
                <div data-print-page="retention" style={{ display: 'flex', flexDirection: 'column' }}>
                  <LegalRetentionVoucher
                    concesionario={concesionario}
                    data={{
                      currency: 'USD',
                      exchange_rate: successData.tasa_cambio,
                      iva_retention_number: successData.numero_comprobante || '',
                      invoice_number: successData.numero_factura || '',
                      control_number: successData.numero_control,
                      date: formatDateVE(successData.fecha_factura || ''),
                      original_invoice_date: formatDateVE(successData.fecha_factura || ''),
                      provider_name: successData.proveedor_nombre,
                      provider_rif: successData.proveedor_rif || '',
                      provider_direccion: successData.proveedor_direccion,
                      taxable_amount: montoGravable,
                      exempt_amount: montoExento,
                      iva_amount: successData.iva_monto,
                      total_amount: subtotalPlusIva,
                      igtf_amount: igtfUsd,
                      retention_iva_rate: successData.porcentaje_retencion_aplicado,
                      type: 'EXPENSE'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Dialog open={!!discountItemKey} onOpenChange={(open) => !open && setDiscountItemKey(null)}>
        <DialogContent className="max-w-[300px] p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-2xl">
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Percent className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold">Aplicar Descuento</DialogTitle>
              <p className="text-xs text-slate-500">Ingresa el % a descontar del costo unitario.</p>
            </div>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
                className="h-10 text-center font-bold text-lg pr-8 rounded-xl"
                onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={applyDiscount} className="w-full h-10 rounded-xl font-bold">
                Aplicar
              </Button>
              <Button variant="ghost" onClick={() => setDiscountItemKey(null)} className="w-full h-10 rounded-xl text-slate-500 font-semibold text-xs">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
