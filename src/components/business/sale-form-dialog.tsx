'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Car, User, DollarSign, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Search, Lock, FileText, Receipt, Printer, Download, ShieldAlert, Package, LayoutGrid, Plus, Trash2, Wallet, RefreshCw, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StockVehicle, BankAccount } from '@/lib/business-types';
import { ROLE_LABELS, verifySHA256, BANK_ENTRY_METHOD_LABELS } from '@/lib/business-types';
import { cn } from '@/lib/utils';
import { SaleDocumentsPrint } from './sale-documents-print';
import type { PaymentSplit } from '@/lib/finance-schemas';

// ---------- Helpers ----------
const padNum = (n: number, len: number) => String(n).padStart(len, '0');

function numberToWords(amount: number): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wn = require('written-number');
    const fn = typeof wn === 'function' ? wn : wn.default;
    if (typeof fn !== 'function') return `${amount}`;
    const intPart = Math.floor(amount);
    const dec = Math.round((amount - intPart) * 100);
    const words: string = fn(intPart, { lang: 'es' });
    const cap = words.charAt(0).toUpperCase() + words.slice(1);
    return dec > 0 ? `${cap} dólares con ${dec}/100` : `${cap} dólares exactos`;
  } catch { return String(amount); }
}

// ---------- Types ----------
type WizardStep = 'tipo' | 'vehiculo' | 'productos' | 'precio' | 'cliente' | 'pago' | 'exito' | 'documentos';

interface SaleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concesionarioId: string;
  onSave: () => void;
  preInvoice?: any;
}

const STEP_LABELS: Record<WizardStep, string> = {
  tipo: 'Tipo', vehiculo: 'Vehículo', productos: 'Productos', precio: 'Precio', cliente: 'Cliente', pago: 'Pago', exito: 'Éxito', documentos: 'Documentos',
};
const WIZARD_STEPS: WizardStep[] = ['tipo', 'vehiculo', 'productos', 'precio', 'cliente', 'pago', 'exito', 'documentos'];

