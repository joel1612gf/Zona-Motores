'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Loader2, Calendar, FileText, User, Car, Printer, Download, 
  ChevronDown, ChevronUp, ChevronRight, Receipt, ShieldAlert, DollarSign, X, CheckCircle2 
} from 'lucide-react';
import type { Venta } from '@/lib/business-types';
import { useToast } from '@/hooks/use-toast';
import { SaleDocumentsPrint } from './sale-documents-print';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Formatters
const FMT_MONEY = (n: number) => n.toLocaleString('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const FMT_DATE = (ts: any) => { try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return '—'; } };
const DATE_ONLY = (ts: any) => { try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d.toISOString().slice(0, 10); } catch { return ''; } };
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

export function SaleHistoryTable() {
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filters
  const [searchComprador, setSearchComprador] = useState('');
  const [searchVendedor, setSearchVendedor] = useState('');
  const [searchMetodo, setSearchMetodo] = useState('');
  const [searchVehiculo, setSearchVehiculo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reprint state
  const [printVenta, setPrintVenta] = useState<Venta | null>(null);
  const [printDoc, setPrintDoc] = useState<'factura' | 'contrato' | 'acta' | null>(null);

  useEffect(() => {
    if (concesionario?.id) loadHistory();
  }, [concesionario?.id]);

  const loadHistory = async () => {
    if (!concesionario) return;
    setIsLoading(true);
    try {
      const q = query(collection(firestore, 'concesionarios', concesionario.id, 'ventas'), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      setVentas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Venta)));
    } catch (e) {
      toast({ title: 'Error al cargar historial', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const filtered = useMemo(() => {
    return ventas.filter(v => {
      if (searchComprador && !v.comprador_nombre?.toLowerCase().includes(searchComprador.toLowerCase())) return false;
      if (searchVendedor && !v.vendedor_nombre?.toLowerCase().includes(searchVendedor.toLowerCase())) return false;
      if (searchMetodo && !v.metodo_pago?.toLowerCase().includes(searchMetodo.toLowerCase())) return false;
      if (searchVehiculo && !v.vehiculo_nombre?.toLowerCase().includes(searchVehiculo.toLowerCase())) return false;
      if (startDate && DATE_ONLY(v.fecha) < startDate) return false;
      if (endDate && DATE_ONLY(v.fecha) > endDate) return false;
      return true;
    });
  }, [ventas, searchComprador, searchVendedor, searchMetodo, searchVehiculo, startDate, endDate]);

  const totalFiltered = filtered.reduce((a, v) => a + (v.precio_venta || 0), 0);

  const hasFilters = searchComprador || searchVendedor || searchMetodo || searchVehiculo || startDate || endDate;
  const clearFilters = () => { setSearchComprador(''); setSearchVendedor(''); setSearchMetodo(''); setSearchVehiculo(''); setStartDate(''); setEndDate(''); };

  const handlePrintDoc = (venta: Venta, docType: 'factura' | 'contrato' | 'acta') => {
    setPrintVenta(venta);
    setPrintDoc(docType);
    setTimeout(() => {
      const el = document.getElementById('sale-history-print-root');
      if (el) { el.style.display = 'block'; window.print(); el.style.display = 'none'; }
    }, 300);
  };

  const handleDownloadDoc = async (venta: Venta, docType: 'factura' | 'contrato' | 'acta') => {
    setPrintVenta(venta);
    setPrintDoc(docType);
    await new Promise(r => setTimeout(r, 400));
    const el = document.getElementById('sale-history-print-root');
    if (!el) return;
    el.style.display = 'block'; el.style.position = 'fixed'; el.style.left = '-99999px'; el.style.zIndex = '-9999';
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
      const facN = venta.numero_factura_venta || venta.id.slice(0, 7);
      const names = { factura: `Factura_${facN}`, contrato: `Contrato_${facN}`, acta: `Acta_${facN}` };
      pdf.save(`${names[docType]}.pdf`);
    } catch (e) { console.error(e); toast({ title: 'Error al generar PDF', variant: 'destructive' }); }
    finally { el.style.display = 'none'; el.style.position = 'absolute'; el.style.left = '0'; el.style.zIndex = '9999'; }
  };

  const getVentaData = (v: Venta) => {
    if (!v || !concesionario) return null;
    const metodosPagoDivisa: string[] = concesionario.configuracion?.metodos_pago_divisa || [];
    const esDivisa = metodosPagoDivisa.includes(v.metodo_pago || '');
    return {
      compradorNombre: v.comprador_nombre,
      compradorCedula: v.comprador_cedula || '',
      compradorTelefono: v.comprador_telefono || '',
      metodoPago: v.metodo_pago || '',
      precioVenta: v.precio_venta,
      numFactura: v.numero_factura_venta || v.id.slice(0, 7),
      numControl: v.numero_control_venta || `00-${v.id.slice(0, 7)}`,
      tipoDocumento: v.tipo_documento_emitido || 'factura_fiscal',
      esDivisa,
      vendedorNombre: v.vendedor_nombre,
      fecha: v.fecha?.toDate ? v.fecha.toDate() : new Date(),
      vehiculo: {
        make: v.vehiculo_info?.make || v.vehiculo_nombre?.split(' ')[1] || '—',
        model: v.vehiculo_info?.model || v.vehiculo_nombre?.split(' ')[2] || '—',
        year: v.vehiculo_info?.year || 0,
        placa: v.vehiculo_info?.placa || '',
        exteriorColor: v.vehiculo_info?.exteriorColor || '',
        serial_carroceria: v.vehiculo_info?.serial_carroceria || '',
        serial_motor: v.vehiculo_info?.serial_motor || '',
        clase: v.vehiculo_info?.clase || '',
        tipo: v.vehiculo_info?.tipo || '',
        mileage: v.vehiculo_info?.mileage || 0,
      },
      precioEnLetras: numberToWords(v.precio_venta),
    };
  };

  return (
    <div className="relative animate-in fade-in duration-500">
      <div className="flex flex-col p-0 border border-white/10 shadow-xl rounded-[2rem] md:rounded-[2.5rem] bg-card/40 backdrop-blur-xl overflow-hidden ring-1 ring-white/5">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-background/80 to-background/50 p-6 md:p-8 border-b border-white/5 flex-shrink-0">
          <h2 className="text-2xl font-headline flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20 shadow-inner">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            Histórico de Ventas
          </h2>

            {/* Filters */}
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input placeholder="Comprador..." className="pl-10 h-11 rounded-2xl bg-background/50 border-white/10 focus:bg-background text-sm shadow-inner transition-all" value={searchComprador} onChange={e => setSearchComprador(e.target.value)} />
                </div>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input placeholder="Vendedor..." className="pl-10 h-11 rounded-2xl bg-background/50 border-white/10 focus:bg-background text-sm shadow-inner transition-all" value={searchVendedor} onChange={e => setSearchVendedor(e.target.value)} />
                </div>
                <div className="relative group">
                  <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input placeholder="Vehículo..." className="pl-10 h-11 rounded-2xl bg-background/50 border-white/10 focus:bg-background text-sm shadow-inner transition-all" value={searchVehiculo} onChange={e => setSearchVehiculo(e.target.value)} />
                </div>
                <div className="relative group">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input placeholder="Método de pago..." className="pl-10 h-11 rounded-2xl bg-background/50 border-white/10 focus:bg-background text-sm shadow-inner transition-all" value={searchMetodo} onChange={e => setSearchMetodo(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-background/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                  <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desde:</span>
                  <Input type="date" className="h-8 border-none bg-transparent text-xs w-36 shadow-none focus-visible:ring-0" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 bg-background/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Hasta:</span>
                  <Input type="date" className="h-8 border-none bg-transparent text-xs w-36 shadow-none focus-visible:ring-0" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground gap-2">
                    <X className="h-4 w-4" /> Limpiar
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-4 bg-primary/5 p-3 rounded-2xl border border-primary/10 shadow-inner">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">{filtered.length} reg.</span>
                  <span className="text-base font-black text-primary">{FMT_MONEY(totalFiltered)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/10">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Cargando ventas...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center opacity-40 bg-card/30 rounded-[2.5rem] border border-dashed border-white/10">
                <div className="p-6 bg-muted rounded-full mb-4 shadow-inner"><Receipt className="h-12 w-12" /></div>
                <p className="font-bold text-sm uppercase tracking-widest">{hasFilters ? 'Sin resultados para los filtros' : 'No hay ventas registradas'}</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Las ventas confirmadas aparecerán aquí.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* DESKTOP TABLE */}
                <div className="hidden md:block rounded-[2.5rem] border border-white/10 bg-card/40 overflow-hidden backdrop-blur-md shadow-xl ring-1 ring-white/5">
                  <Table>
                    <TableHeader className="bg-muted/30 border-b border-white/5">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-5 px-4">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Vehículo</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Participantes</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Detalles</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-6">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(v => {
                        const isExpanded = expandedRow === v.id;
                        return (
                          <React.Fragment key={v.id}>
                            <TableRow 
                              className={cn(
                                "group cursor-pointer transition-all duration-300 border-b-white/5",
                                isExpanded ? "bg-primary/[0.05]" : "hover:bg-primary/[0.02]"
                              )}
                              onClick={() => setExpandedRow(isExpanded ? null : v.id)}
                            >
                              <TableCell className="pl-6">
                                {isExpanded ? 
                                  <ChevronDown className="h-5 w-5 text-primary animate-in fade-in duration-300" /> : 
                                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                }
                              </TableCell>
                              <TableCell className="font-bold text-xs whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                                  {FMT_DATE(v.fecha)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-background/50 rounded-xl border border-white/5 shadow-sm">
                                    <Car className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="font-bold text-sm leading-tight text-foreground/90">{v.vehiculo_nombre}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <p className="font-semibold text-xs text-foreground/90 flex items-center gap-1.5"><User className="h-3 w-3 text-primary/50" /> {v.comprador_nombre}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground/50" /> Vendedor: {v.vendedor_nombre}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col items-start gap-1.5">
                                  <Badge variant="outline" className="bg-background/50 text-[9px] font-black uppercase px-2 py-0 border-white/10 shadow-sm">{v.metodo_pago}</Badge>
                                  {v.tipo_documento_emitido === 'factura_fiscal' && <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[9px] font-black uppercase px-2 py-0">Factura</Badge>}
                                  {v.tipo_documento_emitido === 'nota_entrega' && <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[9px] font-black uppercase px-2 py-0">Nota</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-6">
                                <p className="font-black text-base text-primary">
                                  {FMT_MONEY(v.precio_venta)}
                                </p>
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="bg-primary/[0.02] border-none animate-in slide-in-from-top-2 duration-300">
                                <TableCell colSpan={6} className="p-6 md:p-8">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Resumen */}
                                    <div className="space-y-4">
                                      <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                        <DollarSign className="h-3 w-3" /> Resumen Financiero
                                      </h4>
                                      <div className="p-5 bg-background/60 rounded-[1.5rem] border border-white/10 shadow-sm ring-1 ring-black/5 space-y-3">
                                        {v.numero_factura_venta && (
                                          <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground font-medium">N° Factura</span>
                                            <span className="font-mono font-bold bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">{v.numero_factura_venta}</span>
                                          </div>
                                        )}
                                        {v.numero_control_venta && (
                                          <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground font-medium">N° Control</span>
                                            <span className="font-mono font-bold bg-muted/50 px-2 py-0.5 rounded-md border border-white/5">{v.numero_control_venta}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between items-center text-sm border-t border-white/5 pt-3">
                                          <span className="text-muted-foreground font-medium">Precio de Venta</span>
                                          <span className="font-bold">{FMT_MONEY(v.precio_venta)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-muted-foreground font-medium">Comisión Vendedor</span>
                                          <span className="font-medium text-foreground/80">{FMT_MONEY(v.comision_vendedor || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-base border-t border-white/5 pt-3 font-black">
                                          <span>Ganancia Neta</span>
                                          <span className={v.ganancia_neta >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                            {FMT_MONEY(v.ganancia_neta || 0)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Documents */}
                                    <div className="space-y-4">
                                      <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                        <Printer className="h-3 w-3" /> Documentos Generados
                                      </h4>
                                      <div className="grid grid-cols-1 gap-3">
                                        {/* Factura */}
                                        {(v.tipo_documento_emitido === 'factura_fiscal' || !v.tipo_documento_emitido) && (
                                          <div className="group/btn flex items-center justify-between bg-background border border-white/10 rounded-2xl p-2 pr-3 overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                                            <div className="flex items-center gap-3">
                                              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20"><Receipt className="h-4 w-4 text-blue-600" /></div>
                                              <div>
                                                <p className="text-xs font-bold leading-none mb-1">Factura Fiscal</p>
                                                <p className="text-[10px] font-medium text-muted-foreground">{v.numero_factura_venta || 'Copia'}</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-2">
                                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-background shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" onClick={(e) => { e.stopPropagation(); handlePrintDoc(v, 'factura'); }}>
                                                <Printer className="h-3.5 w-3.5" />
                                              </Button>
                                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-background shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" onClick={(e) => { e.stopPropagation(); handleDownloadDoc(v, 'factura'); }}>
                                                <Download className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Contrato */}
                                        <div className="group/btn flex items-center justify-between bg-background border border-white/10 rounded-2xl p-2 pr-3 overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                                          <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><FileText className="h-4 w-4 text-emerald-600" /></div>
                                            <div>
                                              <p className="text-xs font-bold leading-none mb-1">Contrato Legal</p>
                                              <p className="text-[10px] font-medium text-muted-foreground">Compra-Venta</p>
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-background shadow-sm hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors" onClick={(e) => { e.stopPropagation(); handlePrintDoc(v, 'contrato'); }}>
                                              <Printer className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-background shadow-sm hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors" onClick={(e) => { e.stopPropagation(); handleDownloadDoc(v, 'contrato'); }}>
                                              <Download className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>

                                        {/* Acta */}
                                        <div className="group/btn flex items-center justify-between bg-background border border-white/10 rounded-2xl p-2 pr-3 overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                                          <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20"><ShieldAlert className="h-4 w-4 text-purple-600" /></div>
                                          <div>
                                              <p className="text-xs font-bold leading-none mb-1">Acta de Entrega</p>
                                              <p className="text-[10px] font-medium text-muted-foreground">Deslinde Jurídico</p>
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-background shadow-sm hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors" onClick={(e) => { e.stopPropagation(); handlePrintDoc(v, 'acta'); }}>
                                              <Printer className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-background shadow-sm hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors" onClick={(e) => { e.stopPropagation(); handleDownloadDoc(v, 'acta'); }}>
                                              <Download className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* MOBILE CARDS */}
                <div className="md:hidden space-y-4">
                  {filtered.map(v => {
                    const isExpanded = expandedRow === v.id;
                    return (
                      <div 
                        key={v.id}
                        className={cn(
                          "rounded-[2rem] border bg-card/60 backdrop-blur-md transition-all duration-300 overflow-hidden",
                          isExpanded ? "ring-2 ring-primary/20 shadow-xl" : "shadow-sm border-white/10"
                        )}
                      >
                        <div 
                          className="p-5 flex flex-col gap-4"
                          onClick={() => setExpandedRow(isExpanded ? null : v.id)}
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" /> {FMT_DATE(v.fecha)}
                            </span>
                            <div className="flex gap-1.5">
                              <Badge variant="outline" className="bg-background/80 text-[8px] font-black uppercase px-1.5 py-0 shadow-sm">{v.metodo_pago}</Badge>
                              {v.tipo_documento_emitido === 'factura_fiscal' && <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[8px] font-black uppercase px-1.5 py-0">Factura</Badge>}
                              {v.tipo_documento_emitido === 'nota_entrega' && <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[8px] font-black uppercase px-1.5 py-0">Nota</Badge>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-background/80 rounded-[1rem] border border-white/10 shadow-inner">
                              <Car className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm leading-tight text-foreground/90">{v.vehiculo_nombre}</h4>
                              <p className="text-[10px] font-medium text-muted-foreground mt-0.5"><User className="h-2.5 w-2.5 inline mr-1" />{v.comprador_nombre}</p>
                            </div>
                          </div>

                          <div className="flex justify-between items-end pt-2 border-t border-white/5">
                            <div className="flex flex-col gap-0.5 text-[10px] font-medium text-muted-foreground">
                              <span>Vendedor: {v.vendedor_nombre}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-lg text-primary leading-none">
                                {FMT_MONEY(v.precio_venta)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-6 pt-2 space-y-6 animate-in slide-in-from-top-2 duration-300">
                            {/* Resumen */}
                            <div className="p-4 bg-background/50 rounded-2xl border border-white/5 shadow-inner space-y-2.5 text-sm">
                              {v.numero_factura_venta && (
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground text-xs font-medium">N° Factura</span>
                                  <span className="font-mono text-xs font-bold">{v.numero_factura_venta}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-xs font-medium">Comisión</span>
                                <span className="font-medium text-xs">{FMT_MONEY(v.comision_vendedor || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-white/5 pt-2">
                                <span className="text-xs font-bold">Ganancia Neta</span>
                                <span className={cn("font-bold text-xs", v.ganancia_neta >= 0 ? "text-emerald-500" : "text-red-500")}>
                                  {FMT_MONEY(v.ganancia_neta || 0)}
                                </span>
                              </div>
                            </div>

                            {/* Acciones Docs */}
                            <div className="space-y-3">
                              <p className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Documentos</p>
                              
                              <div className="grid grid-cols-1 gap-2.5">
                                {/* Factura */}
                                {(v.tipo_documento_emitido === 'factura_fiscal' || !v.tipo_documento_emitido) && (
                                  <div className="flex bg-blue-500/5 border border-blue-500/10 rounded-xl overflow-hidden h-12 ring-1 ring-black/5 items-stretch shadow-sm">
                                    <Button variant="ghost" className="flex-1 rounded-none border-r border-blue-500/10 gap-2 font-bold h-full text-xs text-blue-600 justify-start px-4" onClick={(e) => { e.stopPropagation(); handlePrintDoc(v, 'factura'); }}>
                                      <Receipt className="h-4 w-4" /> Factura Fiscal
                                    </Button>
                                    <Button variant="ghost" className="px-4 h-full hover:bg-blue-500/10 text-blue-600 group/dl" onClick={(e) => { e.stopPropagation(); handleDownloadDoc(v, 'factura'); }}>
                                      <Download className="h-4 w-4 transition-transform group-active/dl:scale-90" />
                                    </Button>
                                  </div>
                                )}
                                
                                {/* Contrato */}
                                <div className="flex bg-emerald-500/5 border border-emerald-500/10 rounded-xl overflow-hidden h-12 ring-1 ring-black/5 items-stretch shadow-sm">
                                  <Button variant="ghost" className="flex-1 rounded-none border-r border-emerald-500/10 gap-2 font-bold h-full text-xs text-emerald-600 justify-start px-4" onClick={(e) => { e.stopPropagation(); handlePrintDoc(v, 'contrato'); }}>
                                    <FileText className="h-4 w-4" /> Contrato Legal
                                  </Button>
                                  <Button variant="ghost" className="px-4 h-full hover:bg-emerald-500/10 text-emerald-600 group/dl" onClick={(e) => { e.stopPropagation(); handleDownloadDoc(v, 'contrato'); }}>
                                    <Download className="h-4 w-4 transition-transform group-active/dl:scale-90" />
                                  </Button>
                                </div>

                                {/* Acta */}
                                <div className="flex bg-purple-500/5 border border-purple-500/10 rounded-xl overflow-hidden h-12 ring-1 ring-black/5 items-stretch shadow-sm">
                                  <Button variant="ghost" className="flex-1 rounded-none border-r border-purple-500/10 gap-2 font-bold h-full text-xs text-purple-600 justify-start px-4" onClick={(e) => { e.stopPropagation(); handlePrintDoc(v, 'acta'); }}>
                                    <ShieldAlert className="h-4 w-4" /> Acta Entrega
                                  </Button>
                                  <Button variant="ghost" className="px-4 h-full hover:bg-purple-500/10 text-purple-600 group/dl" onClick={(e) => { e.stopPropagation(); handleDownloadDoc(v, 'acta'); }}>
                                    <Download className="h-4 w-4 transition-transform group-active/dl:scale-90" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Hidden print area - uses its own rootId to avoid conflict with the sale wizard */}
      {printVenta && (
        <SaleDocumentsPrint
          rootId="sale-history-print-root"
          printDoc={printDoc}
          concesionario={concesionario}
          ventaData={getVentaData(printVenta)}
        />
      )}
    </div>
  );
}

