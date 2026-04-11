'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Calendar, FileText, User, Car, Printer, Download, ChevronDown, ChevronUp, Receipt, ShieldAlert, DollarSign, X } from 'lucide-react';
import type { Venta } from '@/lib/business-types';
import { useToast } from '@/hooks/use-toast';
import { SaleDocumentsPrint } from './sale-documents-print';

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

export function SaleHistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
    if (open && concesionario?.id) loadHistory();
  }, [open, concesionario?.id]);

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

  // Build ventaData for SaleDocumentsPrint from a Venta record
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

  const docBadgeColors: Record<string, string> = {
    factura_fiscal: 'bg-blue-100 text-blue-700 border-blue-200',
    nota_entrega: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 border-none shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/5 via-background to-background p-5 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" /> Histórico de Ventas
              </DialogTitle>
            </DialogHeader>

            {/* Filters */}
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Comprador..." className="pl-8 h-8 text-xs" value={searchComprador} onChange={e => setSearchComprador(e.target.value)} />
                </div>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Vendedor..." className="pl-8 h-8 text-xs" value={searchVendedor} onChange={e => setSearchVendedor(e.target.value)} />
                </div>
                <div className="relative">
                  <Car className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Vehículo..." className="pl-8 h-8 text-xs" value={searchVehiculo} onChange={e => setSearchVehiculo(e.target.value)} />
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Método de pago..." className="pl-8 h-8 text-xs" value={searchMetodo} onChange={e => setSearchMetodo(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Desde:</span>
                  <Input type="date" className="h-8 text-xs w-36" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Hasta:</span>
                  <Input type="date" className="h-8 text-xs w-36" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                    <X className="h-3 w-3" /> Limpiar
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
                  <span className="text-sm font-bold text-primary">{FMT_MONEY(totalFiltered)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground">
                <Receipt className="h-14 w-14 mb-3 opacity-20" />
                <p className="font-medium">{hasFilters ? 'Sin resultados para los filtros aplicados' : 'No hay ventas registradas'}</p>
                <p className="text-xs mt-1">{hasFilters ? 'Intenta ajustar los filtros de búsqueda' : 'Las ventas cerradas aparecerán aquí'}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur-sm text-muted-foreground text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Vehículo</th>
                    <th className="px-4 py-3 text-left font-medium">Comprador</th>
                    <th className="px-4 py-3 text-left font-medium">Vendedor</th>
                    <th className="px-4 py-3 text-left font-medium">Método</th>
                    <th className="px-4 py-3 text-left font-medium">Doc</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-center font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(v => {
                    const isExpanded = expandedRow === v.id;
                    return (
                      <React.Fragment key={v.id}>
                        <tr className={`hover:bg-muted/30 transition-colors cursor-pointer ${isExpanded ? 'bg-primary/5' : ''}`} onClick={() => setExpandedRow(isExpanded ? null : v.id)}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />{FMT_DATE(v.fecha)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Car className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                              <span className="font-medium text-xs leading-tight">{v.vehiculo_nombre}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs">
                              <p className="font-medium">{v.comprador_nombre}</p>
                              {v.comprador_cedula && <p className="text-muted-foreground font-mono">{v.comprador_cedula}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs">
                              <User className="h-3 w-3 text-muted-foreground" />{v.vendedor_nombre}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full font-medium">{v.metodo_pago}</span>
                          </td>
                          <td className="px-4 py-3">
                            {v.tipo_documento_emitido ? (
                              <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${docBadgeColors[v.tipo_documento_emitido] || 'bg-muted'}`}>
                                {v.tipo_documento_emitido === 'factura_fiscal' ? 'Factura' : 'Nota'}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-green-600 dark:text-green-400">{FMT_MONEY(v.precio_venta)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </td>
                        </tr>

                        {/* Expanded Panel */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-primary/[0.03] border-t-0">
                              <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Financial summary */}
                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resumen Financiero</h4>
                                  <div className="bg-card border rounded-xl p-3 space-y-1.5 text-xs">
                                    {v.numero_factura_venta && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">N° Factura</span>
                                        <span className="font-mono font-bold">{v.numero_factura_venta}</span>
                                      </div>
                                    )}
                                    {v.numero_control_venta && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">N° Control</span>
                                        <span className="font-mono">{v.numero_control_venta}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Precio de Venta</span>
                                      <span className="font-semibold">{FMT_MONEY(v.precio_venta)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Comisión Vendedor</span>
                                      <span>{FMT_MONEY(v.comision_vendedor || 0)}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-1.5 font-bold">
                                      <span>Ganancia Neta</span>
                                      <span className={v.ganancia_neta >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {FMT_MONEY(v.ganancia_neta || 0)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Vehicle info */}
                                  {v.vehiculo_info && (
                                    <div className="bg-card border rounded-xl p-3 space-y-1 text-xs">
                                      <h5 className="font-semibold mb-1.5 flex items-center gap-1"><Car className="h-3.5 w-3.5 text-primary" />Datos del Vehículo</h5>
                                      {v.vehiculo_info.placa && <div className="flex justify-between"><span className="text-muted-foreground">Placa</span><span className="font-mono font-medium">{v.vehiculo_info.placa}</span></div>}
                                      {v.vehiculo_info.serial_carroceria && <div className="flex justify-between"><span className="text-muted-foreground">Serial Carrocería</span><span className="font-mono">{v.vehiculo_info.serial_carroceria}</span></div>}
                                      {v.vehiculo_info.serial_motor && <div className="flex justify-between"><span className="text-muted-foreground">Serial Motor</span><span className="font-mono">{v.vehiculo_info.serial_motor}</span></div>}
                                      {v.vehiculo_info.mileage != null && <div className="flex justify-between"><span className="text-muted-foreground">Kilometraje</span><span>{v.vehiculo_info.mileage.toLocaleString()} km</span></div>}
                                    </div>
                                  )}
                                </div>

                                {/* Documents */}
                                <div className="space-y-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Documentos</h4>
                                  <div className="space-y-2">
                                    {/* Factura – only if tipo was factura_fiscal */}
                                    {(v.tipo_documento_emitido === 'factura_fiscal' || !v.tipo_documento_emitido) && (
                                      <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><Receipt className="h-3.5 w-3.5 text-blue-600" /></div>
                                          <div>
                                            <p className="text-xs font-semibold">Factura Fiscal</p>
                                            <p className="text-[10px] text-muted-foreground">{v.numero_factura_venta || '—'}</p>
                                          </div>
                                        </div>
                                        <div className="flex gap-1">
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={e => { e.stopPropagation(); handlePrintDoc(v, 'factura'); }}>
                                            <Printer className="h-3 w-3 mr-1" />Impr.
                                          </Button>
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={e => { e.stopPropagation(); handleDownloadDoc(v, 'factura'); }}>
                                            <Download className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    {/* Contrato */}
                                    <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center"><FileText className="h-3.5 w-3.5 text-green-600" /></div>
                                        <div>
                                          <p className="text-xs font-semibold">Contrato Compra-Venta</p>
                                          <p className="text-[10px] text-muted-foreground">Documento maestro legal</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={e => { e.stopPropagation(); handlePrintDoc(v, 'contrato'); }}>
                                          <Printer className="h-3 w-3 mr-1" />Impr.
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={e => { e.stopPropagation(); handleDownloadDoc(v, 'contrato'); }}>
                                          <Download className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    {/* Acta */}
                                    <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><ShieldAlert className="h-3.5 w-3.5 text-purple-600" /></div>
                                        <div>
                                          <p className="text-xs font-semibold">Acta de Entrega</p>
                                          <p className="text-[10px] text-muted-foreground">Deslinde Civil/Penal</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={e => { e.stopPropagation(); handlePrintDoc(v, 'acta'); }}>
                                          <Printer className="h-3 w-3 mr-1" />Impr.
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={e => { e.stopPropagation(); handleDownloadDoc(v, 'acta'); }}>
                                          <Download className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer stats */}
          <div className="border-t px-6 py-3 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
            <span>Total registros: <strong className="text-foreground">{ventas.length}</strong></span>
            <span>Total filtrado: <strong className="text-primary">{FMT_MONEY(totalFiltered)}</strong></span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden print area - uses its own rootId to avoid conflict with the sale wizard */}
      {printVenta && (
        <SaleDocumentsPrint
          rootId="sale-history-print-root"
          printDoc={printDoc}
          concesionario={concesionario}
          ventaData={getVentaData(printVenta)}
        />
      )}
    </>
  );
}
