'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Car, User, DollarSign, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Search, Lock, FileText, Receipt, Printer, Download, ShieldAlert, Package, LayoutGrid } from 'lucide-react';
import type { StockVehicle } from '@/lib/business-types';
import { ROLE_LABELS, verifySHA256 } from '@/lib/business-types';
import { cn } from '@/lib/utils';
import { SaleDocumentsPrint } from './sale-documents-print';

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
type WizardStep = 'tipo' | 'vehiculo' | 'cliente' | 'exito' | 'documentos';

interface SaleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concesionarioId: string;
  onSave: () => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
  tipo: 'Tipo', vehiculo: 'Vehículo', cliente: 'Cliente', exito: 'Éxito', documentos: 'Documentos',
};
const WIZARD_STEPS: WizardStep[] = ['tipo', 'vehiculo', 'cliente', 'exito', 'documentos'];

// ---------- Main Component ----------
export function SaleFormDialog({ open, onOpenChange, concesionarioId, onSave }: SaleFormDialogProps) {
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
  // Step 3 - Client
  const [compradorId, setCompradorId] = useState('');
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorApellido, setCompradorApellido] = useState('');
  const [compradorCedula, setCompradorCedula] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');
  const [compradorEmail, setCompradorEmail] = useState('');
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [registrarCaja, setRegistrarCaja] = useState(true);
  const [tipoDocumento, setTipoDocumento] = useState<'factura_fiscal' | 'nota_entrega'>('factura_fiscal');
  const [docsAlerta, setDocsAlerta] = useState(false);

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

  const handleSelectClient = (clientId: string) => {
    const client = existingClients.find(c => c.id === clientId);
    if (client) {
      setCompradorId(client.id);
      setCompradorNombre(client.nombre || '');
      setCompradorApellido(client.apellido || '');
      setCompradorCedula(client.cedula_rif || '');
      setCompradorTelefono(client.telefono || '');
      setCompradorEmail(client.email || '');
    }
  };
  // Step 4 - Success
  const [isSaving, setIsSaving] = useState(false);
  const [numFactura, setNumFactura] = useState('');
  const [numControl, setNumControl] = useState('');
  const [ventaFecha, setVentaFecha] = useState<Date>(new Date());
  // Step 5 - Docs
  const [printDoc, setPrintDoc] = useState<'factura' | 'contrato' | 'acta' | null>(null);

  const selectedVehicle = useMemo(() => availableVehicles.find(v => v.id === selectedVehicleId), [availableVehicles, selectedVehicleId]);
  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return availableVehicles;
    return availableVehicles.filter(v => {
      const placa = v.placa || v.info_extra?.placa || '';
      return `${v.make} ${v.model} ${placa}`.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [availableVehicles, searchQuery]);

  const metodosPago = concesionario?.configuracion?.metodos_pago || ['Efectivo', 'Zelle'];
  const metodosPagoDivisa = concesionario?.configuracion?.metodos_pago_divisa || [];
  const esDivisa = metodosPagoDivisa.includes(metodoPago);

    const negotiationInfo = useMemo(() => {
    if (!selectedVehicle) return null;
    const totalCost = (selectedVehicle.costo_compra || 0) + (selectedVehicle.gastos_adecuacion || []).reduce((a, g) => a + (g.monto || 0), 0);
    const currentPrice = Number(precioVenta) || 0;
    const minMargin = (concesionario?.configuracion.margen_minimo || 0) / 100;
    
    // Logic updated to match 2026 Fintech standard
    const v = vendedorId ? staffList.find(s => s.id === vendedorId) : null;
    const commType = v?.commission_type || 'total_price';
    const commPercentage = v?.commission_percentage ?? concesionario?.configuracion.estructura_comision ?? 0;
    const sellerComRate = commPercentage / 100;

    // Calculation varies based on base (Price vs Profit)
    // For Margin Validation, we use the effective commission
    let minPriceForMargin = 0;
    if (commType === 'total_price') {
      minPriceForMargin = totalCost === 0 ? 0 : (totalCost * (1 + minMargin)) / (1 - sellerComRate);
    } else {
      // If commission is on profit: Price = Cost + Margin + CommOnProfit
      // Price - Cost = Profit; Comm = Profit * rate
      // Price = Cost + MarginProfit + (Price - Cost - MarginProfit) * rate? No, usually it's simpler:
      // Profit = Price - Cost; NetProfit = Profit * (1 - rate)
      // MinPrice = Cost * (1 + minMargin) / (1 - rate) -- wait, this depends on business policy
      minPriceForMargin = totalCost * (1 + minMargin);
    }
    
    const breakEvenPrice = totalCost; // Simple break-even
    
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

  // Load vehicles
  useEffect(() => {
    if (!open || !concesionarioId) return;
    const fetchVehicles = async () => {
      setIsLoadingVehicles(true);
      try {
        const q = query(collection(firestore, 'concesionarios', concesionarioId, 'inventario'), where('estado_stock', '!=', 'vendido'));
        const snap = await getDocs(q);
        setAvailableVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockVehicle)));
      } catch (e) { console.error(e); } finally { setIsLoadingVehicles(false); }
    };
    fetchVehicles();
    resetAll();
    if (currentRole === 'vendedor' && staff) setVendedorId(staff.id);
  }, [open, concesionarioId]);

  const resetAll = () => {
    setStep('tipo'); setTipoVenta(null); setSelectedVehicleId(''); setPrecioVenta(''); setVendedorId('');
    setSearchQuery(''); setAuthGranted(false); setAuthModalOpen(false); setAuthPin(['', '', '', '']); setAuthUserId('');
    setParteDePago(false); setCompradorNombre(''); setCompradorCedula(''); setCompradorTelefono('');
    setMetodoPago(''); setRegistrarCaja(true); setTipoDocumento('factura_fiscal'); setDocsAlerta(false);
    setNumFactura(''); setNumControl(''); setPrintDoc(null);
  };

  const handleNext = () => {
    if (step === 'tipo') { if (tipoVenta === 'vehiculo') setStep('vehiculo'); }
    else if (step === 'vehiculo') {
      if (!selectedVehicleId) return;
      if (!vendedorId) { toast({ title: 'Vendedor requerido', variant: 'destructive' }); return; }
      if (!precioVenta) { toast({ title: 'Precio requerido', variant: 'destructive' }); return; }
      if (needsAuth && !authGranted) { setAuthModalOpen(true); return; }
      if (parteDePago) { toast({ title: 'Opción bloqueada', description: 'Desactiva "Vehículo como Parte de Pago" para continuar.', variant: 'destructive' }); return; }
      // Check vehicle docs
      const hasSerial = !!(selectedVehicle?.info_extra?.serial_carroceria && selectedVehicle?.info_extra?.serial_motor);
      setDocsAlerta(!hasSerial);
      setStep('cliente');
    }
  };

  const handleBack = () => {
    if (step === 'vehiculo') setStep('tipo');
    else if (step === 'cliente') setStep('vehiculo');
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
        const hasSerial = !!(selectedVehicle?.info_extra?.serial_carroceria && selectedVehicle?.info_extra?.serial_motor);
        setDocsAlerta(!hasSerial);
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
    if (!selectedVehicleId || !compradorNombre || !precioVenta || !metodoPago || !vendedorId) {
      toast({ title: 'Faltan datos', description: 'Completa todos los campos obligatorios.', variant: 'destructive' }); return;
    }
    setIsSaving(true);
    try {
      const vehicle = selectedVehicle!;
      const vStaff = staffList.find(s => s.id === vendedorId);
      const vendedorNombre = vStaff?.nombre || 'Desconocido';
      let commRate = concesionario?.configuracion.estructura_comision || 0;
      if (vStaff?.comision_porcentaje != null) commRate = vStaff.comision_porcentaje;
      const salePrice = Number(precioVenta);
      const comision = (salePrice * commRate) / 100;
      const totalBasis = (vehicle.costo_compra || 0) + (vehicle.gastos_adecuacion || []).reduce((a, g) => a + (g.monto || 0), 0);
      const gananciaNeta = vehicle.es_consignacion
        ? (vehicle.consignacion_info?.comision_acordada || 0) / 100 * salePrice - comision
        : salePrice - totalBasis - comision;

      // --- Handle Client ---
      let cId = compradorId;
      const clientsRef = collection(firestore, 'concesionarios', concesionarioId, 'clientes');
      
      // If no compradorId, search by cedula to avoid duplicates
      if (!cId && compradorCedula) {
        const q = query(clientsRef, where('cedula_rif', '==', compradorCedula));
        const snap = await getDocs(q);
        if (!snap.empty) {
          cId = snap.docs[0].id;
        }
      }

      const clientUpdateData = {
        nombre: compradorNombre,
        apellido: compradorApellido,
        cedula_rif: compradorCedula,
        telefono: compradorTelefono,
        email: compradorEmail,
        updated_at: serverTimestamp(),
        total_invertido: (existingClients.find(c => c.id === cId)?.total_invertido || 0) + salePrice,
        ultima_compra_fecha: serverTimestamp(),
        traspaso_pendiente: true, // New vehicle purchase triggers transfer tracking
        traspaso_fecha_limite: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      if (cId) {
        await updateDoc(doc(firestore, 'concesionarios', concesionarioId, 'clientes', cId), clientUpdateData);
      } else {
        const newClient = await addDoc(clientsRef, {
          ...clientUpdateData,
          compras_ids: [],
          tags: tipoVenta === 'vehiculo' ? ['Comprador de Carros'] : ['Comprador de Productos'],
          created_at: serverTimestamp(),
        });
        cId = newClient.id;
      }

      // Invoice number
      const concDoc = await getDoc(doc(firestore, 'concesionarios', concesionarioId));
      const lastNum = (concDoc.data()?.configuracion?.ultimo_numero_factura_ventas || 0) as number;
      const next = lastNum + 1;
      const facN = padNum(next, 7);
      const ctrlN = `00-${padNum(next, 7)}`;

      const now = new Date();
      const ventaData = {
        vehiculo_id: vehicle.id,
        vehiculo_nombre: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.placa ? ` (${vehicle.placa})` : ''}`,
        comprador_id: cId,
        comprador_nombre: `${compradorNombre} ${compradorApellido}`,
        comprador_telefono: compradorTelefono,
        comprador_cedula: compradorCedula,
        vendedor_staff_id: vendedorId,
        vendedor_nombre: vendedorNombre,
        precio_venta: salePrice,
        metodo_pago: metodoPago,
        comision_vendedor: comision,
        ganancia_neta: gananciaNeta,
        fecha: serverTimestamp(),
        tipo_venta: 'vehiculo' as const,
        tipo_documento_emitido: tipoDocumento,
        numero_factura_venta: facN,
        numero_control_venta: ctrlN,
        vehiculo_info: {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          placa: vehicle.placa || vehicle.info_extra?.placa || '',
          exteriorColor: vehicle.exteriorColor || '',
          serial_carroceria: vehicle.info_extra?.serial_carroceria || '',
          serial_motor: vehicle.info_extra?.serial_motor || '',
          clase: vehicle.info_extra?.clase || '',
          tipo: vehicle.info_extra?.tipo || '',
          mileage: vehicle.mileage || 0,
        },
      };

      const saleDoc = await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'ventas'), ventaData);
      
      // Update client with sale ID
      await updateDoc(doc(firestore, 'concesionarios', concesionarioId, 'clientes', cId), {
        compras_ids: [...(existingClients.find(c => c.id === cId)?.compras_ids || []), saleDoc.id]
      });

      await updateDoc(doc(firestore, 'concesionarios', concesionarioId, 'inventario', vehicle.id), { estado_stock: 'vendido', fecha_venta: serverTimestamp(), updated_at: serverTimestamp() });
      await updateDoc(doc(firestore, 'concesionarios', concesionarioId), { 'configuracion.ultimo_numero_factura_ventas': next });
      
      if (registrarCaja && staff) {
        await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'caja'), {
          tipo: 'ingreso', monto: salePrice, descripcion: `Venta: ${ventaData.vehiculo_nombre}`,
          metodo_pago: metodoPago, cajero_staff_id: staff.id, cajero_nombre: staff.nombre, fecha: serverTimestamp(),
        });
      }
      setNumFactura(facN); setNumControl(ctrlN); setVentaFecha(now);
      setStep('exito'); onSave();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
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
    compradorNombre, compradorCedula, compradorTelefono, metodoPago,
    precioVenta: Number(precioVenta), numFactura, numControl, tipoDocumento, esDivisa,
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

  const stepIdx = WIZARD_STEPS.indexOf(step);
  const isLastStep = step === 'exito' || step === 'documentos';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
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
                {(['tipo', 'vehiculo', 'cliente', 'documentos'] as WizardStep[]).map((s, i) => {
                  const idx = ['tipo', 'vehiculo', 'cliente', 'documentos'].indexOf(step);
                  const done = i < idx;
                  const active = s === step;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all", active && "bg-primary text-white shadow-md shadow-primary/30", done && "bg-primary/20 text-primary", !active && !done && "bg-muted text-muted-foreground")}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span className={cn("text-[11px] hidden sm:block", active ? "text-primary font-semibold" : "text-muted-foreground")}>{STEP_LABELS[s]}</span>
                      {i < 3 && <div className={cn("h-px w-4 sm:w-8", done ? "bg-primary/40" : "bg-muted")} />}
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
                    { id: 'producto', label: 'Producto / Repuesto', icon: Package, color: 'gray', available: false },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTipoVenta(opt.id as any)}
                      disabled={!opt.available}
                      className={cn(
                        "relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 text-center",
                        tipoVenta === opt.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-transparent bg-muted/40 hover:bg-muted/70",
                        !opt.available && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <opt.icon className={cn("h-12 w-12", tipoVenta === opt.id ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-semibold text-base">{opt.label}</span>
                      {!opt.available && (
                        <span className="absolute top-2 right-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Próximamente</span>
                      )}
                      {tipoVenta === opt.id && <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-primary" />}
                    </button>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Por favor, procese una venta a la vez (primero el vehículo y luego productos adicionales si aplica).</span>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: VEHÍCULO + PRECIO ═══ */}
            {step === 'vehiculo' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Vehicle picker */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por marca, modelo o placa..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
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

                {selectedVehicle && (
                  <div className="space-y-4 border-t pt-4">
                    {/* Seller */}
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><User className="h-4 w-4" />Vendedor Responsable *</Label>
                      <Select value={vendedorId} onValueChange={setVendedorId}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                        <SelectContent>{staffList.filter(s => s.activo).map(s => <SelectItem key={s.id} value={s.id}>{s.nombre} ({ROLE_LABELS[s.rol]})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {/* Price */}
                    <div className="flex flex-col items-center gap-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-widest">Precio Final de Venta ($)</Label>
                      <div className="relative w-full max-w-xs">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/40" />
                        <Input type="number" value={precioVenta} onChange={e => { setPrecioVenta(e.target.value ? Number(e.target.value) : ''); setAuthGranted(false); }}
                          className="h-16 text-3xl text-center font-bold pl-10 rounded-xl border-2 border-primary/20" placeholder="0" />
                      </div>
                    </div>
                    {/* Margin alert */}
                    {negotiationInfo?.message && (
                      <div className={cn("p-3 rounded-xl flex items-start gap-2 border text-sm", negotiationInfo.status === 'critical' && "bg-red-50 text-red-800 border-red-200 animate-pulse", negotiationInfo.status === 'very_low' && "bg-orange-50 text-orange-800 border-orange-200", negotiationInfo.status === 'low' && "bg-yellow-50 text-yellow-800 border-yellow-200")}>
                        {negotiationInfo.status === 'critical' ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-bold">{negotiationInfo.message}</p>
                          {needsAuth && !authGranted && <p className="text-xs mt-1">Se requiere autorización de un Dueño/Encargado para continuar.</p>}
                          {authGranted && <p className="text-xs mt-1 text-green-700 font-semibold">✓ Precio autorizado</p>}
                        </div>
                      </div>
                    )}
                    {/* Trade-in */}
                    <div className="border rounded-xl overflow-hidden">
                      <button onClick={() => setParteDePago(!parteDePago)} className="w-full p-3 flex items-center justify-between text-sm font-medium hover:bg-muted/30 transition-colors">
                        <span className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground" />Vehículo como Parte de Pago</span>
                        <span className="text-muted-foreground">{parteDePago ? '▲' : '▼'}</span>
                      </button>
                      {parteDePago && (
                        <div className="p-3 border-t bg-amber-50/50 space-y-2">
                          <div className="p-2 rounded-lg bg-amber-100 text-amber-800 text-xs flex gap-2">
                            <Lock className="h-3 w-3 shrink-0 mt-0.5" />Esta función bloquea el avance hasta que sea implementada completamente.
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1"><Label className="text-xs">Marca</Label><Input className="h-8 text-sm" placeholder="Toyota" /></div>
                            <div className="space-y-1"><Label className="text-xs">Modelo</Label><Input className="h-8 text-sm" placeholder="Corolla" /></div>
                            <div className="space-y-1"><Label className="text-xs">Año</Label><Input className="h-8 text-sm" type="number" placeholder="2018" /></div>
                          </div>
                          <p className="text-xs text-amber-700 font-medium">⚠️ Valor estimado en stock: $— (en desarrollo)</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 3: CLIENTE ═══ */}
            {step === 'cliente' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Vehicle summary */}
                {selectedVehicle && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border text-sm">
                    <Car className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</p>
                      <p className="text-xs text-muted-foreground">{selectedVehicle.placa || selectedVehicle.info_extra?.placa || 'SIN PLACA'}</p>
                    </div>
                    <p className="font-headline text-primary font-bold">${Number(precioVenta).toLocaleString()}</p>
                  </div>
                )}
                
                {/* Client selection/search */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><User className="h-4 w-4" />Buscar Cliente Existente</Label>
                  <Select value={compradorId} onValueChange={handleSelectClient}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar cliente (opcional)..." />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingClients ? (
                        <div className="flex items-center justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : (
                        <>
                          <SelectItem value="new">+ Nuevo Cliente</SelectItem>
                          {existingClients.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre} {c.apellido} ({c.cedula_rif})
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Client data */}
                <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border">
                  <h4 className="font-semibold flex items-center gap-2 text-sm"><User className="h-4 w-4" />Datos del Comprador</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nombre *</Label>
                      <Input value={compradorNombre} onChange={e => { setCompradorNombre(e.target.value); setCompradorId(''); }} placeholder="Ej: María" />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellido *</Label>
                      <Input value={compradorApellido} onChange={e => { setCompradorApellido(e.target.value); setCompradorId(''); }} placeholder="Ej: López" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Cédula / RIF *</Label>
                      <Input value={compradorCedula} onChange={e => { setCompradorCedula(e.target.value); setCompradorId(''); }} placeholder="V-00.000.000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono *</Label>
                      <Input value={compradorTelefono} onChange={e => { setCompradorTelefono(e.target.value); setCompradorId(''); }} placeholder="0424..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo Electrónico</Label>
                    <Input type="email" value={compradorEmail} onChange={e => { setCompradorEmail(e.target.value); setCompradorId(''); }} placeholder="cliente@email.com" />
                  </div>
                </div>
                
                {/* Document type */}
                <div className="space-y-2">
                  <Label>Tipo de Documento a Emitir</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ id: 'factura_fiscal', label: 'Factura Fiscal', icon: Receipt, desc: 'Incluye Factura + Contrato + Acta' }, { id: 'nota_entrega', label: 'Nota de Entrega', icon: FileText, desc: 'Solo Contrato + Acta de Entrega' }].map(opt => (
                      <button key={opt.id} onClick={() => setTipoDocumento(opt.id as any)}
                        className={cn("p-3 rounded-xl border-2 text-left transition-all", tipoDocumento === opt.id ? "border-primary bg-primary/5" : "border-transparent bg-muted/40 hover:bg-muted/60")}>
                        <opt.icon className={cn("h-5 w-5 mb-1", tipoDocumento === opt.id ? "text-primary" : "text-muted-foreground")} />
                        <p className="font-semibold text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Payment */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Método de Pago *</Label>
                    <Select value={metodoPago} onValueChange={setMetodoPago}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{metodosPago.map((m: string) => <SelectItem key={m} value={m}>{m}{metodosPagoDivisa.includes(m) ? ' ($)' : ' (Bs)'}</SelectItem>)}</SelectContent>
                    </Select>
                    {esDivisa && <p className="text-xs text-amber-600">Se aplicará IGTF 3% en la factura</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Checkbox id="caja" checked={registrarCaja} onCheckedChange={c => setRegistrarCaja(c as boolean)} />
                      <Label htmlFor="caja" className="text-xs text-muted-foreground cursor-pointer leading-tight">Registrar ingreso en Caja Chica</Label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 4: ÉXITO ═══ */}
            {step === 'exito' && (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in-95 duration-500">
                {/* Animated check */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center shadow-lg shadow-blue-200/50">
                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                      <circle cx="28" cy="28" r="26" stroke="#2563eb" strokeWidth="3" strokeDasharray="163.4" strokeDashoffset="0" style={{ animation: 'dash 0.6s ease-in-out forwards' }} />
                      <polyline points="16,28 24,36 40,20" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="35" strokeDashoffset="35" style={{ animation: 'checkmark 0.4s 0.4s ease-in-out forwards', fill: 'none' }} />
                    </svg>
                  </div>
                  <style>{`@keyframes checkmark { to { stroke-dashoffset: 0; } } @keyframes dash { from { stroke-dashoffset: 163.4; } to { stroke-dashoffset: 0; } }`}</style>
                </div>
                <h2 className="text-2xl font-bold font-headline mb-1">¡Transacción Exitosa!</h2>
                <p className="text-muted-foreground mb-6">La venta fue registrada correctamente</p>
                <div className="bg-muted/30 rounded-2xl border p-4 text-left w-full max-w-sm space-y-2 text-sm">
                  {tipoDocumento === 'factura_fiscal' && <div className="flex justify-between"><span className="text-muted-foreground">N° Factura</span><span className="font-mono font-bold">{numFactura}</span></div>}
                  {tipoDocumento === 'factura_fiscal' && <div className="flex justify-between"><span className="text-muted-foreground">N° Control</span><span className="font-mono">{numControl}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Vehículo</span><span className="font-medium">{selectedVehicle?.make} {selectedVehicle?.model}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{compradorNombre}</span></div>
                  <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Total Operación</span><span className="font-bold text-primary">${Number(precioVenta).toLocaleString()}</span></div>
                </div>
                <Button onClick={() => setStep('documentos')} className="mt-6 px-8 shadow-lg shadow-primary/20">
                  <FileText className="h-4 w-4 mr-2" /> Ver e Imprimir Documentos
                </Button>
              </div>
            )}

            {/* ═══ STEP 5: DOCUMENTOS ═══ */}
            {step === 'documentos' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div>
                  <h3 className="font-semibold text-lg">Documentos de la Venta</h3>
                  <p className="text-sm text-muted-foreground">Imprime o descarga cada documento legal</p>
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
                <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                  Cerrar Asistente
                </Button>
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
                {step !== 'cliente' ? (
                  <Button type="button" onClick={handleNext} disabled={step === 'tipo' ? !tipoVenta : !selectedVehicleId} className="px-8">
                    Siguiente <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={isSaving || !metodoPago || !compradorNombre} className="px-8">
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
                      onKeyDown={e => { if (e.key === 'Backspace' && !digit && i > 0) pinRefs[i-1].current?.focus(); }}
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

      {/* Hidden document print templates */}
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