// ---------- Main Component ----------
export function SaleFormDialog({ open, onOpenChange, concesionarioId, onSave, preInvoice }: SaleFormDialogProps) {
  const { concesionario, staff, currentRole, staffList } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>('tipo');
  // Step 1
  const [tipoVenta, setTipoVenta] = useState<'vehiculo' | 'producto' | null>(null);
  // Step 2 - Vehicle
  const [availableVehicles, setAvailableVehicles] = useState<StockVehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  // Step 2 - Products (New)
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [productItems, setProductItems] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemDiscount, setItemDiscount] = useState('0');

  // Step 3 - Price & Seller
  const [precioVenta, setPrecioVenta] = useState<number | ''>('');
  const [vendedorId, setVendedorId] = useState('');
  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authUserId, setAuthUserId] = useState('');
  const [authPin, setAuthPin] = useState(['', '', '', '']);
  const [authGranted, setAuthGranted] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  // Trade-in
  const [parteDePago, setParteDePago] = useState(false);

  // Step 4 - Client
  const [clientMode, setClientMode] = useState<'cargar' | 'crear'>('cargar');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [compradorId, setCompradorId] = useState('');
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorApellido, setCompradorApellido] = useState('');
  const [compradorCedula, setCompradorCedula] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');
  const [compradorEmail, setCompradorEmail] = useState('');
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Step 5 - Payment & Documentation
  const [tipoDocumento, setTipoDocumento] = useState<'factura_fiscal' | 'nota_entrega'>('nota_entrega');
  const [customTasaBcv, setCustomTasaBcv] = useState<number>(0);
  const [isTasaLoading, setIsTasaLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'completo' | 'combinado'>('completo');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [registrarCaja, setRegistrarCaja] = useState(true);
  const [docsAlerta, setDocsAlerta] = useState(false);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Modal state for bank account selection
  const [accountSelectModalOpen, setAccountSelectModalOpen] = useState(false);
  const [accountSelectMethod, setAccountSelectMethod] = useState<string>('');
  const [accountSelectSplitIndex, setAccountSelectSplitIndex] = useState<number | null>(null);

  // Modal state for method selection in combined payment
  const [methodSelectModalOpen, setMethodSelectModalOpen] = useState(false);

  // Exchange rate logic matching PurchaseOrderDialog
  useEffect(() => {
    if (!open || !concesionario) return;

    const cfg = concesionario.configuracion as Record<string, any> | undefined;
    const manualRate = typeof cfg?.tasa_cambio_manual === 'number' ? cfg.tasa_cambio_manual : 0;
    const autoEnabled = cfg?.tasa_cambio_auto === true;

    if (autoEnabled) {
      setIsTasaLoading(true);
      fetch('/api/business/exchange-rate')
        .then(r => r.json())
        .then(data => { 
          if (data.tasa) setCustomTasaBcv(data.tasa); 
          else setCustomTasaBcv(manualRate); 
        })
        .catch(err => { console.error('Error fetching rate:', err); setCustomTasaBcv(manualRate || 36); })
        .finally(() => setIsTasaLoading(false));
    } else {
      setCustomTasaBcv(manualRate || 36);
    }
    
    // Fetch bank accounts
    const fetchBankAccounts = async () => {
      try {
        const qAccounts = query(
          collection(firestore, `concesionarios/${concesionario.id}/cuentas_bancarias`),
          where('activa', '==', true)
        );
        const snap = await getDocs(qAccounts);
        const accounts = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setBankAccounts(accounts);
      } catch (e) {
        console.error("Error fetching bank accounts:", e);
      }
    };
    fetchBankAccounts();
  }, [open, concesionario, firestore]);

  const effectiveTasa = Number(customTasaBcv) || 1;
  
  const negotiatedPrice = useMemo(() => {
    if (tipoVenta === 'producto') {
      return productItems.reduce((acc, it) => acc + (it.subtotal_usd || 0), 0);
    }
    return Number(precioVenta) || 0;
  }, [tipoVenta, productItems, precioVenta]);
  
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  // Close product dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setProductSearchOpen(false);
      }
    };
    if (productSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => productInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [productSearchOpen]);

  // Tax Calculations
  const ivaAmount = useMemo(() => {
    if (tipoDocumento !== 'factura_fiscal') return 0;
    if (tipoVenta === 'producto') {
      return productItems.reduce((acc, it) => {
        if (it.aplica_iva) return acc + (it.subtotal_usd * 0.16);
        return acc;
      }, 0);
    }
    return negotiatedPrice * 0.16;
  }, [tipoDocumento, tipoVenta, productItems, negotiatedPrice]);

  const baseFiscalDebt = negotiatedPrice + ivaAmount;

  // IGTF (3%) logic
  const igtfAmount = useMemo(() => {
    if (tipoDocumento !== 'factura_fiscal') return 0;
    
    return paymentSplits
      .filter(s => s.currency === 'USD')
      .reduce((acc, s) => acc + (s.amount * 0.03), 0);
  }, [tipoDocumento, paymentSplits]);
  
  const totalOperacionUsd = baseFiscalDebt + igtfAmount;

  // Product helper functions
  const filteredAvailableProducts = useMemo(() => {
    if (!productSearchQuery) return availableProducts;
    const low = productSearchQuery.toLowerCase();
    return availableProducts.filter(p => 
      p.nombre.toLowerCase().includes(low) || 
      (p.codigo || '').toLowerCase().includes(low)
    );
  }, [availableProducts, productSearchQuery]);

  const addProductItem = () => {
    const prod = availableProducts.find(p => p.id === selectedProductId);
    if (!prod) return;
    
    const qty = parseInt(itemQty) || 1;
    if (qty > prod.stock_actual) {
      toast({ title: 'Stock insuficiente', description: `Solo hay ${prod.stock_actual} unidades disponibles.`, variant: 'destructive' });
      return;
    }

    const discount = parseFloat(itemDiscount) || 0;
    const unitPrice = prod.precio_venta_usd;
    const discountedUnitPrice = unitPrice - (unitPrice * (discount / 100));
    
    const newItem = {
      id: `${prod.id}-${Date.now()}`,
      producto_id: prod.id,
      nombre: prod.nombre,
      codigo: prod.codigo || '',
      cantidad: qty,
      precio_unitario: unitPrice,
      descuento: discount,
      precio_final: discountedUnitPrice,
      subtotal_usd: qty * discountedUnitPrice,
      aplica_iva: prod.aplica_iva || false
    };

    setProductItems(prev => [...prev, newItem]);
    setSelectedProductId('');
    setItemQty('1');
    setItemDiscount('0');
  };

  const removeProductItem = (id: string) => {
    setProductItems(prev => prev.filter(it => it.id !== id));
  };
  const totalPaidUsd = paymentSplits.reduce((acc, s) => acc + (s.equivalentUsd || 0), 0);
  const remainingUsd = Math.max(0, totalOperacionUsd - totalPaidUsd);
  const isPaymentValid = remainingUsd < 0.01 && paymentSplits.length > 0;
  
  const getMethodLabel = (m: string) => {
    return BANK_ENTRY_METHOD_LABELS[m as keyof typeof BANK_ENTRY_METHOD_LABELS] || m;
  };

  const paymentOptions = useMemo(() => {
    if (bankAccounts.length === 0) {
      return (concesionario?.configuracion?.metodos_pago || ['Efectivo', 'Zelle']).map(m => ({
        id: m,
        label: getMethodLabel(m),
        type: 'standard' as const,
        method: m,
        accountId: undefined
      }));
    }

    const standardOptions: { id: string, label: string, type: 'standard' | 'account', method?: string, accountId?: string }[] = [];
    const specificOptions: { id: string, label: string, type: 'standard' | 'account', method?: string, accountId?: string }[] = [];
    const standardMethods = new Set<string>();

    bankAccounts.forEach(acc => {
      if (acc.tipo === 'otro') {
        specificOptions.push({
          id: `acc_${acc.id}`,
          label: acc.nombre,
          type: 'account',
          accountId: acc.id,
          method: Object.keys(acc.metodos_entrada || {}).find(m => acc.metodos_entrada[m as keyof typeof acc.metodos_entrada])
        });
      } else if (acc.metodos_entrada) {
        Object.entries(acc.metodos_entrada).forEach(([m, enabled]) => {
          if (enabled) standardMethods.add(m);
        });
      }
    });

    const order = ['pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_fisico'];
    order.forEach(m => {
      if (standardMethods.has(m)) {
        standardOptions.push({
          id: m,
          label: getMethodLabel(m),
          type: 'standard',
          method: m,
          accountId: undefined
        });
      }
    });

    // Add remaining standard methods
    Array.from(standardMethods).forEach(m => {
      if (!order.includes(m)) {
        standardOptions.push({
          id: m,
          label: getMethodLabel(m),
          type: 'standard',
          method: m,
          accountId: undefined
        });
      }
    });

    return [...standardOptions, ...specificOptions];
  }, [bankAccounts, concesionario?.configuracion?.metodos_pago]);

  // Process option selection
  const handleSelectOption = (optionId: string, targetIndex?: number) => {
    const option = paymentOptions.find(o => o.id === optionId);
    if (!option) return;

    if (option.type === 'account') {
      const acc = bankAccounts.find(a => a.id === option.accountId);
      if (!acc) return;
      const method = option.method || 'transferencia';
      
      if (targetIndex !== undefined) {
        const newSplits = [...paymentSplits];
        const currentAmount = newSplits[targetIndex]?.amount || 0;
        newSplits[targetIndex] = calculateSplit(method, currentAmount, effectiveTasa, acc.id, acc.nombre, acc.moneda as 'USD' | 'VES');
        setPaymentSplits(newSplits);
      } else {
        handleSetFullPayment(method, acc.id, acc.nombre, acc.moneda as 'USD' | 'VES');
      }
    } else {
      triggerMethodSelection(option.method!, targetIndex);
    }
  };

  // Currency logic helpers - EXCLUDE 'otro' accounts from standard check
  const isMethodDivisa = (method: string) => {
    const matchingAccounts = bankAccounts.filter(a => 
      a.tipo !== 'otro' && 
      a.metodos_entrada?.[method as keyof typeof a.metodos_entrada]
    );
    if (matchingAccounts.length > 0) {
      // If any matching account is USD, treat the method as Divisa
      return matchingAccounts.some(a => a.moneda === 'USD');
    }
    // Fallback to legacy config
    const legacyDivisas = concesionario?.configuracion?.metodos_pago_divisa || [];
    return legacyDivisas.includes(method);
  };

  const calculateSplit = (method: string, amount: number, rate: number, accountId?: string, accountName?: string, overrideCurrency?: 'USD' | 'VES'): PaymentSplit => {
    let isUSD = false;
    if (overrideCurrency) {
      isUSD = overrideCurrency === 'USD';
    } else if (accountId) {
      const acc = bankAccounts.find(a => a.id === accountId);
      isUSD = acc ? acc.moneda === 'USD' : isMethodDivisa(method);
    } else {
      isUSD = isMethodDivisa(method);
    }

    return {
      method,
      currency: isUSD ? 'USD' : 'VES',
      amount: amount,
      exchangeRate: rate,
      equivalentUsd: isUSD ? amount : amount / rate,
      igtfAmount: 0,
      accountId,
      accountName
    };
  };

  const handleAddSplit = () => {
    setMethodSelectModalOpen(true);
  };

  const handleUpdateSplit = (i: number, field: keyof PaymentSplit, val: any) => {
    const newSplits = [...paymentSplits];
    const current = newSplits[i] || calculateSplit(val, 0, effectiveTasa); // Fallback for new splits
    let method = current.method;
    let amount = current.amount;
    let overrideCurrency = current.currency as 'USD' | 'VES';
    if (field === 'method') {
      method = val;
      const isWasUSD = current.currency === 'USD';
      const isNowUSD = isMethodDivisa(val);
      if (isWasUSD && !isNowUSD) amount = amount * effectiveTasa;
      else if (!isWasUSD && isNowUSD) amount = amount / effectiveTasa;
      overrideCurrency = isNowUSD ? 'USD' : 'VES';
    }
    if (field === 'amount') amount = Number(val);
    newSplits[i] = calculateSplit(method, amount, effectiveTasa, current.accountId, current.accountName, overrideCurrency);
    setPaymentSplits(newSplits);
  };

  // Pre-process method selection to check for bank accounts
  const triggerMethodSelection = (method: string, targetIndex?: number) => {
    const matchingAccounts = bankAccounts.filter(a => a.metodos_entrada?.[method as keyof typeof a.metodos_entrada] && a.activa);
    
    if (matchingAccounts.length === 1) {
      // Auto-select if only 1 matching account
      if (targetIndex !== undefined) {
        const newSplits = [...paymentSplits];
        const currentAmount = newSplits[targetIndex]?.amount || 0;
        newSplits[targetIndex] = calculateSplit(method, currentAmount, effectiveTasa, matchingAccounts[0].id, matchingAccounts[0].nombre, matchingAccounts[0].moneda as 'USD' | 'VES');
        setPaymentSplits(newSplits);
      } else {
        handleSetFullPayment(method, matchingAccounts[0].id, matchingAccounts[0].nombre, matchingAccounts[0].moneda as 'USD' | 'VES');
      }
    } else if (matchingAccounts.length > 1) {
      // Open modal to choose account
      setAccountSelectMethod(method);
      setAccountSelectSplitIndex(targetIndex === undefined ? null : targetIndex);
      setAccountSelectModalOpen(true);
    } else {
      // No accounts (or legacy), just proceed normally
      if (targetIndex !== undefined) {
        handleUpdateSplit(targetIndex, 'method', method);
      } else {
        handleSetFullPayment(method);
      }
    }
  };

  const handleSetFullPayment = (method: string, accountId?: string, accountName?: string, overrideCurrency?: 'USD' | 'VES') => {
    let isUSD = false;
    if (overrideCurrency) {
      isUSD = overrideCurrency === 'USD';
    } else if (accountId) {
      const acc = bankAccounts.find(a => a.id === accountId);
      isUSD = acc ? acc.moneda === 'USD' : isMethodDivisa(method);
    } else {
      isUSD = isMethodDivisa(method);
    }
    
    if (tipoDocumento === 'factura_fiscal') {
      const baseFiscalDebt = negotiatedPrice * 1.16;
      if (isUSD) {
        const totalToPay = baseFiscalDebt / 0.97;
        setPaymentSplits([calculateSplit(method, totalToPay, effectiveTasa, accountId, accountName, overrideCurrency)]);
      } else {
        const amountVES = baseFiscalDebt * effectiveTasa;
        setPaymentSplits([calculateSplit(method, amountVES, effectiveTasa, accountId, accountName, overrideCurrency)]);
      }
    } else {
      const amount = isUSD ? negotiatedPrice : negotiatedPrice * effectiveTasa;
      setPaymentSplits([calculateSplit(method, amount, effectiveTasa, accountId, accountName, overrideCurrency)]);
    }
  };

  const handleRemoveSplit = (i: number) => {
    setPaymentSplits(paymentSplits.filter((_, idx) => idx !== i));
  };

  // Load clients
  useEffect(() => {
    if (step === 'cliente' && concesionarioId) {
      const fetchClients = async () => {
        setIsLoadingClients(true);
        try {
          const q = query(collection(firestore, 'concesionarios', concesionarioId, 'clientes'));
          const snap = await getDocs(q);
          setExistingClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); } finally { setIsLoadingClients(false); }
      };
      fetchClients();
    }
  }, [step, concesionarioId]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return existingClients;
    const low = clientSearchQuery.toLowerCase();
    return existingClients.filter(c =>
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(low) ||
      (c.cedula_rif || '').toLowerCase().includes(low) ||
      (c.telefono || '').toLowerCase().includes(low)
    );
  }, [existingClients, clientSearchQuery]);

  const handleSelectClient = (client: any) => {
    setCompradorId(client.id);
    setCompradorNombre(client.nombre || '');
    setCompradorApellido(client.apellido || '');
    setCompradorCedula(client.cedula_rif || '');
    setCompradorTelefono(client.telefono || '');
    setCompradorEmail(client.email || '');
    setClientSearchQuery('');
  };

  // Step 6 - Success
  const [isSaving, setIsSaving] = useState(false);
  const [numFactura, setNumFactura] = useState('');
  const [numControl, setNumControl] = useState('');
  const [ventaFecha, setVentaFecha] = useState<Date>(new Date());
  // Step 7 - Docs
  const [printDoc, setPrintDoc] = useState<'factura' | 'contrato' | 'acta' | null>(null);

  const selectedVehicle = useMemo(() => availableVehicles.find(v => v.id === selectedVehicleId), [availableVehicles, selectedVehicleId]);
  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return availableVehicles;
    return availableVehicles.filter(v => {
      const placa = v.placa || v.info_extra?.placa || '';
      return `${v.make} ${v.model} ${placa}`.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [availableVehicles, searchQuery]);

  const negotiationInfo = useMemo(() => {
    if (!selectedVehicle) return null;
    const totalCost = (selectedVehicle.costo_compra || 0) + (selectedVehicle.gastos_adecuacion || []).reduce((a, g) => a + (g.monto || 0), 0);
    const currentPrice = Number(precioVenta) || 0;
    const minMargin = (concesionario?.configuracion.margen_minimo || 0) / 100;

    const v = vendedorId ? staffList.find(s => s.id === vendedorId) : null;
    const commType = v?.commission_type || 'total_price';
    const commPercentage = v?.commission_percentage ?? concesionario?.configuracion.estructura_comision ?? 0;
    const sellerComRate = commPercentage / 100;

    let minPriceForMargin = 0;
    if (commType === 'total_price') {
      minPriceForMargin = totalCost === 0 ? 0 : (totalCost * (1 + minMargin)) / (1 - sellerComRate);
    } else {
      minPriceForMargin = totalCost * (1 + minMargin);
    }

    const breakEvenPrice = totalCost;

    let status: 'ok' | 'low' | 'very_low' | 'critical' = 'ok';
    let message = '';
    if (currentPrice > 0) {
      if (currentPrice < breakEvenPrice) { status = 'critical'; message = '¡ALERTA!: Precio genera pérdida total'; }
      else if (currentPrice < minPriceForMargin) {
        const d = (minPriceForMargin - currentPrice) / minPriceForMargin;
        status = d > 0.05 ? 'very_low' : 'low';
        message = d > 0.05 ? 'Precio muy bajo (supera límite de margen)' : 'Precio bajo (cerca del límite de margen)';
      }
    }
    return { totalCost, minPriceForMargin, breakEvenPrice, status, message };
  }, [selectedVehicle, precioVenta, concesionario, vendedorId, staffList]);

  const needsAuth = useMemo(() => {
    if (!negotiationInfo) return false;
    return (negotiationInfo.status === 'critical' || negotiationInfo.status === 'very_low') && currentRole !== 'dueno' && currentRole !== 'encargado';
  }, [negotiationInfo, currentRole]);

  // Load vehicles and products
  useEffect(() => {
    if (!open || !concesionarioId) return;
    const fetchData = async () => {
      setIsLoadingVehicles(true);
      try {
        const qVehicles = query(collection(firestore, 'concesionarios', concesionarioId, 'inventario'), where('estado_stock', '!=', 'vendido'));
        const snapVehicles = await getDocs(qVehicles);
        setAvailableVehicles(snapVehicles.docs.map(d => ({ id: d.id, ...d.data() } as StockVehicle)));

        const qProducts = query(collection(firestore, 'concesionarios', concesionarioId, 'productos'));
        const snapProducts = await getDocs(qProducts);
        setAvailableProducts(snapProducts.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); } finally { setIsLoadingVehicles(false); }
    };
    fetchData();
    resetAll();

    if (preInvoice) {
      setTipoVenta(preInvoice.item_tipo);
      if (preInvoice.item_tipo === 'vehiculo') {
        setSelectedVehicleId(preInvoice.item_id);
        setPrecioVenta(preInvoice.precio_negociado);
      } else {
        // Handle pre-invoice for products if needed
      }
      setVendedorId(preInvoice.vendedor_id);
      setStep('cliente'); // Redirect to client step as requested
    } else {
      if (currentRole === 'vendedor' && staff) setVendedorId(staff.id);
    }
  }, [open, concesionarioId, preInvoice]);

  const resetAll = () => {
    setStep('tipo'); setTipoVenta(null); setSelectedVehicleId(''); setPrecioVenta(''); setVendedorId('');
    setSearchQuery(''); setAuthGranted(false); setAuthModalOpen(false); setAuthPin(['', '', '', '']); setAuthUserId('');
    setParteDePago(false); setCompradorNombre(''); setCompradorCedula(''); setCompradorTelefono('');
    setPaymentSplits([]); setRegistrarCaja(true); setTipoDocumento('nota_entrega'); setDocsAlerta(false);
    setNumFactura(''); setNumControl(''); setPrintDoc(null); setClientMode('cargar'); setClientSearchQuery('');
    setPaymentMode('completo'); setProductItems([]); setProductSearchQuery(''); setSelectedProductId('');
  };

  const handleNext = () => {
    if (step === 'tipo') { 
      if (tipoVenta === 'vehiculo') setStep('vehiculo');
      else if (tipoVenta === 'producto') setStep('productos');
    }
    else if (step === 'vehiculo') {
      if (!selectedVehicleId) return;
      setStep('precio');
    }
    else if (step === 'productos') {
      if (productItems.length === 0) { toast({ title: 'Agrega al menos un producto', variant: 'destructive' }); return; }
      // Skipping Seller and Client steps for products
      setStep('pago');
    }
    else if (step === 'precio') {
      if (!vendedorId) { toast({ title: 'Vendedor requerido', variant: 'destructive' }); return; }
      if (!precioVenta) { toast({ title: 'Precio requerido', variant: 'destructive' }); return; }
      if (needsAuth && !authGranted) { setAuthModalOpen(true); return; }
      if (parteDePago) { toast({ title: 'Opción bloqueada', description: 'Desactiva "Vehículo como Parte de Pago" para continuar.', variant: 'destructive' }); return; }
      setStep('cliente');
    }
    else if (step === 'cliente') {
      if (!compradorNombre || !compradorCedula || !compradorTelefono) {
        toast({ title: 'Datos faltantes', description: 'Nombre, Cédula y Teléfono son obligatorios.', variant: 'destructive' }); return;
      }
      const hasSerial = !!(selectedVehicle?.info_extra?.serial_carroceria && selectedVehicle?.info_extra?.serial_motor);
      setDocsAlerta(!hasSerial);
      setStep('pago');
    }
  };

  const handleBack = () => {
    if (step === 'vehiculo' || step === 'productos') setStep('tipo');
    else if (step === 'precio') setStep('vehiculo');
    else if (step === 'cliente' && !preInvoice) setStep('precio');
    else if (step === 'pago') {
      if (tipoVenta === 'producto') setStep('productos');
      else setStep('cliente');
    }
    else if (step === 'documentos') setStep('exito');
  };

  const handleVerifyPin = async () => {
    const pin = authPin.join('');
    if (pin.length !== 4) { toast({ title: 'PIN inválido', description: 'Ingresa 4 dígitos.', variant: 'destructive' }); return; }
    const s = staffList.find(x => x.id === authUserId);
    if (!s) { toast({ title: 'Selecciona un usuario', variant: 'destructive' }); return; }
    setIsVerifyingPin(true);
    try {
      const ok = await verifySHA256(pin, s.pin_hash);
      if (ok) {
        setAuthGranted(true); setAuthModalOpen(false);
        toast({ title: '✓ Autorización concedida', description: `Autorizado por ${s.nombre}.` });
        setStep('cliente');
      } else {
        toast({ title: 'PIN incorrecto', variant: 'destructive' });
        setAuthPin(['', '', '', '']); pinRefs[0].current?.focus();
      }
    } catch { toast({ title: 'Error', variant: 'destructive' }); } finally { setIsVerifyingPin(false); }
  };

  const handlePinInput = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const p = [...authPin]; p[i] = val; setAuthPin(p);
    if (val && i < 3) pinRefs[i + 1].current?.focus();
  };

  const handleSubmit = async () => {
    if (tipoVenta === 'vehiculo' && (!selectedVehicleId || !compradorNombre || !precioVenta || !isPaymentValid || !vendedorId || !concesionario)) {
      toast({ title: 'Faltan datos', description: 'Completa todos los campos obligatorios para la venta del vehículo.', variant: 'destructive' }); return;
    }
    if (tipoVenta === 'producto' && (productItems.length === 0 || !isPaymentValid || !concesionario)) {
      toast({ title: 'Faltan datos', description: 'Agrega productos y completa el pago para continuar.', variant: 'destructive' }); return;
    }

    setIsSaving(true);
    try {
      const { runTransaction, increment } = await import('firebase/firestore');
      
      // Basic info for any sale type
      const vStaff = vendedorId ? staffList.find(s => s.id === vendedorId) : staff;
      const vendedorNombre = vStaff?.nombre || 'Venta de Mostrador';
      const salePrice = negotiatedPrice;
      const metodoPagoStr = paymentSplits.map(s => s.method).join(', ');
      const totalIgtf = paymentSplits.reduce((acc, s) => acc + (s.igtfAmount || 0), 0);
      
      let cId = compradorId;
      const clientsRef = collection(firestore, 'concesionarios', concesionarioId, 'clientes');

      // Use a default client name if none provided for products
      const finalCompradorNombre = compradorNombre || (tipoVenta === 'producto' ? 'Consumidor Final' : '');
      const finalCompradorApellido = compradorApellido || '';

      if (!cId && compradorCedula) {
        const q = query(clientsRef, where('cedula_rif', '==', compradorCedula));
        const snap = await getDocs(q);
        if (!snap.empty) cId = snap.docs[0].id;
      }

      const now = new Date();
      let finalFacN = '';
      let finalCtrlN = '';

      await runTransaction(firestore, async (transaction) => {
        // --- 1. ALL READS FIRST ---
        const concRef = doc(firestore, 'concesionarios', concesionarioId);
        const concSnap = await transaction.get(concRef);
        const lastNum = (concSnap.data()?.configuracion?.ultimo_numero_factura_ventas || 0) as number;
        const next = lastNum + 1;
        finalFacN = padNum(next, 7);
        finalCtrlN = `00-${padNum(next, 7)}`;

        let clientSnap = null;
        if (cId) {
          const clientRef = doc(firestore, 'concesionarios', concesionarioId, 'clientes', cId);
          clientSnap = await transaction.get(clientRef);
        }

        const bankSnaps: Record<string, any> = {};
        for (const split of paymentSplits) {
          if (split.accountId && !bankSnaps[split.accountId]) {
            const accRef = doc(firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', split.accountId);
            const accSnap = await transaction.get(accRef);
            if (accSnap.exists()) bankSnaps[split.accountId] = accSnap.data();
          }
        }

        // --- 2. ALL WRITES SECOND ---
        const saleDocRef = doc(collection(firestore, 'concesionarios', concesionarioId, 'ventas'));
        
        let ventaData: any = {
          comprador_id: cId || '',
          comprador_nombre: `${finalCompradorNombre} ${finalCompradorApellido}`.trim(),
          comprador_telefono: compradorTelefono || '',
          comprador_cedula: compradorCedula || '',
          vendedor_staff_id: vendedorId || staff?.id || '',
          vendedor_nombre: vendedorNombre,
          precio_venta: salePrice,
          metodo_pago: metodoPagoStr,
          pagos_combinados: paymentSplits,
          igtf_total: totalIgtf,
          fecha: serverTimestamp(),
          tipo_venta: tipoVenta,
          tipo_documento_emitido: tipoDocumento,
          numero_factura_venta: finalFacN,
          numero_control_venta: finalCtrlN,
          iva_total: ivaAmount,
          total_con_impuestos: totalOperacionUsd
        };

        if (tipoVenta === 'vehiculo') {
          const vehicle = selectedVehicle!;
          let commRate = vStaff?.commission_percentage ?? concesionario?.configuracion.estructura_comision ?? 0;
          const comision = (salePrice * commRate) / 100;
          const totalBasis = (vehicle.costo_compra || 0) + (vehicle.gastos_adecuacion || []).reduce((a, g) => a + (g.monto || 0), 0);
          const gananciaNeta = vehicle.es_consignacion
            ? (vehicle.consignacion_info?.comision_acordada || 0) / 100 * salePrice - comision
            : salePrice - totalBasis - comision;

          ventaData = {
            ...ventaData,
            vehiculo_id: vehicle.id,
            vehiculo_nombre: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.placa ? ` (${vehicle.placa})` : ''}`,
            comision_vendedor: comision,
            ganancia_neta: gananciaNeta,
            vehiculo_info: {
              make: vehicle.make, model: vehicle.model, year: vehicle.year, placa: vehicle.placa || vehicle.info_extra?.placa || '',
              exteriorColor: vehicle.exteriorColor || '', serial_carroceria: vehicle.info_extra?.serial_carroceria || '', serial_motor: vehicle.info_extra?.serial_motor || '',
              clase: vehicle.info_extra?.clase || '', tipo: vehicle.info_extra?.tipo || '', mileage: vehicle.mileage || 0,
            },
          };

          transaction.update(doc(firestore, 'concesionarios', concesionarioId, 'inventario', vehicle.id), {
            estado_stock: 'vendido',
            fecha_venta: serverTimestamp(),
            updated_at: serverTimestamp()
          });
        } else {
          // Product specific writes
          ventaData.items = productItems;
          ventaData.descripcion_resumen = `${productItems.length} Producto(s): ${productItems.slice(0, 2).map(i => i.nombre).join(', ')}${productItems.length > 2 ? '...' : ''}`;
          
          productItems.forEach(it => {
            const prodRef = doc(firestore, 'concesionarios', concesionarioId, 'productos', it.producto_id);
            transaction.update(prodRef, {
              stock_actual: increment(-it.cantidad),
              updated_at: serverTimestamp()
            });
          });
        }

        // Client handling
        if (cId || compradorCedula) {
          const clientUpdateData: any = {
            nombre: finalCompradorNombre, apellido: finalCompradorApellido, cedula_rif: compradorCedula, telefono: compradorTelefono, email: compradorEmail,
            updated_at: serverTimestamp(), ultima_compra_fecha: serverTimestamp(),
          };

          if (clientSnap) {
            const currentInvertido = clientSnap.data()?.total_invertido || 0;
            const currentCompras = clientSnap.data()?.compras_ids || [];
            transaction.update(doc(firestore, 'concesionarios', concesionarioId, 'clientes', cId!), {
              ...clientUpdateData,
              total_invertido: currentInvertido + salePrice,
              compras_ids: [...currentCompras, saleDocRef.id]
            });
          } else if (compradorCedula) {
            const newClientRef = doc(collection(firestore, 'concesionarios', concesionarioId, 'clientes'));
            cId = newClientRef.id;
            ventaData.comprador_id = cId;
            transaction.set(newClientRef, {
              ...clientUpdateData,
              total_invertido: salePrice,
              compras_ids: [saleDocRef.id],
              tags: [tipoVenta === 'vehiculo' ? 'Comprador de Carros' : 'Comprador de Repuestos'],
              created_at: serverTimestamp()
            });
          }
        }

        // Bank updates
        const bankFinalUpdates: Record<string, { nextSaldo: number, prevSaldo: number }> = {};
        for (const split of paymentSplits) {
          if (split.accountId && bankSnaps[split.accountId]) {
            if (!bankFinalUpdates[split.accountId]) {
              bankFinalUpdates[split.accountId] = { 
                prevSaldo: bankSnaps[split.accountId].saldo_actual || 0,
                nextSaldo: bankSnaps[split.accountId].saldo_actual || 0 
              };
            }
            const current = bankFinalUpdates[split.accountId];
            const splitPrevSaldo = current.nextSaldo;
            current.nextSaldo += split.amount;

            const txRef = doc(collection(firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', split.accountId, 'transacciones'));
            transaction.set(txRef, {
              cuenta_id: split.accountId, tipo: 'ingreso_venta', flujo: 'entrada', monto: split.amount, metodo_pago: split.method,
              concepto: `Venta (${tipoVenta}): ${ventaData.vehiculo_nombre || 'Productos'} (Fac. ${finalFacN})`,
              registrado_por_id: staff?.id || 'admin', registrado_por_nombre: staff?.nombre || 'Administrador',
              saldo_anterior: splitPrevSaldo, saldo_posterior: current.nextSaldo, fecha: serverTimestamp(), venta_id: saleDocRef.id
            });
          }
        }

        for (const [accId, updates] of Object.entries(bankFinalUpdates)) {
          transaction.update(doc(firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', accId), {
            saldo_actual: updates.nextSaldo, updated_at: serverTimestamp()
          });
        }

        transaction.set(saleDocRef, ventaData);
        transaction.update(concRef, { 'configuracion.ultimo_numero_factura_ventas': next });

        if (registrarCaja && staff) {
          transaction.set(doc(collection(firestore, 'concesionarios', concesionarioId, 'caja')), {
            tipo: 'ingreso', monto: salePrice, 
            descripcion: `Venta (${tipoVenta}): ${ventaData.vehiculo_nombre || ventaData.descripcion_resumen}`,
            metodo_pago: metodoPagoStr, cajero_staff_id: staff.id, cajero_nombre: staff.nombre, fecha: serverTimestamp(), venta_id: saleDocRef.id
          });
        }
      });

      if (preInvoice?.id) await import('firebase/firestore').then(m => m.deleteDoc(doc(firestore, 'concesionarios', concesionarioId, 'pre_invoices', preInvoice.id)));

      setNumFactura(finalFacN); setNumControl(finalCtrlN); setVentaFecha(now);
      setStep('exito'); onSave();
    } catch (e: any) {
      console.error('Error in sale transaction:', e);
      toast({ title: 'Error al registrar venta', description: e.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const handlePrintDoc = (doc: 'factura' | 'contrato' | 'acta') => {
    setPrintDoc(doc);
    setTimeout(() => {
      const el = document.getElementById('sale-print-root');
      if (el) { el.style.display = 'block'; window.print(); el.style.display = 'none'; }
    }, 250);
  };

  const handleDownloadDoc = async (docType: 'factura' | 'contrato' | 'acta') => {
    setPrintDoc(docType);
    await new Promise(r => setTimeout(r, 350));
    const el = document.getElementById('sale-print-root');
    if (!el) return;
    el.style.display = 'block'; el.style.position = 'fixed'; el.style.top = '0px'; el.style.left = '-99999px'; el.style.zIndex = '-9999';
    try {
      const targetEl = el.querySelector(`#sale-doc-${docType}`) as HTMLElement;
      if (!targetEl) return;
      const A4W = Math.round(210 * 96 / 25.4), A4H = Math.round(297 * 96 / 25.4), SCALE = 2;
      const html2c = (await import('html2canvas')).default;
      const canvas = await html2c(targetEl, { scale: SCALE, useCORS: true, allowTaint: true, logging: false, scrollX: 0, scrollY: 0, width: A4W, height: A4H, windowWidth: A4W, windowHeight: A4H });
      const cropped = document.createElement('canvas');
      cropped.width = A4W * SCALE; cropped.height = A4H * SCALE;
      const ctx = cropped.getContext('2d');
      ctx?.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, A4W * SCALE, A4H * SCALE);
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      pdf.addImage(cropped.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
      const names = { factura: `Factura_${numFactura}`, contrato: `Contrato_${numFactura}`, acta: `Acta_Entrega_${numFactura}` };
      pdf.save(`${names[docType]}.pdf`);
    } catch (e) { console.error(e); }
    finally { el.style.display = 'none'; el.style.position = 'absolute'; el.style.top = '0'; el.style.left = '0'; el.style.zIndex = '9999'; }
  };

  const ventaDataForDocs = selectedVehicle ? {
    compradorNombre, compradorCedula, compradorTelefono, metodoPago: paymentSplits.map(s => s.method).join(', '),
    precioVenta: Number(precioVenta), numFactura, numControl, tipoDocumento, esDivisa: paymentSplits.some(s => s.currency === 'USD' && isMethodDivisa(s.method)),
    vendedorNombre: staffList.find(s => s.id === vendedorId)?.nombre || '',
    fecha: ventaFecha,
    vehiculo: {
      make: selectedVehicle.make, model: selectedVehicle.model, year: selectedVehicle.year,
      placa: selectedVehicle.placa || selectedVehicle.info_extra?.placa || '',
      exteriorColor: selectedVehicle.exteriorColor || '',
      serial_carroceria: selectedVehicle.info_extra?.serial_carroceria || '',
      serial_motor: selectedVehicle.info_extra?.serial_motor || '',
      clase: selectedVehicle.info_extra?.clase || '', tipo: selectedVehicle.info_extra?.tipo || '',
      mileage: selectedVehicle.mileage || 0,
    },
    precioEnLetras: numberToWords(Number(precioVenta)),
  } : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2rem]">
          {/* Header */}
          <div className="bg-primary/5 p-5 border-b flex-shrink-0">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-headline flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5 text-primary" /> Registrar Venta
              </DialogTitle>
              <DialogDescription>Asistente de cierre de negocio</DialogDescription>
            </DialogHeader>
            {/* Step indicators */}
            {step !== 'exito' && (
              <div className="flex items-center gap-1">
                {(['tipo', 'vehiculo', 'precio', 'cliente', 'pago', 'documentos'] as WizardStep[]).map((s, i) => {
                  const wizardFlow = ['tipo', 'vehiculo', 'precio', 'cliente', 'pago', 'documentos'];
                  const idx = wizardFlow.indexOf(step);
                  const done = i < idx;
                  const active = s === step;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all", active && "bg-primary text-white shadow-md shadow-primary/30", done && "bg-primary/20 text-primary", !active && !done && "bg-muted text-muted-foreground")}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span className={cn("text-[11px] hidden sm:block", active ? "text-primary font-semibold" : "text-muted-foreground")}>{STEP_LABELS[s]}</span>
                      {i < 5 && <div className={cn("h-px w-2 sm:w-4", done ? "bg-primary/40" : "bg-muted")} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ═══ STEP 1: TIPO ═══ */}
            {step === 'tipo' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="font-semibold text-lg">¿Qué deseas vender?</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'vehiculo', label: 'Vehículo', icon: Car, color: 'blue', available: true },
                    { id: 'producto', label: 'Producto / Repuesto', icon: Package, color: 'gray', available: true },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTipoVenta(opt.id as any)}
                      className={cn(
                        "relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 text-center",
                        tipoVenta === opt.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-transparent bg-muted/40 hover:bg-muted/70"
                      )}
                    >
                      <opt.icon className={cn("h-12 w-12", tipoVenta === opt.id ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-semibold text-base">{opt.label}</span>
                      {tipoVenta === opt.id && <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ STEP 2: PRODUCTOS ═══ */}
            {step === 'productos' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Selección de Productos</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-2xl border">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Buscar Producto</Label>
                    <div className="relative" ref={productDropdownRef}>
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full h-10 px-3 text-sm justify-between font-normal text-left bg-white border-slate-200 rounded-lg shadow-sm"
                        onClick={() => setProductSearchOpen(!productSearchOpen)}
                      >
                        <span className="truncate flex items-center gap-2">
                          {selectedProductId ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              {availableProducts.find((p) => p.id === selectedProductId)?.nombre}
                            </>
                          ) : (
                            "Busca o elige un producto..."
                          )}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 opacity-50 shrink-0 transition-transform duration-300", productSearchOpen && "rotate-180")} />
                      </Button>

                      {productSearchOpen && (
                        <div
                          className="absolute top-full left-0 w-full z-[100] mt-1 bg-white text-popover-foreground rounded-xl border border-slate-200 shadow-xl animate-in fade-in-0 zoom-in-95 overflow-hidden"
                        >
                          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                ref={productInputRef}
                                placeholder="Escribe nombre o código..."
                                value={productSearchQuery}
                                onChange={(e) => setProductSearchQuery(e.target.value)}
                                className="pl-8 h-8 text-xs bg-white border-slate-200 focus-visible:ring-primary/20 rounded-lg"
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setProductSearchOpen(false);
                                }}
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[220px]">
                            <div className="p-1 space-y-0.5">
                              {filteredAvailableProducts.length === 0 ? (
                                <div className="p-6 text-center space-y-1">
                                  <Search className="h-6 w-6 text-slate-200 mx-auto" />
                                  <p className="text-xs text-slate-400 italic">No se encontraron productos</p>
                                </div>
                              ) : (
                                filteredAvailableProducts.map((p) => (
                                  <Button
                                    key={p.id}
                                    variant="ghost"
                                    disabled={p.stock_actual <= 0}
                                    className={cn(
                                      "w-full justify-start font-normal h-auto py-2 px-3 rounded-lg transition-all duration-200 text-slate-700 hover:text-primary disabled:opacity-50",
                                      selectedProductId === p.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-primary/5"
                                    )}
                                    onClick={() => {
                                      setSelectedProductId(p.id);
                                      setProductSearchOpen(false);
                                      setProductSearchQuery('');
                                    }}
                                  >
                                    <div className="flex items-center gap-3 w-full">
                                      <div className="flex flex-col items-start overflow-hidden flex-1">
                                        <span className="truncate w-full text-left text-xs font-medium">{p.nombre}</span>
                                        <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">{p.codigo || 'SIN CÓDIGO'}</span>
                                      </div>
                                      <div className="flex flex-col items-end shrink-0">
                                        <span className="text-[10px] font-bold text-primary">${Number(p.precio_venta_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <span className={cn("text-[9px] font-medium px-1 rounded", p.stock_actual > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                          {p.stock_actual} disp.
                                        </span>
                                      </div>
                                    </div>
                                  </Button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Cant.</Label>
                    <Input type="number" value={itemQty} onChange={e => setItemQty(e.target.value)} className="bg-white" min="1" />
                  </div>
                  <div className="space-y-1.5 flex items-end">
                    <Button onClick={addProductItem} disabled={!selectedProductId} className="w-full">
                      <Plus className="h-4 w-4 mr-2" /> Añadir
                    </Button>
                  </div>
                </div>

                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr className="text-left text-muted-foreground text-[10px] uppercase font-bold">
                        <th className="p-3">Producto</th>
                        <th className="p-3 text-center">Cant.</th>
                        <th className="p-3 text-right">Precio</th>
                        <th className="p-3 text-right">Subtotal</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {productItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                            No hay productos en la lista
                          </td>
                        </tr>
                      ) : productItems.map(it => (
                        <tr key={it.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-medium">
                            {it.nombre}
                            <div className="text-[10px] text-muted-foreground font-mono">{it.codigo}</div>
                          </td>
                          <td className="p-3 text-center font-bold">{it.cantidad}</td>
                          <td className="p-3 text-right font-mono">${it.precio_final.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-bold text-primary">${it.subtotal_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeProductItem(it.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {productItems.length > 0 && (
                      <tfoot className="bg-primary/5 font-bold border-t">
                        <tr>
                          <td colSpan={3} className="p-3 text-right uppercase text-[10px] align-middle">Total Productos</td>
                          <td className="p-3 text-right">
                            <div className="text-primary font-headline text-lg">
                              ${negotiatedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              ≈ Bs. {(negotiatedPrice * effectiveTasa).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
            {step === 'vehiculo' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Car className="h-5 w-5 text-primary" /> Seleccionar Vehículo</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por marca, modelo o placa..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                  {isLoadingVehicles ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : filteredVehicles.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl"><Car className="h-8 w-8 mx-auto mb-2 opacity-30" />Sin vehículos disponibles</div>
                  ) : filteredVehicles.map(v => (
                    <div key={v.id} onClick={() => { setSelectedVehicleId(v.id); if (v.precio_venta && !precioVenta) setPrecioVenta(v.precio_venta); }}
                      className={cn("flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01]", selectedVehicleId === v.id ? "border-primary bg-primary/5 shadow" : "border-transparent bg-muted/40 hover:bg-muted/60")}>
                      <div className="h-10 w-14 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        {v.images?.[0]?.url ? <img src={v.images[0].url} alt={v.make} className="w-full h-full object-cover" /> : <Car className="h-full w-full p-2 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{v.year} {v.make} {v.model}</p>
                        <p className="text-xs text-muted-foreground font-mono">{v.placa || 'SIN PLACA'}</p>
                      </div>
                      <p className="font-headline text-primary text-sm">${(v.precio_venta || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ STEP 3: PRECIO Y VENDEDOR ═══ */}
            {step === 'precio' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="font-semibold text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Precio y Vendedor</h3>
                {selectedVehicle && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border text-sm mb-4">
                    <Car className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedVehicle.placa || 'SIN PLACA'}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><User className="h-4 w-4" />Vendedor Responsable *</Label>
                    <Select value={vendedorId} onValueChange={setVendedorId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                      <SelectContent>{staffList.filter(s => s.activo).map(s => <SelectItem key={s.id} value={s.id}>{s.nombre} ({ROLE_LABELS[s.rol]})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-widest">Precio Final de Venta ($)</Label>
                    <div className="relative w-full max-w-xs">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/40" />
                      <Input type="number" value={precioVenta} onChange={e => { setPrecioVenta(e.target.value ? Number(e.target.value) : ''); setAuthGranted(false); }}
                        className="h-16 text-3xl text-center font-bold pl-10 rounded-xl border-2 border-primary/20" placeholder="0" />
                    </div>
                  </div>
                  {negotiationInfo?.message && (
                    <div className={cn("p-3 rounded-xl flex items-start gap-2 border text-sm", negotiationInfo.status === 'critical' && "bg-red-50 text-red-800 border-red-200 animate-pulse", negotiationInfo.status === 'very_low' && "bg-orange-50 text-orange-800 border-orange-200", negotiationInfo.status === 'low' && "bg-yellow-50 text-yellow-800 border-yellow-200")}>
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">{negotiationInfo.message}</p>
                        {needsAuth && !authGranted && <p className="text-xs mt-1">Se requiere autorización de un Dueño/Encargado para continuar.</p>}
                        {authGranted && <p className="text-xs mt-1 text-green-700 font-semibold">✓ Precio autorizado</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ STEP 4: CLIENTE ═══ */}
            {step === 'cliente' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="flex gap-2 p-1 bg-muted/40 rounded-2xl border mb-4">
                  {[{ id: 'cargar', label: 'Cargar Cliente', icon: Search }, { id: 'crear', label: 'Crear Nuevo', icon: Plus }].map(m => (
                    <button key={m.id} onClick={() => setClientMode(m.id as any)} className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all", clientMode === m.id ? "bg-white shadow-md text-primary" : "text-muted-foreground hover:bg-muted/50")}>
                      <m.icon className="h-4 w-4" />{m.label}
                    </button>
                  ))}
                </div>
                {clientMode === 'cargar' ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Nombre, cédula o teléfono..." className="pl-9 h-12" value={clientSearchQuery} onChange={e => setClientSearchQuery(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                      {isLoadingClients ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                      ) : filteredClients.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">Sin clientes encontrados</div>
                      ) : filteredClients.map(c => (
                        <div key={c.id} onClick={() => handleSelectClient(c)} className={cn("flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all", compradorId === c.id ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/40 hover:bg-muted/60")}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{c.nombre[0]}{c.apellido?.[0] || ''}</div>
                            <div>
                              <p className="font-bold text-sm">{c.nombre} {c.apellido}</p>
                              <p className="text-xs text-muted-foreground">{c.cedula_rif} • {c.telefono}</p>
                            </div>
                          </div>
                          {compradorId === c.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 rounded-2xl bg-muted/30 border animate-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Nombre *</Label><Input value={compradorNombre} onChange={e => { setCompradorNombre(e.target.value); setCompradorId(''); }} placeholder="María" /></div>
                      <div className="space-y-1.5"><Label>Apellido *</Label><Input value={compradorApellido} onChange={e => { setCompradorApellido(e.target.value); setCompradorId(''); }} placeholder="López" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Cédula / RIF *</Label><Input value={compradorCedula} onChange={e => { setCompradorCedula(e.target.value); setCompradorId(''); }} placeholder="V-00.000.000" /></div>
                      <div className="space-y-1.5"><Label>Teléfono *</Label><Input value={compradorTelefono} onChange={e => { setCompradorTelefono(e.target.value); setCompradorId(''); }} placeholder="0424..." /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Correo Electrónico</Label><Input type="email" value={compradorEmail} onChange={e => { setCompradorEmail(e.target.value); setCompradorId(''); }} placeholder="cliente@email.com" /></div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 5: PAGO Y DOCUMENTACIÓN ═══ */}
            {step === 'pago' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Documentation Selector */}
                <div className="flex gap-2 p-1 bg-muted/40 rounded-2xl border mb-4">
                  {[{ id: 'nota_entrega', label: 'Nota de Entrega', icon: FileText }, { id: 'factura_fiscal', label: 'Factura Fiscal', icon: Receipt }].map(m => (
                    <button key={m.id} onClick={() => setTipoDocumento(m.id as any)} className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all", tipoDocumento === m.id ? "bg-white shadow-md text-primary" : "text-muted-foreground hover:bg-muted/50")}>
                      <m.icon className="h-4 w-4" />{m.label}
                    </button>
                  ))}
                </div>

                {/* Exchange Rate */}
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-primary/5 border-2 border-primary/20 shadow-sm">
                  <div className="flex-1">
                    <Label className="text-xs font-bold uppercase text-primary flex items-center gap-1.5 mb-1">
                      <RefreshCw className={cn("h-3 w-3", isTasaLoading && "animate-spin")} /> Tasa de Cambio (BCV)
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-muted-foreground bg-muted px-2 py-1 rounded">Bs/USD</span>
                      <Input 
                        type="number" 
                        value={customTasaBcv || ''} 
                        onChange={e => setCustomTasaBcv(parseFloat(e.target.value) || 0)} 
                        className="h-9 w-32 text-sm font-bold border-primary/30 bg-white focus-visible:ring-primary shadow-inner" 
                        placeholder="Ej: 36.50"
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Equivalencia Total</p>
                    <p className="text-base font-bold text-primary">Bs. {(totalOperacionUsd * effectiveTasa).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* Payment Totals */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border text-center flex flex-col justify-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Operación</p>
                    <p className="text-2xl font-headline text-primary">${totalOperacionUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    
                    {tipoDocumento === 'factura_fiscal' && (
                      <div className="mt-2 pt-2 border-t border-muted-foreground/10 space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Gravable:</span>
                          <span className="font-mono">${negotiatedPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">IVA (16%):</span>
                          <span className="font-mono">${ivaAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">IGTF (3% Divisas):</span>
                          <span className={cn("font-mono", igtfAmount > 0 ? "text-amber-600 font-bold" : "")}>
                            ${igtfAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/30 border text-center flex flex-col justify-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      {totalPaidUsd > (totalOperacionUsd + 0.01) ? 'Vuelto a entregar' : 'Saldo Restante'}
                    </p>
                    <p className={cn("text-2xl font-headline transition-colors", totalPaidUsd > (totalOperacionUsd + 0.01) ? "text-red-600 font-bold" : remainingUsd > 0.01 ? "text-amber-500" : "text-green-600")}>
                      ${Math.abs(totalOperacionUsd - totalPaidUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      ≈ Bs. {Math.abs((totalOperacionUsd - totalPaidUsd) * effectiveTasa).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                  {/* Payment Mode Selector */}
                <div className="flex gap-2 mb-2">
                  {[{ id: 'completo', label: 'Pago Completo', icon: Wallet }, { id: 'combinado', label: 'Pago Combinado', icon: LayoutGrid }].map(m => (
                    <Button key={m.id} variant={paymentMode === m.id ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => {
                      setPaymentMode(m.id as any);
                      if (m.id === 'completo') {
                        const defaultOpt = paymentOptions[0];
                        const defaultMethod = defaultOpt?.method || 'Efectivo';
                        if (defaultOpt?.type === 'account') {
                          handleSetFullPayment(defaultMethod, defaultOpt.accountId, defaultOpt.label, bankAccounts.find(a => a.id === defaultOpt.accountId)?.moneda as 'USD' | 'VES');
                        } else {
                          const defaultMatches = bankAccounts.filter(a => a.metodos_entrada?.[defaultMethod as keyof typeof a.metodos_entrada] && a.activa);
                          if (defaultMatches.length === 1) {
                            handleSetFullPayment(defaultMethod, defaultMatches[0].id, defaultMatches[0].nombre, defaultMatches[0].moneda as 'USD' | 'VES');
                          } else {
                            handleSetFullPayment(defaultMethod);
                          }
                        }
                      } else { setPaymentSplits([]); }
                    }}>
                      <m.icon className="h-4 w-4" />{m.label}
                    </Button>
                  ))}
                </div>

                {/* Combined Payment Interface */}
                <div className="space-y-3">
                  {paymentMode === 'completo' && (
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                      <Label className="text-xs font-bold text-primary uppercase">Seleccionar Método de Pago</Label>
                      
                      {/* Grid of options using paymentOptions */}
                      <div className="grid grid-cols-2 gap-2">
                        {paymentOptions.map(opt => (
                          <button 
                            key={opt.id} 
                            onClick={() => handleSelectOption(opt.id)}
                            className={cn(
                              "p-3 rounded-lg border text-sm font-medium transition-all text-left flex flex-col", 
                              (paymentSplits[0]?.accountId === opt.accountId && opt.type === 'account') || 
                              (paymentSplits[0]?.method === opt.method && opt.type === 'standard')
                                ? "bg-primary text-white border-primary shadow-md" 
                                : "bg-white hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            <span className={cn("text-[10px]", 
                              (paymentSplits[0]?.accountId === opt.accountId && opt.type === 'account') || 
                              (paymentSplits[0]?.method === opt.method && opt.type === 'standard')
                                ? "text-white/80" 
                                : "text-muted-foreground"
                            )}>
                              {opt.type === 'account' ? 'Cuenta Específica' : 'Método Estándar'}
                            </span>
                            {paymentSplits[0]?.method === opt.method && paymentSplits[0]?.accountName && opt.type === 'standard' && (
                              <span className="text-[9px] truncate font-bold text-white mt-1 border-t border-white/20 pt-1">
                                {paymentSplits[0].accountName}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {paymentSplits.map((split, i) => (
                    <div key={i} className="p-3 rounded-xl bg-card border animate-in zoom-in-95 space-y-2">
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] uppercase">Método</Label>
                          <Select 
                            value={
                              paymentOptions.find(o => o.accountId === split.accountId)?.id || 
                              paymentOptions.find(o => o.method === split.method)?.id || 
                              ""
                            } 
                            onValueChange={v => handleSelectOption(v, i)}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {paymentOptions.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32 space-y-1">
                          <Label className="text-[10px] uppercase">Monto ({split.currency})</Label>
                          <div className="relative">
                            <Input type="number" value={split.amount || ''} onChange={e => handleUpdateSplit(i, 'amount', e.target.value)} className="h-9 font-bold pr-8" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">{split.currency === 'VES' ? 'Bs' : '$'}</span>
                          </div>
                        </div>
                        {paymentMode === 'combinado' && (
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => handleRemoveSplit(i)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                      {split.accountName && (
                        <p className="text-[10px] font-bold text-primary/80 uppercase">{split.accountName}</p>
                      )}
                    </div>
                  ))}

                  {paymentMode === 'combinado' && remainingUsd > 0.01 && (
                    <Button variant="outline" className="w-full border-dashed h-12 gap-2" onClick={handleAddSplit}>
                      <Plus className="h-4 w-4" /> Agregar Método de Pago
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 h-10 border-t pt-4">
                  <Checkbox id="caja" checked={registrarCaja} onCheckedChange={c => setRegistrarCaja(c as boolean)} />
                  <Label htmlFor="caja" className="text-sm font-medium cursor-pointer leading-tight">Registrar ingreso en Caja de Control</Label>
                </div>
              </div>
            )}

            {/* ═══ STEP 6: ÉXITO ═══ */}
            {step === 'exito' && (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center shadow-lg shadow-blue-200/50">
                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                      <circle cx="28" cy="28" r="26" stroke="#2563eb" strokeWidth="3" strokeDasharray="163.4" strokeDashoffset="0" style={{ animation: 'dash 0.6s ease-in-out forwards' }} />
                      <polyline points="16,28 24,36 40,20" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="35" strokeDashoffset="35" style={{ animation: 'checkmark 0.4s 0.4s ease-in-out forwards', fill: 'none' }} />
                    </svg>
                  </div>
                  <style>{`@keyframes checkmark { to { stroke-dashoffset: 0; } } @keyframes dash { from { stroke-dashoffset: 163.4; } to { stroke-dashoffset: 0; } }`}</style>
                </div>
                <h2 className="text-2xl font-bold font-headline mb-1">¡Venta Registrada!</h2>
                <p className="text-muted-foreground mb-6">La transacción se procesó con éxito</p>
                <div className="bg-muted/30 rounded-2xl border p-4 text-left w-full max-w-sm space-y-2 text-sm">
                  {tipoDocumento === 'factura_fiscal' && <div className="flex justify-between"><span className="text-muted-foreground">N° Factura</span><span className="font-mono font-bold">{numFactura}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Vehículo</span><span className="font-medium">{selectedVehicle?.make} {selectedVehicle?.model}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{compradorNombre}</span></div>
                  <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Total Pagado</span><span className="font-bold text-primary">${totalPaidUsd.toLocaleString()}</span></div>
                </div>
                <Button onClick={() => setStep('documentos')} className="mt-6 px-8 shadow-lg shadow-primary/20">
                  <FileText className="h-4 w-4 mr-2" /> Gestionar Documentos
                </Button>
              </div>
            )}

            {/* ═══ STEP 7: DOCUMENTOS ═══ */}
            {step === 'documentos' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div>
                  <h3 className="font-semibold text-lg">Panel de Documentación</h3>
                  <p className="text-sm text-muted-foreground">Imprime los documentos legales de la operación</p>
                </div>
                <div className="space-y-3">
                  {[
                    tipoDocumento === 'factura_fiscal' && { id: 'factura' as const, title: 'Factura Fiscal', sub: `N° ${numFactura} | N° Control: ${numControl}`, icon: Receipt, color: 'blue' },
                    { id: 'contrato' as const, title: 'Contrato de Compra-Venta', sub: 'Documento maestro legal', icon: FileText, color: 'green' },
                    { id: 'acta' as const, title: 'Acta de Entrega', sub: 'Deslinde Civil / Penal', icon: ShieldAlert, color: 'purple' },
                  ].filter(Boolean).map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-4 p-4 rounded-2xl border bg-card shadow-sm">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", doc.color === 'blue' && "bg-blue-100 text-blue-600", doc.color === 'green' && "bg-green-100 text-green-600", doc.color === 'purple' && "bg-purple-100 text-purple-600")}>
                        <doc.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.sub}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handlePrintDoc(doc.id)}><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadDoc(doc.id)}><Download className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Finalizar y Cerrar</Button>
              </div>
            )}
          </div>

          {/* Footer */}
          {!(step === 'exito' || step === 'documentos') && (
            <DialogFooter className="p-5 bg-muted/10 border-t flex items-center !justify-between flex-shrink-0">
              <Button type="button" variant="ghost" onClick={handleBack} disabled={step === 'tipo' || isSaving}>
                <ArrowLeft className="h-4 w-4 mr-2" />Atrás
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                {step !== 'pago' ? (
                  <Button type="button" onClick={handleNext} disabled={step === 'tipo' ? !tipoVenta : step === 'vehiculo' ? !selectedVehicleId : false} className="px-8">
                    Siguiente <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={isSaving || !isPaymentValid} className="px-8">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Cerrar Negocio
                  </Button>
                )}
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Authorization Modal */}
      <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
        <DialogContent className="max-w-sm p-6 border-orange-500/30 shadow-xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><ShieldAlert className="w-7 h-7" /></div>
            <div>
              <DialogTitle className="text-lg">Autorización Requerida</DialogTitle>
              <DialogDescription className="mt-1">El precio registrado está por debajo del margen mínimo</DialogDescription>
            </div>
            <div className="w-full space-y-3">
              <div className="space-y-1.5 text-left">
                <Label>Seleccionar usuario autorizador</Label>
                <Select value={authUserId} onValueChange={setAuthUserId}>
                  <SelectTrigger><SelectValue placeholder="Dueño / Encargado" /></SelectTrigger>
                  <SelectContent>
                    {staffList.filter(s => s.activo && (s.rol === 'dueno' || s.rol === 'encargado')).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre} ({ROLE_LABELS[s.rol]})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 text-left">
                <Label>Código de seguridad (4 dígitos)</Label>
                <div className="flex gap-2 justify-center">
                  {authPin.map((digit, i) => (
                    <Input key={i} ref={pinRefs[i]} value={digit} onChange={e => handlePinInput(i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Backspace' && !digit && i > 0) pinRefs[i - 1].current?.focus(); }}
                      maxLength={1} type="password" className="w-12 h-12 text-xl text-center font-mono" />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => { setAuthModalOpen(false); setAuthPin(['','','','']); }}>Cancelar</Button>
              <Button className="flex-1" onClick={handleVerifyPin} disabled={isVerifyingPin || !authUserId}>
                {isVerifyingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Autorizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mini-Modal for Bank Account Selection */}
      <Dialog open={accountSelectModalOpen} onOpenChange={setAccountSelectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Cuenta Bancaria</DialogTitle>
            <DialogDescription>
              El método <strong className="text-primary">{accountSelectMethod}</strong> está asociado a varias cuentas. Selecciona cuál utilizar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4 max-h-[60vh] overflow-y-auto">
            {bankAccounts
              .filter(a => a.metodos_entrada?.[accountSelectMethod as keyof typeof a.metodos_entrada] && a.activa)
              .map(acc => (
                <button
                  key={acc.id}
                  onClick={() => {
                    if (accountSelectSplitIndex !== null) {
                      const newSplits = [...paymentSplits];
                      const currentAmount = newSplits[accountSelectSplitIndex]?.amount || 0;
                      newSplits[accountSelectSplitIndex] = {
                        ...calculateSplit(accountSelectMethod, currentAmount, effectiveTasa, acc.id, acc.nombre),
                        currency: acc.moneda
                      };
                      setPaymentSplits(newSplits);
                    } else {
                      handleSetFullPayment(accountSelectMethod, acc.id, acc.nombre);
                    }
                    setAccountSelectModalOpen(false);
                  }}
                  className="flex flex-col text-left p-3 rounded-lg border hover:bg-primary/5 hover:border-primary transition-all"
                >
                  <span className="font-bold text-sm">{acc.nombre}</span>
                  <span className="text-xs text-muted-foreground">{acc.banco} • {acc.moneda}</span>
                </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountSelectModalOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal for Method Selection (Combined) */}
      <Dialog open={methodSelectModalOpen} onOpenChange={setMethodSelectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Método de Pago</DialogTitle>
            <DialogDescription>
              Selecciona el método de pago a agregar al pago combinado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    handleSelectOption(opt.id, paymentSplits.length);
                    setMethodSelectModalOpen(false);
                  }}
                  className="p-3 rounded-lg border text-sm font-medium transition-all text-left flex flex-col bg-white hover:bg-muted/50"
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {opt.type === 'account' ? 'Cuenta Específica' : 'Método Estándar'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMethodSelectModalOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaleDocumentsPrint printDoc={printDoc} concesionario={concesionario} ventaData={ventaDataForDocs} />
    </>
  );
}

function ReceiptIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}
