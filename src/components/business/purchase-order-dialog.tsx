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
  const [invoiceCurrency, setInvoiceCurrency] = useState<'usd' | 'bs'>('usd');
  const [items, setItems] = useState<(CompraItem & { _key: string })[]>([]);
  const [tipoPago, setTipoPago] = useState<'contado' | 'credito'>('contado');
  const [diasCredito, setDiasCredito] = useState('30');
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [isTasaLoading, setIsTasaLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [printMode, setPrintMode] = useState<'both' | 'summary' | 'retention'>('both');
  const [editValues, setEditValues] = useState<Record<string, string>>({});

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
    setInvoiceCurrency('usd');
    setTipoPago('contado');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Cargar Compra
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 pt-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors',
                  i < step ? 'bg-primary text-primary-foreground' :
                    i === step ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
                      'bg-muted text-muted-foreground'
                )}>{i + 1}</div>
                <span className={cn('text-xs hidden sm:inline', i === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>{s}</span>
                {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-4">
          {/* STEP 0: Supplier */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Seleccionar Proveedor *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={supplierDropdownRef}>
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full h-10 px-3 py-2 text-sm justify-between font-normal text-left"
                      onClick={() => setSupplierSearchOpen(!supplierSearchOpen)}
                    >
                      <span className="truncate">
                        {selectedProveedor
                          ? proveedores.find((p) => p.id === selectedProveedor)?.nombre
                          : "Elige un proveedor..."}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 opacity-50 shrink-0 transition-transform", supplierSearchOpen && "rotate-180")} />
                    </Button>

                    {supplierSearchOpen && (
                      <div
                        className="absolute top-full left-0 w-full z-[100] mt-1 bg-popover text-popover-foreground rounded-md border shadow-md animate-in fade-in-0 zoom-in-95 overflow-hidden"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2 border-b bg-muted/20">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              ref={supplierInputRef}
                              placeholder="Escribe nombre o RIF..."
                              value={supplierSearchQuery}
                              onChange={(e) => setSupplierSearchQuery(e.target.value)}
                              className="pl-8 h-8 text-xs border-none bg-transparent focus-visible:ring-0"
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setSupplierSearchOpen(false);
                              }}
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-[250px]">
                          <div className="p-1">
                            {filteredProveedores.length === 0 ? (
                              <p className="p-4 text-center text-sm text-muted-foreground italic">No se encontraron resultados</p>
                            ) : (
                              filteredProveedores.map((p) => (
                                <Button
                                  key={p.id}
                                  variant="ghost"
                                  className={cn(
                                    "w-full justify-start font-normal h-auto py-2 px-3",
                                    selectedProveedor === p.id && "bg-muted font-medium"
                                  )}
                                  onClick={() => {
                                    setSelectedProveedor(p.id);
                                    setSupplierSearchOpen(false);
                                    setSupplierSearchQuery('');
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      selectedProveedor === p.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col items-start overflow-hidden">
                                    <span className="truncate w-full text-left text-sm">{p.nombre}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase">{p.rif}</span>
                                  </div>
                                </Button>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setNewSupplierDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {proveedores.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay proveedores. Regístralos en el botón "Proveedores".</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    N° de Factura
                    <span className="text-destructive text-xs ml-0.5">*</span>
                  </Label>
                  <Input placeholder="ej: 0001-00012345" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    N° de Control
                    <span className="text-destructive text-xs ml-0.5">*</span>
                  </Label>
                  <Input placeholder="ej: 00-000123" value={numeroControl} onChange={e => setNumeroControl(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de la Factura</Label>
                <Input type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)} />
              </div>
              {/* Currency selector — chosen BEFORE scanning */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> ¿La factura está en Bs o en $?</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInvoiceCurrency('usd')}
                    className={cn(
                      'flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-colors',
                      invoiceCurrency === 'usd' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    $ Dólares
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceCurrency('bs')}
                    className={cn(
                      'flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-colors',
                      invoiceCurrency === 'bs' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    Bs Bolívares
                  </button>
                </div>
                {invoiceCurrency === 'bs' && tasaCambio <= 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Sin tasa configurada, los precios en Bs se usarán tal cual (sin conversión).
                  </p>
                )}
                {invoiceCurrency === 'bs' && tasaCambio > 0 && (
                  <p className="text-xs text-muted-foreground">Los precios de la factura se dividirán entre {tasaCambio.toFixed(2)} Bs para convertir a $.</p>
                )}
              </div>

              {/* Tasa BCV Input */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label>Tasa BCV (Bs/$)</Label>
                  {isTasaLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                <Input type="number" min={0} step={0.01} placeholder="ej: 50.50" value={tasaCambio || ''} onChange={e => setTasaCambio(parseFloat(e.target.value) || 0)} />
              </div>

              {/* AI Invoice upload */}
              <div className="rounded-lg border-2 border-dashed p-4 text-center space-y-2">
                <Sparkles className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm font-medium">Cargar con IA</p>
                <p className="text-xs text-muted-foreground">Sube una foto de la factura y la IA extraerá los productos automáticamente</p>
                <Label htmlFor="invoice-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={isParsingInvoice}>
                    <span>
                      {isParsingInvoice ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {isParsingInvoice ? 'Procesando...' : 'Subir Factura'}
                    </span>
                  </Button>
                </Label>
                <input id="invoice-upload" type="file" accept="image/*" className="hidden" onChange={handleInvoiceScan} />
              </div>
            </div>
          )}

          {/* STEP 1: Products */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Add product */}
              <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                <p className="text-sm font-semibold">Agregar Producto</p>
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Buscar producto por nombre o código..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSelectedProductId(''); }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 text-xs"
                      onClick={() => setNewProductDialogOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Nuevo
                    </Button>
                  </div>
                  {searchQuery && filteredProductos.length > 0 && !selectedProductId && (
                    <div className="border rounded-md bg-popover max-h-36 overflow-y-auto shadow-md">
                            {filteredProductos.slice(0, 8).map(p => (
                        <button key={p.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between" onClick={() => { setSelectedProductId(p.id); setSearchQuery(p.nombre); setItemCosto(invoiceCurrency === 'bs' && tasaCambio > 0 ? (p.costo_usd * tasaCambio).toFixed(2) : String(p.costo_usd)); }}>
                          <span>{p.nombre}</span>
                          <span className="text-xs text-muted-foreground">{p.codigo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad</Label>
                    <Input type="number" min={1} placeholder="1" value={itemQty} onChange={e => setItemQty(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Costo unitario ({invoiceCurrency === 'bs' ? 'Bs' : '$'})</Label>
                    <Input type="number" min={0} step={0.01} placeholder="0.00" value={itemCosto} onChange={e => setItemCosto(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-1.5" /> Agregar
                </Button>
              </div>

              {/* Items list */}
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No hay items agregados.</div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-semibold">Producto</th>
                        <th className="text-center p-2 font-semibold w-16">Cant</th>
                        <th className="text-right p-2 font-semibold w-24">Costo ({invoiceCurrency === 'bs' ? 'Bs' : '$'})</th>
                        <th className="text-right p-2 font-semibold w-24">Subtotal ({invoiceCurrency === 'bs' ? 'Bs' : '$'})</th>
                        <th className="text-center p-2 font-semibold w-12">IVA</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                      {items.map((item, idx) => (
                        <tr key={item._key}>
                          <td className="p-2 truncate max-w-[120px] font-medium" title={item.nombre}>{item.nombre}</td>
                          <td className="p-2 text-center text-muted-foreground">{item.cantidad}</td>
                          <td className="p-2 text-right">
                            {invoiceCurrency === 'bs' && tasaCambio > 0 ? (item.costo_unitario_usd * tasaCambio).toFixed(2) : item.costo_unitario_usd.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-medium">
                            {invoiceCurrency === 'bs' && tasaCambio > 0 ? (item.subtotal_usd * tasaCambio).toFixed(2) : item.subtotal_usd.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              title="Click para activar/desactivar IVA en este ítem"
                              onClick={() => setItems(prev => prev.map((it, i) => i === idx ? { ...it, aplica_iva: !it.aplica_iva } : it))}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${item.aplica_iva
                                ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                            >
                              {item.aplica_iva ? '16%' : '—'}
                            </button>
                          </td>
                          <td className="p-2 text-center">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => {
                              setItems(prev => prev.filter(i => i._key !== item._key));
                            }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Precios */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                <p className="text-sm font-semibold">Definir Precios de Venta</p>
                <div className="space-y-2">
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
                      const cost = isBs ? costoUnitarioBs : item.costo_unitario_usd;
                      const newPrice = cost * (1 + margen / 100);
                      const newPriceUsd = isBs ? newPrice / tasa : newPrice;

                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], nuevo_margen: margen, nuevo_precio_usd: newPriceUsd } as any;
                      setItems(newItems);
                    };

                    const handlePrecioChange = (val: string) => {
                      const price = parseFloat(val) || 0;
                      const cost = isBs ? costoUnitarioBs : item.costo_unitario_usd;
                      const margen = cost > 0 ? ((price / cost) - 1) * 100 : 0;
                      const newPriceUsd = isBs ? price / tasa : price;

                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], nuevo_margen: margen, nuevo_precio_usd: newPriceUsd } as any;
                      setItems(newItems);
                    };

                    const currentMargen = itemConPrecio.nuevo_margen ?? (prod?.costo_usd && prod?.precio_venta_usd && prod.costo_usd > 0 ? ((prod.precio_venta_usd / prod.costo_usd) - 1) * 100 : 0);
                    const currentPrice = isBs
                      ? (itemConPrecio.nuevo_precio_usd !== undefined ? itemConPrecio.nuevo_precio_usd * tasa : (currentMargen > 0 ? costoUnitarioBs * (1 + currentMargen / 100) : precioAnteriorBs))
                      : (itemConPrecio.nuevo_precio_usd !== undefined ? itemConPrecio.nuevo_precio_usd : (currentMargen > 0 ? item.costo_unitario_usd * (1 + currentMargen / 100) : precioAnteriorUsd));

                    const otherPrice = isBs ? currentPrice / tasa : currentPrice * tasa;

                    return (
                      <div key={item._key} className="flex flex-col md:flex-row md:items-center gap-2 rounded-lg border p-3 bg-card text-sm">
                        <div className="flex-1 min-w-0 mb-2 md:mb-0">
                          <p className="font-medium truncate">{item.nombre}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Costo: {isBs ? `${costoUnitarioBs.toFixed(2)} Bs` : `$${item.costo_unitario_usd.toFixed(2)}`}
                            <span className="ml-3">Ant: {isBs ? `${precioAnteriorBs.toFixed(2)} Bs` : `$${precioAnteriorUsd.toFixed(2)}`}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2 shrink-0">
                          <div className="space-y-1 w-20">
                            <Label className="text-[10px]">Margen (%)</Label>
                            <Input
                              type="text"
                              className="h-8"
                              value={editValues[`${item._key}-margen`] ?? currentMargen.toFixed(1)}
                              onFocus={(e) => {
                                // Select all text on focus for quick replacement
                                e.target.select();
                              }}
                              onClick={(e) => {
                                // If the field has a value, we might want to clear it on FIRST click
                                // but allow subsequent clicks to move the cursor
                                const input = e.currentTarget;
                                if (!editValues[`${item._key}-margen`]) {
                                  setEditValues(prev => ({ ...prev, [`${item._key}-margen`]: '' }));
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(',', '.');
                                setEditValues(prev => ({ ...prev, [`${item._key}-margen`]: val }));
                                handleMargenChange(val);
                              }}
                              onBlur={() => {
                                setEditValues(prev => {
                                  const next = { ...prev };
                                  delete next[`${item._key}-margen`];
                                  return next;
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1 w-24">
                            <Label className="text-[10px]">Precio ({isBs ? 'Bs' : '$'})</Label>
                            <Input
                              type="text"
                              className="h-8 text-right font-medium"
                              value={editValues[`${item._key}-precio`] ?? currentPrice.toFixed(2)}
                              onFocus={(e) => {
                                e.target.select();
                              }}
                              onClick={(e) => {
                                if (!editValues[`${item._key}-precio`]) {
                                  setEditValues(prev => ({ ...prev, [`${item._key}-precio`]: '' }));
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(',', '.');
                                setEditValues(prev => ({ ...prev, [`${item._key}-precio`]: val }));
                                handlePrecioChange(val);
                              }}
                              onBlur={() => {
                                setEditValues(prev => {
                                  const next = { ...prev };
                                  delete next[`${item._key}-precio`];
                                  return next;
                                });
                              }}
                            />
                          </div>
                          <div className="w-16 space-y-1 text-right">
                            <Label className="text-[10px] text-muted-foreground mr-1">{isBs ? '$ Ref' : 'Bs Ref'}</Label>
                            <p className="font-semibold text-xs py-2 mr-1">{isBs ? `$${otherPrice.toFixed(2)}` : `${otherPrice.toFixed(2)} Bs`}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Summary */}
          {step === 3 && (() => {
            const selectedProveedorObj = proveedores.find(p => p.id === selectedProveedor);
            const willHaveRetention = selectedProveedorObj?.isRetentionAgent && ivaTotal > 0;
            const pct = selectedProveedorObj?.porcentaje_retencion_iva || 75;
            const montoRetenidoPreview = parseFloat((ivaTotal * pct / 100).toFixed(2));
            return (
              <div className="space-y-4">
                <div className="space-y-1.5 text-sm">
                  {items.map(i => (
                    <div key={i._key} className="flex justify-between">
                      <span className="text-muted-foreground">{i.nombre} × {i.cantidad} {i.aplica_iva ? <span className="text-xs text-primary">(+IVA)</span> : null}</span>
                      <span>${i.subtotal_usd.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IVA (16%)</span><span>${ivaTotal.toFixed(2)}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total USD</span><span>${total.toFixed(2)}</span>
                  </div>
                  {tasaCambio > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Bs (tasa: {tasaCambio.toFixed(2)})</span>
                      <span className="font-semibold text-foreground">Bs. {totalBs.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {willHaveRetention && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1 text-xs">
                    <p className="font-semibold text-primary flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Se generará Comprobante de Retención de IVA</p>
                    <p className="text-muted-foreground">Retención {pct}% sobre IVA ${ivaTotal.toFixed(2)} = <span className="font-semibold text-foreground">Bs {(montoRetenidoPreview * tasaCambio).toFixed(2)}</span></p>
                    <p className="text-muted-foreground">Neto a pagar al proveedor: <span className="font-semibold text-foreground">${(total - montoRetenidoPreview).toFixed(2)}</span></p>
                  </div>
                )}
                {selectedProveedorObj?.isRetentionAgent && ivaTotal === 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>El proveedor es agente de retención pero ningún ítem tiene IVA activado. Vuelve al paso anterior y activa el IVA (16%) en los ítems correspondientes.</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* STEP 4: Payment */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Forma de Pago</Label>
                <Select value={tipoPago} onValueChange={v => setTipoPago(v as 'contado' | 'credito')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">Al Contado (pago inmediato)</SelectItem>
                    <SelectItem value="credito">A Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoPago === 'credito' && (
                <div className="space-y-1.5">
                  <Label>Días de Crédito</Label>
                  <Input type="number" min={1} max={365} placeholder="30" value={diasCredito} onChange={e => setDiasCredito(e.target.value)} />
                  {fechaVencimiento && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      Vence el {fechaVencimiento.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {/* Final summary card */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm">
                <p className="font-semibold text-base mb-2">Resumen Final</p>
                <div className="flex justify-between"><span className="text-muted-foreground">Proveedor</span><span>{proveedores.find(p => p.id === selectedProveedor)?.nombre}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Productos</span><span>{items.length} ítems</span></div>
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
                {tasaCambio > 0 && <div className="flex justify-between text-muted-foreground"><span>Bs.</span><span>{totalBs.toFixed(2)}</span></div>}
                <div className="flex justify-between pt-1"><span className="text-muted-foreground">Estado</span><Badge variant={tipoPago === 'contado' ? 'default' : 'secondary'} className={tipoPago === 'contado' ? 'bg-green-600' : 'bg-amber-500 text-white'}>{tipoPago === 'contado' ? 'Pagada' : `Crédito ${diasCredito}d`}</Badge></div>
              </div>
            </div>
          )}
        </div>

        {step < STEPS.length && (
          <DialogFooter className="flex items-center justify-between pt-2 border-t gap-2">
            <Button variant="outline" onClick={() => step > 0 ? setStep(s => s - 1) : onOpenChange(false)} disabled={isSaving}>
              <ChevronLeft className="h-4 w-4 mr-1.5" /> {step > 0 ? 'Atrás' : 'Cancelar'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => step === 0 ? handleNextStepZero() : setStep(s => s + 1)} disabled={!canNext() || isCheckingDuplicate}>
                {isCheckingDuplicate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Siguiente <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={isSaving || items.length === 0}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar Compra
              </Button>
            )}
          </DialogFooter>
        )}

        {/* Success View */}
        {step === STEPS.length && successData && (
          <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center relative overflow-hidden">
              <CheckCircle2 className="w-12 h-12 animate-[bounce_1s_ease-out_1]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">¡Compra Exitosa!</h2>
              <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                La compra se ha registrado y el inventario ha sido actualizado.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 w-full justify-center mt-2">
              {successData.numero_comprobante && (
                <div className="flex bg-background border rounded-md shadow-sm overflow-hidden">
                  <Button
                    variant="ghost"
                    className="rounded-none border-r px-4 gap-2 h-11"
                    onClick={handlePrintRetention}
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Retención
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-none px-3 h-11"
                    onClick={handleDownloadRetention}
                    title="Descargar PDF"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="flex bg-background border rounded-md shadow-sm overflow-hidden">
                <Button
                  variant="ghost"
                  className="rounded-none border-r px-4 gap-2 h-11"
                  onClick={handlePrintSummary}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Resumen
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-none px-3 h-11"
                  onClick={handleDownloadSummary}
                  title="Descargar PDF"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="pt-4">
              <Button
                size="lg"
                className="w-full sm:w-auto px-10"
                onClick={() => {
                  onSaved();
                  onOpenChange(false);
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Inline new-product dialog — reloads list then auto-selects the newly created product */}
      <ProductFormDialog
        open={newProductDialogOpen}
        onOpenChange={setNewProductDialogOpen}
        product={null}
        onSaved={async () => {
          await reloadProductos();
          // After reload, try to auto-select most recently added product (last in the list by nombre sort)
          // We re-fetch with getDocs to get the latest including the new one
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

      {/* Printable Sheets --- same logic as purchase-history-dialog.tsx */}
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
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[0].length === 4) return dateStr;
            const [d2, m2, y2] = parts;
            return y2 + '/' + m2.padStart(2, '0') + '/' + d2.padStart(2, '0');
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

              {/* PAGE 1: PURCHASE SUMMARY */}
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
                      <p style={{ margin: '2px 0' }}><strong>N Factura:</strong> {successData.numero_factura || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>N Control:</strong> {successData.numero_control || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {successData.proveedor_nombre} {successData.proveedor_rif ? '(' + successData.proveedor_rif + ')' : ''}</p>
                      {successData.fecha_factura && <p style={{ margin: '2px 0' }}><strong>Fecha Factura:</strong> {formatDateVE(successData.fecha_factura)}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {registeredAt.getFullYear() + '/' + String(registeredAt.getMonth() + 1).padStart(2, '0') + '/' + String(registeredAt.getDate()).padStart(2, '0')}</p>
                      <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {successData.tasa_cambio ? 'Bs ' + successData.tasa_cambio.toFixed(2) : 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {successData.creado_por || 'Administrador'}</p>
                      {hasRetention && <p style={{ margin: '2px 0' }}><strong>N Retencion IVA:</strong> {successData.numero_comprobante}</p>}
                    </div>
                    <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, paddingTop: 6, borderTop: '0.5px solid #e5e7eb' }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Este documento no tiene validez fiscal.</p>
                    </div>
                  </div>
                  <h3 style={{ fontWeight: 'bold', borderBottom: '1.5px solid #dbeafe', paddingBottom: 4, marginBottom: 7, fontSize: 12, color: '#2563eb', textTransform: 'uppercase' }}>Lista de Productos</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', width: 80 }}>Codigo</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Descripcion</th>
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
                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>Equiv: Bs {getBsEquiv(igtfUsd).toFixed(2)}</div>
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

              {/* PAGE 2: COMPROBANTE DE RETENCION --- identical to history dialog */}
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

      <Dialog open={!!duplicateInvoice} onOpenChange={(open) => !open && setDuplicateInvoice(null)}>
        <DialogContent className="max-w-md text-center p-6">
          <div className="mx-auto w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl mb-2">Factura ya registrada</DialogTitle>
          <div className="text-sm text-muted-foreground mb-6 space-y-2">
            <p>Ya existe una factura en el sistema para este proveedor con el mismo número de factura o control.</p>
            {duplicateInvoice && (
              <div className="bg-muted p-3 rounded-md text-left mt-2">
                <p className="text-[10px] font-black uppercase text-primary mb-1">Registro detectado en: {duplicateInvoice.source === 'gastos' ? 'Módulo de Gastos' : 'Módulo de Compras'}</p>
                <p><strong>N° Factura:</strong> {duplicateInvoice.numero_factura}</p>
                <p><strong>N° Control:</strong> {duplicateInvoice.numero_control}</p>
                {duplicateInvoice.total_usd && <p><strong>Total:</strong> ${duplicateInvoice.total_usd.toFixed(2)}</p>}
                {duplicateInvoice.creado_por && <p><strong>Cargado por:</strong> {duplicateInvoice.creado_por}</p>}
              </div>
            )}
            <p className="font-semibold text-destructive mt-2">No se puede registrar de nuevo.</p>
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setDuplicateInvoice(null)} className="w-full">
              Volver Atrás
            </Button>
            <Button variant="default" onClick={() => {
              setDuplicateInvoice(null);
              onOpenChange(false);
            }} className="w-full">
              Ver Historial
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
