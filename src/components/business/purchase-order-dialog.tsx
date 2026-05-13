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
import { assertPeriodOpen } from '@/lib/accounting-helpers';
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
import { downloadPdf, printPdf } from '@/lib/download-pdf';
import { LegalRetentionVoucher } from '@/components/business/legal-retention-voucher';
import { ISLR_CONCEPTS } from '@/lib/finance-schemas';

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const IVA_RATE = 0.16;
const STEPS = ['PROVEEDOR', 'PRODUCTOS', 'PRECIOS', 'RESUMEN', 'PAGO'];

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
  const [items, setItems] = useState<(CompraItem & { _key: string, nuevo_margen?: number, nuevo_precio_usd?: number, descuento_porcentaje?: number })[]>([]);
  const [tipoPago, setTipoPago] = useState<'contado' | 'credito' | 'por_pagar'>('por_pagar');
  const [diasCredito, setDiasCredito] = useState('30');
  const [tasaCambio, setTasaCambio] = useState<number>(0);
  const [isTasaLoading, setIsTasaLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [printMode, setPrintMode] = useState<'both' | 'summary' | 'retention'>('both');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // ISLR retention state (income tax withholding, Venezuela)
  const [islrConcept, setIslrConcept] = useState<'NONE' | 'SERV' | 'HPN' | 'HPJ' | 'FLET' | 'PUBL'>('NONE');
  const [islrBaseInput, setIslrBaseInput] = useState<string>('');

  // Preload logo for reliable printing
  useEffect(() => {
    if (concesionario?.logo_url) {
      fetch(concesionario.logo_url)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => setLogoBase64(reader.result as string);
          reader.readAsDataURL(blob);
        })
        .catch(err => {
          console.error('Error preloading logo:', err);
          setLogoBase64(null);
        });
    }
  }, [concesionario?.logo_url]);

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
    setSuccessData(null);
    setIslrConcept('NONE');
    setIslrBaseInput('');

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
  }, [open, firestore, concesionario]);

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

  // ISLR derived
  const islrConceptDef = islrConcept !== 'NONE' ? ISLR_CONCEPTS.find(c => c.code === islrConcept) : undefined;
  const islrPercentage = islrConceptDef?.value ?? 0;
  const islrBase = islrConcept !== 'NONE'
    ? (islrBaseInput ? parseFloat(islrBaseInput) || 0 : subtotal)
    : 0;
  const islrRetenido = parseFloat((islrBase * islrPercentage).toFixed(2));
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
          const newItems = (data.items as any[]).map((item, idx) => {
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

    // Fiscal period lock: reject creation if fecha_factura falls in a closed period.
    const ultimoCerrado = concesionario.configuracion?.ultimo_periodo_cerrado;
    const fechaParaValidar = fechaFactura || new Date().toISOString().slice(0, 10);
    try {
      assertPeriodOpen(fechaParaValidar, ultimoCerrado, 'crear');
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Período Cerrado',
        description: (e as Error).message,
      });
      return;
    }

    setIsSaving(true);
    try {
      const proveedor = proveedores.find(p => p.id === selectedProveedor);
      const isBs = invoiceCurrency === 'bs' && tasaCambio > 0;

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
        is_fiscal: true,
        estado: tipoPago === 'contado' ? 'pagada' : 'pendiente',
        creado_por: staff?.nombre || 'Sistema',
        created_at: serverTimestamp(),
      };

      // Fiscal precision: when the invoice was captured in Bs, snapshot every financial value in Bs
      // so the SENIAT TXT and CSV exports use the same Bs digits that the operator saw on screen,
      // avoiding Bs → USD → Bs round-trip rounding.
      if (isBs) {
        payload.subtotal_bs = parseFloat((subtotal * tasaCambio).toFixed(2));
        payload.iva_monto_bs = parseFloat((ivaTotal * tasaCambio).toFixed(2));
      }

      const isRetentionApplicable = proveedor?.isRetentionAgent && ivaTotal > 0;
      let retentionData: any = null;

      if (isRetentionApplicable && proveedor) {
        const porcentaje = proveedor.porcentaje_retencion_iva || 75;
        const monto_retenido = parseFloat((ivaTotal * porcentaje / 100).toFixed(2));
        const neto_a_pagar = parseFloat((total - monto_retenido - islrRetenido).toFixed(2));
        const numero_comprobante = await generateRetentionVoucherNumber();

        retentionData = { numero_comprobante, monto_retenido, neto_a_pagar, porcentaje_retencion_aplicado: porcentaje };
        payload.numero_comprobante = numero_comprobante;
        payload.monto_retenido = monto_retenido;
        payload.neto_a_pagar = neto_a_pagar;
        payload.porcentaje_retencion_aplicado = porcentaje;
        if (isBs) {
          payload.monto_retenido_bs = parseFloat((monto_retenido * tasaCambio).toFixed(2));
          payload.neto_a_pagar_bs = parseFloat((neto_a_pagar * tasaCambio).toFixed(2));
        }
      } else if (islrRetenido > 0) {
        payload.neto_a_pagar = parseFloat((total - islrRetenido).toFixed(2));
        if (isBs) {
          payload.neto_a_pagar_bs = parseFloat((payload.neto_a_pagar * tasaCambio).toFixed(2));
        }
      }

      // ISLR persistence (independent of IVA retention)
      if (islrConcept !== 'NONE' && islrRetenido > 0) {
        payload.islr_concept = islrConcept;
        payload.islr_percentage = islrPercentage;
        payload.islr_base = islrBase;
        payload.islr_retenido = islrRetenido;
        if (isBs) {
          payload.islr_base_bs = parseFloat((islrBase * tasaCambio).toFixed(2));
          payload.islr_retenido_bs = parseFloat((islrRetenido * tasaCambio).toFixed(2));
        }
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

  const handlePrintSummary = async () => {
    setPrintMode('summary');
    await new Promise(r => setTimeout(r, 200));
    await printPdf({ elementId: 'purchase-print-root' });
  };

  const handlePrintRetention = async () => {
    setPrintMode('retention');
    await new Promise(r => setTimeout(r, 200));
    await printPdf({ elementId: 'purchase-print-root' });
  };

  const handleDownloadSummary = async () => {
    setPrintMode('summary');
    await new Promise(r => setTimeout(r, 400));
    await downloadPdf({ elementId: 'purchase-print-root', filename: `Compra_${numeroFactura || 'N_A'}.pdf` });
  };

  const handleDownloadRetention = async () => {
    setPrintMode('retention');
    await new Promise(r => setTimeout(r, 400));
    await downloadPdf({ elementId: 'purchase-print-root', filename: `Retencion_${successData?.numero_comprobante || 'N_A'}.pdf` });
  };

  const handleFinish = () => {
    onSaved();
    onOpenChange(false);
  };

  const startEditing = (item: any) => {
    setEditingItemKey(item._key);
    setEditQty(String(item.cantidad));
    setEditCost(invoiceCurrency === 'bs' && tasaCambio > 0 ? (item.costo_unitario_usd * tasaCambio).toFixed(2) : String(item.costo_unitario_usd));
  };

  const saveEdit = () => {
    const qty = parseInt(editQty);
    const cost = parseFloat(editCost) || 0;
    const costoUsd = invoiceCurrency === 'bs' && tasaCambio > 0 ? cost / tasaCambio : cost;
    if (qty <= 0 || cost < 0) return;

    setItems(prev => prev.map(item => {
      if (item._key === editingItemKey) {
        return {
          ...item,
          cantidad: qty,
          costo_unitario_usd: parseFloat(costoUsd.toFixed(8)),
          subtotal_usd: parseFloat((qty * costoUsd).toFixed(8)),
        };
      }
      return item;
    }));
    setEditingItemKey(null);
  };

  const applyDiscount = () => {
    const pct = parseFloat(discountValue) || 0;
    if (pct < 0 || pct > 100) return;
    setItems(prev => prev.map(item => {
      if (item._key === discountItemKey) {
        const newCost = item.costo_unitario_usd * (1 - pct / 100);
        return {
          ...item,
          descuento_porcentaje: pct,
          costo_unitario_usd: parseFloat(newCost.toFixed(8)),
          subtotal_usd: parseFloat((item.cantidad * newCost).toFixed(8)),
        };
      }
      return item;
    }));
    setDiscountItemKey(null);
    setDiscountValue('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-50/95 backdrop-blur-xl border-slate-200 shadow-2xl p-0 rounded-[2rem] dark:bg-slate-950/90 dark:border-slate-800",
        step === STEPS.length && "bg-white dark:bg-slate-950"
      )}>
        {step < STEPS.length && (
          <DialogHeader className="p-6 pb-2 shrink-0 space-y-4">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-700 dark:text-slate-300">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Package className="h-6 w-6 text-primary" />
              </div>
              Cargar Compra
            </DialogTitle>

            <div className="relative flex items-center justify-between px-2 pt-2">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10 rounded-full" />
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-col items-center gap-2 relative z-10">
                  <div className={cn(
                    'flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold border-2 transition-all duration-500',
                    i < step ? 'bg-primary border-primary text-white scale-90' :
                      i === step ? 'bg-white dark:bg-slate-900 border-primary text-primary ring-4 ring-primary/10 scale-110' :
                        'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                  )}>
                    {i < step ? <Check className="h-5 w-5" /> : i + 1}
                  </div>
                  <span className={cn(
                    'text-[11px] font-semibold uppercase transition-colors duration-300',
                    i === step ? 'text-primary' : 'text-slate-400'
                  )}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </DialogHeader>
        )}

        {step < STEPS.length && (
          <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
            {/* STEP 0: Supplier & Data */}
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
                              {proveedores.find(p => p.id === selectedProveedor)?.nombre}
                            </>
                          ) : "Busca o elige un proveedor..."}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 opacity-50 shrink-0 transition-transform duration-300", supplierSearchOpen && "rotate-180")} />
                      </Button>

                      {supplierSearchOpen && (
                        <div className="absolute top-full left-0 w-full z-[100] mt-2 bg-white dark:bg-slate-900 text-popover-foreground rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in-0 zoom-in-95 overflow-hidden backdrop-blur-xl">
                          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                ref={supplierInputRef}
                                placeholder="Escribe nombre o RIF..."
                                value={supplierSearchQuery}
                                onChange={e => setSupplierSearchQuery(e.target.value)}
                                className="pl-10 h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-primary/20 rounded-xl"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[280px]">
                            <div className="p-2 space-y-1">
                              {filteredProveedores.map(p => (
                                <Button
                                  key={p.id}
                                  variant="ghost"
                                  className={cn(
                                    "w-full justify-start font-normal h-auto py-3 px-4 rounded-xl transition-all duration-200",
                                    selectedProveedor === p.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-primary/5"
                                  )}
                                  onClick={() => { setSelectedProveedor(p.id); setSupplierSearchOpen(false); }}
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
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="icon" className="shrink-0 h-12 w-12 rounded-xl border-slate-200 dark:border-slate-800" onClick={() => setNewSupplierDialogOpen(true)}>
                      <Plus className="h-5 w-5 text-slate-400" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <Hash className="h-4 w-4 text-primary" /> N° de Factura
                    </Label>
                    <Input value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:ring-primary/20" placeholder="00001612" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> N° de Control
                    </Label>
                    <Input value={numeroControl} onChange={e => setNumeroControl(e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:ring-primary/20" placeholder="00-00001612" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" /> Fecha de la Factura
                    </Label>
                    <Input type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)} className="h-11 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <RefreshCw className={cn("h-4 w-4 text-primary", isTasaLoading && "animate-spin")} /> Tasa BCV (Bs/$)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs</span>
                      <Input type="number" step="0.01" value={tasaCambio || ''} onChange={e => setTasaCambio(parseFloat(e.target.value) || 0)} className="h-11 pl-9 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:ring-primary/20 font-bold" />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" /> Moneda de la Factura
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
                            ? 'border-primary bg-primary/5 text-primary scale-[1.02] shadow-primary/10'
                            : 'border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-950 hover:border-primary/30 dark:hover:border-primary/30'
                        )}
                      >
                        <div className={cn("w-2 h-2 rounded-full", invoiceCurrency === curr ? "bg-primary animate-pulse" : "bg-slate-300")} />
                        {curr === 'bs' ? 'Bolívares (Bs)' : 'Dólares ($)'}
                      </button>
                    ))}
                  </div>
                  {invoiceCurrency === 'bs' && (
                    <div className="flex items-start gap-2 text-[11px] p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 font-medium">
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

            {/* STEP 1: Products Listing */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm space-y-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                      <Plus className="h-4 w-4 text-primary" /> Agregar Producto
                    </h3>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
                      {items.length} {items.length === 1 ? 'Item' : 'Items'}
                    </Badge>
                  </div>

                  <div className="space-y-2 relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          className="pl-10 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                          placeholder="Buscar producto por nombre o código..."
                          value={searchQuery}
                          onChange={e => { setSearchQuery(e.target.value); setSelectedProductId(''); }}
                        />
                      </div>
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-slate-200 dark:border-slate-800" onClick={() => setNewProductDialogOpen(true)}>
                        <Plus className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                    {searchQuery && filteredProductos.length > 0 && !selectedProductId && (
                      <div className="absolute z-[110] w-full mt-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 max-h-56 overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-2 backdrop-blur-xl">
                        {filteredProductos.slice(0, 10).map(p => (
                          <button
                            key={p.id}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between group border-b last:border-0 dark:border-slate-800"
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setSearchQuery(p.nombre);
                              const cost = invoiceCurrency === 'bs' && tasaCambio > 0 ? (p.costo_usd * tasaCambio).toFixed(2) : String(p.costo_usd);
                              setItemCosto(cost);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 dark:text-white">{p.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{p.codigo}</span>
                            </div>
                            <span className="text-xs font-bold text-primary">${p.costo_usd.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <Input type="number" min={1} value={itemQty} onChange={e => setItemQty(e.target.value)} className="h-11 text-center font-bold rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Costo ({invoiceCurrency === 'bs' ? 'Bs' : '$'})</Label>
                      <Input type="number" step="0.01" value={itemCosto} onChange={e => setItemCosto(e.target.value)} className="h-11 text-right font-bold rounded-xl" />
                    </div>
                  </div>
                  <Button size="lg" onClick={addItem} variant="outline" className="w-full rounded-xl font-bold gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all shadow-sm">
                    <Plus className="h-5 w-5 text-primary" /> Añadir a la Lista
                  </Button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Detalle de Items</h4>
                  {items.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 italic text-slate-400 text-sm">No hay productos en la lista.</div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                          <tr>
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
                            <tr key={item._key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold">{item.nombre}</span>
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
                                <button onClick={() => setItems(prev => prev.map((it, i) => i === idx ? { ...it, aplica_iva: !it.aplica_iva } : it))} className={cn("px-2.5 py-1 rounded-md text-[10px] font-black tracking-tight border transition-all shadow-sm", item.aplica_iva ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' : 'bg-slate-50 text-slate-400 border-transparent')}>
                                  {item.aplica_iva ? '16%' : 'EX'}
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
                              <div className="flex flex-col items-end leading-tight">
                                <span>
                                  {invoiceCurrency === 'bs' && tasaCambio > 0
                                    ? `Bs ${(total * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : `$ ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                </span>
                                {ivaTotal > 0 && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    Incluye {invoiceCurrency === 'bs' && tasaCambio > 0
                                      ? `Bs ${(ivaTotal * tasaCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                                      : `$${ivaTotal.toFixed(2)}`} de IVA (16%)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Prices Management */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between px-1">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-700 dark:text-white flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" /> Estrategia de Precios
                    </h3>
                    <p className="text-xs text-slate-500 italic">Ajusta los márgenes de ganancia para tus productos recibidos.</p>
                  </div>
                  <Badge variant="outline" className="h-7 px-3 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 font-medium uppercase tracking-widest text-[9px]">
                    MODO: {invoiceCurrency === 'bs' ? 'VES' : 'USD'}
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

                    // Use the same formula as delivery note: Margin applied after IVA if applies
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
                        : 30
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
                        : (precioAnteriorUsd || getPriceFromMargen(30, item.costo_unitario_usd, item.aplica_iva)));

                    const currentPriceBs = currentPriceUsd * tasa;

                    return (
                      <div key={item._key} className="p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm group">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{item.codigo}</span>
                              <Badge variant="secondary" className="text-[9px] h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 border-none">STOCK: {prod?.stock_actual || 0}</Badge>
                            </div>
                            <h4 className="font-bold text-slate-900 dark:text-white truncate text-base">{item.nombre}</h4>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Costo Entrada</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                  {isBs ? `${costoUnitarioBs.toFixed(2)} Bs` : `$${item.costo_unitario_usd.toFixed(2)}`}
                                </span>
                              </div>
                              <Separator orientation="vertical" className="h-8" />
                              <div className="flex flex-col">
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Precio Anterior</span>
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
                              <Label className="text-[10px] font-bold text-primary uppercase">Ref en $</Label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary">$</span>
                                <Input
                                  type="text"
                                  className="h-9 text-right font-black text-primary bg-primary/5 border-primary/20 rounded-lg focus:ring-primary/20 pr-2 pl-5"
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
                <div className="space-y-4">
                  {items.map(i => (
                    <div key={i._key} className="flex justify-between text-sm group">
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
                  <div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">Monto Neto (Base)</span><span className="font-bold text-slate-900 dark:text-white">${subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">I.V.A. (16%)</span><span className="font-medium text-slate-900 dark:text-white">${ivaTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Documento</span>
                      <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">${total.toFixed(2)}</span>
                    </div>
                    {tasaCambio > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Bs</span>
                        <span className="text-xl font-black tracking-tighter text-slate-700 dark:text-slate-300">Bs {totalBs.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {(() => {
                  const prov = proveedores.find(p => p.id === selectedProveedor);
                  if (prov?.isRetentionAgent && ivaTotal > 0) {
                    return (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Retención de IVA Aplicable</p>
                        <p className="text-[10px] text-slate-500">Se retendrá el {prov.porcentaje_retencion_iva || 75}% del IVA (${(ivaTotal * (prov.porcentaje_retencion_iva || 75) / 100).toFixed(2)}).</p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* ISLR Retention Selector */}
                <div className="p-4 rounded-xl bg-card/60 backdrop-blur-md border border-border space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Percent className="h-3 w-3 text-primary" /> Retención ISLR (Opcional)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select value={islrConcept} onValueChange={(v) => setIslrConcept(v as any)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm">
                        <SelectValue placeholder="Concepto ISLR" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Ninguna</SelectItem>
                        {ISLR_CONCEPTS.map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`Base ISLR (default: $${subtotal.toFixed(2)})`}
                      value={islrBaseInput}
                      onChange={(e) => setIslrBaseInput(e.target.value)}
                      disabled={islrConcept === 'NONE'}
                      className="h-10 rounded-xl text-sm"
                    />
                  </div>
                  {islrConcept !== 'NONE' && islrRetenido > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-border">
                      <span className="text-xs text-muted-foreground">ISLR a retener ({(islrPercentage * 100).toFixed(0)}%)</span>
                      <span className="font-bold text-sm text-primary">${islrRetenido.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Neto a pagar final */}
                {(() => {
                  const prov = proveedores.find(p => p.id === selectedProveedor);
                  const ivaRet = prov?.isRetentionAgent && ivaTotal > 0
                    ? ivaTotal * (prov.porcentaje_retencion_iva || 75) / 100
                    : 0;
                  const neto = total - ivaRet - islrRetenido;
                  if (ivaRet === 0 && islrRetenido === 0) return null;
                  return (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Neto a Pagar Proveedor</span>
                      <span className="text-xl font-bold tracking-tighter text-primary">${neto.toFixed(2)}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-4">
                  <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 px-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> Condición de la Operación
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
                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.02]'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 opacity-60 hover:opacity-100 shadow-sm'
                        )}
                      >
                        <span className={cn("font-bold text-sm", tipoPago === opt.id ? 'text-primary' : 'text-slate-500')}>{opt.label}</span>
                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {tipoPago === 'credito' && (
                  <div className="space-y-2 animate-in zoom-in-95">
                    <Label className="text-slate-700 dark:text-slate-300 font-semibold px-1">Días de Crédito Otorgados</Label>
                    <Input type="number" value={diasCredito} onChange={e => setDiasCredito(e.target.value)} className="h-11 rounded-xl text-center font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                  </div>
                )}

                <div className="p-10 rounded-[2.5rem] bg-primary text-white space-y-8 relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-32 -mt-32 opacity-20 group-hover:scale-110 transition-transform duration-700" />
                  <Package className="absolute -bottom-10 -right-10 w-48 h-48 opacity-5 -rotate-12 group-hover:rotate-0 transition-all duration-700" />

                  <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80 leading-none">Confirmación Final</p>
                      <h5 className="text-2xl font-black tracking-tight text-white uppercase">Monto Total a Cargar</h5>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-black tracking-tighter text-white">${total.toFixed(2)}</p>
                      <p className="text-[10px] text-white/60 font-black uppercase tracking-widest mt-1">Dólares Americanos</p>
                    </div>
                  </div>

                  <Separator className="bg-white/20" />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white uppercase">{proveedores.find(p => p.id === selectedProveedor)?.nombre}</p>
                        <p className="text-[9px] text-white/60 font-black uppercase tracking-widest">Beneficiario del Registro</p>
                      </div>
                    </div>
                    <div className="px-5 py-2 rounded-xl bg-white/20 border border-white/30 backdrop-blur-md">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        {tipoPago === 'contado' ? 'PAGADO HOY' : (tipoPago === 'credito' ? `PLAZO: ${diasCredito} DÍAS` : 'CTA. CORRIENTE')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step < STEPS.length && (
          <DialogFooter className="p-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm border-t border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-4 shrink-0">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(s => s - 1) : onOpenChange(false)}
              className="h-11 px-6 rounded-xl font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> {step > 0 ? 'Regresar' : 'Cancelar'}
            </Button>
            <Button
              onClick={() => step === STEPS.length - 1 ? handleSave() : (step === 0 ? handleNextStepZero() : setStep(s => s + 1))}
              disabled={isSaving || isCheckingDuplicate || (step === 1 && items.length === 0) || (step === 0 && (!selectedProveedor || !numeroFactura.trim()))}
              className="h-11 px-8 rounded-xl shadow-lg font-bold gap-2 bg-primary hover:bg-primary/90 text-white transition-all active:scale-95 shadow-primary/20"
            >
              {isSaving || isCheckingDuplicate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === STEPS.length - 1 ? 'Confirmar Compra' : 'Siguiente'} <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        )}

        {step === STEPS.length && successData && (
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar bg-white dark:bg-slate-950">
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 pb-20 space-y-8 text-center animate-in zoom-in-95 duration-500 min-h-full">
              <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center shadow-inner relative group shrink-0">
                <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl opacity-40 group-hover:opacity-60 transition-opacity animate-pulse" />
                <CheckCircle2 className="w-12 h-12 relative z-10 transition-transform group-hover:scale-110 duration-500" />
              </div>

              <div className="space-y-3 shrink-0">
                <h2 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">¡Compra Registrada!</h2>
                <p className="text-slate-500 text-sm max-w-[340px] mx-auto leading-relaxed font-medium">
                  La factura fiscal <span className="text-primary font-bold">#{successData.numero_factura}</span> ha sido procesada con éxito en el sistema.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg shrink-0">
                {/* Card Resumen */}
                <div className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-500">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                      <FileText className="w-6 h-6 text-primary group-hover:text-white" />
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Documento Fiscal</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Resumen de Compra</span>
                    </div>
                    <div className="flex w-full gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button variant="ghost" size="sm" className="flex-1 h-10 gap-2 rounded-xl font-bold text-[10px] uppercase text-primary hover:bg-primary/10 transition-colors" onClick={handlePrintSummary}>
                        <Printer className="w-3.5 h-3.5" /> Imprimir
                      </Button>
                      <Button variant="ghost" size="sm" className="w-10 h-10 rounded-xl text-primary/70 hover:bg-primary/10 transition-colors" onClick={handleDownloadSummary}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Card Retención (Solo si aplica) */}
                {successData.numero_comprobante ? (
                  <div className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all duration-500">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-3 bg-emerald-500/10 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 shadow-inner">
                        <ShieldCheck className="w-6 h-6 text-emerald-500 group-hover:text-white" />
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Retención IVA</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{successData.numero_comprobante}</span>
                      </div>
                      <div className="flex w-full gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button variant="ghost" size="sm" className="flex-1 h-10 gap-2 rounded-xl font-bold text-[10px] uppercase text-emerald-600 hover:bg-emerald-50 transition-colors" onClick={handlePrintRetention}>
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </Button>
                        <Button variant="ghost" size="sm" className="w-10 h-10 rounded-xl text-emerald-600/70 hover:bg-emerald-50 transition-colors" onClick={handleDownloadRetention}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl opacity-50">
                    <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin Retención</span>
                  </div>
                )}
              </div>

              <div className="w-full max-w-sm pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <Button
                  onClick={handleFinish}
                  className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black shadow-xl shadow-primary/20 transition-all active:scale-[0.98] text-base uppercase tracking-widest"
                >
                  continuar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Embedded Dialogs */}
      <ProductFormDialog open={newProductDialogOpen} onOpenChange={setNewProductDialogOpen} product={null} onSaved={reloadProductos} />
      <SupplierFormDialog open={newSupplierDialogOpen} onOpenChange={setNewSupplierDialogOpen} supplier={null} onSaved={async () => {
        if (!concesionario?.id) return;
        const snap = await getDocs(query(collection(firestore, 'concesionarios', concesionario.id, 'proveedores'), orderBy('created_at', 'desc')));
        setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Proveedor)));
      }} />

      {/* Duplicate Invoice Dialog */}
      <Dialog open={!!duplicateInvoice} onOpenChange={o => !o && setDuplicateInvoice(null)}>
        <DialogContent className="max-w-md p-6 text-center space-y-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-10 h-10" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Factura Duplicada</DialogTitle>
          <p className="text-sm text-slate-500">Este número de factura ya existe para este proveedor.</p>
          <Button onClick={() => setDuplicateInvoice(null)} className="w-full h-11 rounded-xl font-bold bg-primary text-white transition-all">Corregir Datos</Button>
        </DialogContent>
      </Dialog>

      {/* Printable Sheet (hidden) */}
      {successData && (
        <div id="purchase-print-root" style={{ display: 'none' }}>
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body * { visibility: hidden !important; }
                #purchase-print-root, #purchase-print-root * { visibility: visible !important; }
                #purchase-print-root { 
                  display: block !important;
                  position: absolute !important;
                  left: 0 !important; top: 0 !important;
                  width: 210mm !important;
                }
              }
              @page { size: A4 portrait; margin: 0; }
              .page-break-after { page-break-after: always; break-after: page; }
          `}} />
          <div className="print-root text-black font-sans bg-white w-[210mm]">
            {/* PAGE 1: PURCHASE SUMMARY */}
            {(printMode === 'both' || printMode === 'summary') && (
              <div className={successData.numero_comprobante && printMode === 'both' ? 'page-break-after' : ''}>
                <PurchaseOrderPrint data={successData} concesionario={concesionario} logoBase64={logoBase64} />
              </div>
            )}

            {/* PAGE 2: RETENTION (Only if exists) */}
            {successData.numero_comprobante && (printMode === 'both' || printMode === 'retention') && (
              <LegalRetentionVoucher
                concesionario={concesionario}
                logoBase64={logoBase64}
                data={{
                  currency: 'USD',
                  exchange_rate: successData.tasa_cambio,
                  iva_retention_number: successData.numero_comprobante,
                  invoice_number: successData.numero_factura,
                  control_number: successData.numero_control,
                  date: successData.fecha_factura,
                  provider_name: successData.proveedor_nombre,
                  provider_rif: successData.proveedor_rif || '—',
                  provider_direccion: successData.proveedor_direccion || '—',
                  taxable_amount: successData.base_imponible_usd,
                  exempt_amount: successData.monto_exento_usd,
                  iva_amount: successData.iva_monto,
                  total_amount: successData.total_usd,
                  igtf_amount: 0,
                  retention_iva_rate: successData.porcentaje_retencion_aplicado || 75
                }}
              />
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function PurchaseOrderPrint({ data, concesionario, logoBase64 }: { data: any, concesionario: any, logoBase64: string | null }) {
  const isBs = data.moneda_original === 'bs';
  const sym = isBs ? 'Bs' : '$';
  const tasa = data.tasa_cambio || 1;
  const formatAmt = (usd: number) => (isBs ? usd * tasa : usd).toFixed(2);
  const now = new Date();

  return (
    <div style={{ padding: '8mm 15mm 5mm 15mm', height: '297mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>{logoBase64
          ? <img src={logoBase64} alt="Logo" style={{ width: 65, height: 65, objectFit: 'contain' }} />
          : concesionario?.logo_url 
            ? <img src={concesionario.logo_url} alt="Logo" crossOrigin="anonymous" loading="eager" style={{ width: 65, height: 65, objectFit: 'contain' }} />
            : <div style={{ width: 65, height: 65, background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 4 }}>ZM</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', color: '#2563eb', letterSpacing: 1, margin: 0 }}>{concesionario?.nombre_empresa}</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>RIF: {concesionario?.rif || '—'}</p>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Resumen de Compra</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f9fafb', border: '1px solid #dbeafe', padding: 14, borderRadius: 6, fontSize: 12 }}>
        <div>
          <p style={{ margin: '2px 0' }}><strong>N° Factura:</strong> {data.numero_factura || 'N/A'}</p>
          <p style={{ margin: '2px 0' }}><strong>N° Control:</strong> {data.numero_control || 'N/A'}</p>
          <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {data.proveedor_nombre} {data.proveedor_rif ? `(${data.proveedor_rif})` : ''}</p>
          {data.fecha_factura && <p style={{ margin: '2px 0' }}><strong>Fecha Factura:</strong> {data.fecha_factura}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {now.toLocaleDateString('es-VE')}</p>
          <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {tasa.toFixed(2)} Bs/$</p>
          <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {data.creado_por || 'Administrador'}</p>
          {data.numero_comprobante && <p style={{ margin: '2px 0' }}><strong>N° Retención IVA:</strong> {data.numero_comprobante}</p>}
        </div>
        <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
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
          {data.items.map((item: any, i: number) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{item.codigo || '—'}</td>
              <td style={{ padding: '6px 8px' }}>{item.nombre}</td>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.cantidad}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{sym}{formatAmt(item.costo_unitario_usd)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{sym}{formatAmt(item.subtotal_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginLeft: 'auto', width: 260, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d1d5db', paddingTop: 6, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>Monto Exento:</span><span>{sym}{formatAmt(data.monto_exento_usd || 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>Monto Gravable:</span><span>{sym}{formatAmt(data.base_imponible_usd || 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>IVA (16%):</span><span>{sym}{formatAmt(data.iva_monto)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '2px solid #d1d5db', paddingTop: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: 15 }}>
            <span>Total:</span><span style={{ color: '#2563eb' }}>{sym}{formatAmt(data.total_usd)}</span>
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
            {isBs ? `Ref: $${data.total_usd.toFixed(2)}` : `Equiv: Bs ${(data.total_usd * tasa).toFixed(2)}`}
          </div>
        </div>
      </div>
    </div>
  );
}
