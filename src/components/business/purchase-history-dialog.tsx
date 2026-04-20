'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Calendar, FileText, User, ChevronDown, ChevronUp, Printer, Download, Trash2 } from 'lucide-react';
import type { Compra } from '@/lib/business-types';
import { useToast } from '@/hooks/use-toast';
import { LegalRetentionVoucher } from './legal-retention-voucher';

export function PurchaseHistoryDialog({
  open,
  onOpenChange,
  onPurchaseDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchaseDeleted?: () => void;
}) {
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [compras, setCompras] = useState<Compra[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [compraToDelete, setCompraToDelete] = useState<Compra | null>(null);
  const [deductInventory, setDeductInventory] = useState(true);

  // Filters
  const [searchGeneral, setSearchGeneral] = useState(''); // Proveedor o Factura
  const [searchProduct, setSearchProduct] = useState(''); // Producto
  const [searchCreator, setSearchCreator] = useState(''); // Registrado por

  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Expanded rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Print data state
  const [printData, setPrintData] = useState<Compra | null>(null);
  const [printMode, setPrintMode] = useState<'both' | 'summary' | 'retention'>('both');
  const [isPrinting, setIsPrinting] = useState(false);

  // Trigger print after state updates
  useEffect(() => {
    if (isPrinting && printData) {
      const timer = setTimeout(() => {
        const element = document.getElementById('history-print-root');
        if (element) {
          element.style.display = 'block';
          window.print();
          element.style.display = 'none';
          setIsPrinting(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPrinting, printData, printMode]);

  useEffect(() => {
    if (open && concesionario?.id) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, concesionario?.id]);

  const loadHistory = async () => {
    if (!concesionario?.id) return;
    setIsLoading(true);
    try {
      const ref = collection(firestore, 'concesionarios', concesionario.id, 'compras');
      const snap = await getDocs(query(ref, orderBy('created_at', 'desc')));
      setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() } as Compra)));
    } catch (e) {
      console.error('Error cargando historial de compras:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!compraToDelete || !concesionario) return;
    try {
      setIsDeleting(true);

      const itemsToDeduct = (compraToDelete.items || []).filter(i =>
        i.producto_id &&
        !i.producto_id.startsWith('new-') &&
        !i.producto_id.startsWith('manual-')
      );

      if (deductInventory && itemsToDeduct.length > 0) {
        // Restar productos del inventario uno por uno para asegurar que impacten
        // Usamos una secuencia para evitar saturar si son muchos, aunque Promise.all suele estar bien
        for (const item of itemsToDeduct) {
          const qty = Number(item.cantidad);
          if (isNaN(qty) || qty === 0) continue;

          const productRef = doc(firestore, 'concesionarios', concesionario.id, 'productos', item.producto_id);
          await updateDoc(productRef, {
            stock_actual: increment(-qty),
            updated_at: serverTimestamp()
          });
        }
        console.log(`Deducción de inventario completada para ${itemsToDeduct.length} productos.`);
      }

      await deleteDoc(doc(firestore, 'concesionarios', concesionario.id, 'compras', compraToDelete.id));

      setCompras(prev => prev.filter(c => c.id !== compraToDelete.id));
      setExpandedRow(null);
      setDeleteModalOpen(false);

      toast({
        title: 'Factura anulada con éxito',
        description: deductInventory
          ? `La factura se borró y se descontó el stock de ${itemsToDeduct.length} ítems.`
          : 'La factura ha sido borrada.'
      });

      if (onPurchaseDeleted) {
        onPurchaseDeleted();
      }
    } catch (e) {
      console.error('Error al eliminar factura:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo completar la anulación. Revisa tu conexión.'
      });
    } finally {
      setIsDeleting(false);
      setCompraToDelete(null);
    }
  };

  const handlePrint = async (e: React.MouseEvent, compra: Compra, mode: 'retention' | 'summary') => {
    e.stopPropagation();

    let loadedCompra = { ...compra } as any;
    // Always try to get the freshest and most complete provider data
    if (concesionario?.id) {
      try {
        const pSnap = await getDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', compra.proveedor_id));
        if (pSnap.exists()) {
          const pData = pSnap.data();
          loadedCompra.proveedor_nombre = pData.nombre || loadedCompra.proveedor_nombre;
          loadedCompra.proveedor_rif = pData.rif || loadedCompra.proveedor_rif;
          loadedCompra.proveedor_direccion = pData.direccion || loadedCompra.proveedor_direccion;
        }
      } catch (err) {
        console.error('Error fetching provider data for print:', err);
      }
    }

    setPrintData(loadedCompra as Compra);
    setPrintMode(mode);
    setIsPrinting(true);
  };

  const handleDownload = async (e: React.MouseEvent, compra: Compra, mode: 'retention' | 'summary') => {
    e.stopPropagation();

    let loadedCompra = { ...compra } as any;
    // Always try to get the freshest and most complete provider data
    if (concesionario?.id) {
      try {
        const pSnap = await getDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', compra.proveedor_id));
        if (pSnap.exists()) {
          const pData = pSnap.data();
          loadedCompra.proveedor_nombre = pData.nombre || loadedCompra.proveedor_nombre;
          loadedCompra.proveedor_rif = pData.rif || loadedCompra.proveedor_rif;
          loadedCompra.proveedor_direccion = pData.direccion || loadedCompra.proveedor_direccion;
        }
      } catch (err) {
        console.error('Error fetching provider data for download:', err);
      }
    }

    setPrintData(loadedCompra as Compra);
    setPrintMode(mode);

    // Wait for React to render the printData into the hidden root
    await new Promise(r => setTimeout(r, 200));

    const filename = mode === 'summary'
      ? `Resumen_Compra_${compra.numero_factura || 'N_A'}.pdf`
      : `Retencion_IVA_${(compra as any).numero_comprobante || 'N_A'}.pdf`;

    const element = document.getElementById('history-print-root');
    if (!element) return;

    // Use a temporary style change to filter pages for download capture
    const originalStyle = element.getAttribute('style') || '';

    try {
      const summaryPage = element.querySelector('[data-print-page="summary"]') as HTMLElement;
      const retentionPage = element.querySelector('[data-print-page="retention"]') as HTMLElement;

      if (mode === 'summary') {
        if (summaryPage) summaryPage.style.display = 'flex';
        if (retentionPage) retentionPage.style.display = 'none';
      } else {
        if (summaryPage) summaryPage.style.display = 'none';
        if (retentionPage) retentionPage.style.display = 'flex';
      }

      const { downloadPdf } = await import('@/lib/download-pdf');
      await downloadPdf({ elementId: 'history-print-root', filename });
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      element.setAttribute('style', originalStyle);
    }
  };

  const filteredCompras = useMemo(() => {
    return compras.filter(compra => {
      const gSearch = searchGeneral.toLowerCase().trim();
      const pSearch = searchProduct.toLowerCase().trim();
      const cSearch = searchCreator.toLowerCase().trim();

      const numFactura = (compra.numero_factura || '').toLowerCase();
      const proveedor = compra.proveedor_nombre.toLowerCase();

      const matchesGeneral = !gSearch || numFactura.includes(gSearch) || proveedor.includes(gSearch);

      const matchesCreator = !cSearch || (compra.creado_por?.toLowerCase() || '').includes(cSearch);

      const matchesProduct = !pSearch || compra.items.some(
        item => item.nombre.toLowerCase().includes(pSearch)
      );

      let matchesDate = true;
      const dateObj = compra.created_at?.toDate ? compra.created_at.toDate() : new Date();
      const dayStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()); // Medianoche local de la compra

      if (startDate) {
        const [y, m, d] = startDate.split('-');
        const dStart = new Date(Number(y), Number(m) - 1, Number(d));
        if (dayStart < dStart) matchesDate = false;
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-');
        const dEnd = new Date(Number(y), Number(m) - 1, Number(d));
        if (dayStart > dEnd) matchesDate = false;
      }

      return matchesGeneral && matchesCreator && matchesProduct && matchesDate;
    });
  }, [compras, searchGeneral, searchProduct, searchCreator, startDate, endDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:w-full max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white/70 backdrop-blur-2xl border-slate-200/60 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] rounded-[2rem]">
        <div className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-transparent">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-black flex items-center gap-3 text-slate-900 tracking-tight">
              <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 ring-1 ring-blue-600/20">
                <FileText className="h-6 w-6" />
              </div>
              Historial de Compras
            </DialogTitle>
          </DialogHeader>

          {/* Filters Grid - Light Premium Design */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <Input
                placeholder="Proveedor o factura..."
                value={searchGeneral}
                onChange={e => setSearchGeneral(e.target.value)}
                className="pl-10 bg-white/50 border-slate-200 focus:border-blue-500/50 focus:ring-blue-500/10 text-slate-900 placeholder:text-slate-400 transition-all h-12 rounded-xl"
              />
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <Input
                placeholder="Buscar por producto..."
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
                className="pl-10 bg-white/50 border-slate-200 focus:border-blue-500/50 focus:ring-blue-500/10 text-slate-900 placeholder:text-slate-400 transition-all h-12 rounded-xl"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 group">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-10 bg-white/50 border-slate-200 focus:border-blue-500/50 text-slate-900 transition-all h-12 rounded-xl"
                />
              </div>
              <div className="relative flex-1 group">
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-white/50 border-slate-200 focus:border-blue-500/50 text-slate-900 transition-all h-12 rounded-xl"
                />
              </div>
            </div>
          </div>

          {(startDate || endDate || searchGeneral || searchProduct || searchCreator) && (
            <div className="flex justify-end mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate(''); setEndDate('');
                  setSearchGeneral(''); setSearchProduct(''); setSearchCreator('');
                }}
                className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 text-xs font-bold uppercase tracking-widest"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>

        {/* List Area - Light Responsive Grid */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              </div>
              <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Sincronizando registros...</span>
            </div>
          ) : filteredCompras.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <Search className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-900">Sin resultados</h3>
              <p className="text-slate-500 mt-2 max-w-xs">No encontramos facturas que coincidan con tu búsqueda actual.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCompras.map((compra) => {
                const isExpanded = expandedRow === compra.id;
                const dateObj = compra.created_at?.toDate ? compra.created_at.toDate() : new Date();

                return (
                  <div
                    key={compra.id}
                    className={`group relative overflow-hidden transition-all duration-500 rounded-3xl border ${isExpanded
                        ? 'bg-white border-blue-200 shadow-[0_15px_30px_-10px_rgba(36,99,235,0.1)] ring-1 ring-blue-50'
                        : 'bg-white/40 border-slate-100 hover:border-slate-200 hover:bg-white/80 hover:shadow-md'
                      }`}
                  >
                    {/* Header Card Row */}
                    <div
                      className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-5"
                      onClick={() => setExpandedRow(isExpanded ? null : compra.id)}
                    >
                      <div className="flex items-start gap-5 flex-1">
                        <div className={`p-4 rounded-2xl transition-all duration-500 ${isExpanded ? 'bg-blue-600 shadow-lg shadow-blue-200 scale-105' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                          <Calendar className={`h-6 w-6 ${isExpanded ? 'text-white' : 'text-slate-600'}`} />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-slate-900 font-black text-xl tracking-tight">
                              {compra.proveedor_nombre}
                            </h4>
                            <Badge className={`px-2.5 py-0.5 rounded-lg font-bold text-[10px] uppercase tracking-tighter shadow-sm ${
                              compra.tipo_pago === 'credito' 
                                ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                : compra.tipo_pago === 'por_pagar'
                                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}>
                              {compra.tipo_pago === 'credito' 
                                ? `Crédito ${compra.dias_credito}d` 
                                : compra.tipo_pago === 'por_pagar'
                                  ? 'Por Pagar'
                                  : 'Contado'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                            <span className="flex items-center gap-2 font-bold text-slate-700">
                              {dateObj.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-500/50" />
                              <span className="font-medium">Fac: {compra.numero_factura || 'S/F'}</span>
                            </span>
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4 text-blue-500/50" />
                              <span className="font-medium italic">{compra.creado_por || '—'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-5 md:pt-0 border-slate-100">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                            {compra.moneda_original === 'bs' ? 'Total BS' : 'Total USD'}
                          </p>
                          <p className="text-3xl font-black text-blue-600 tabular-nums leading-none">
                            {compra.moneda_original === 'bs'
                              ? `Bs ${(compra.total_bs || (compra.total_usd * compra.tasa_cambio)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `$${compra.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            }
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-end gap-1 font-medium">
                            <span className="opacity-70">≈ </span>
                            {compra.moneda_original === 'bs'
                              ? `$${compra.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `Bs ${(compra.total_bs || (compra.total_usd * compra.tasa_cambio)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            }
                          </p>
                        </div>
                        <div className={`p-2.5 rounded-full transition-all duration-500 ${isExpanded ? 'rotate-180 bg-blue-50 text-blue-600 ring-1 ring-blue-100' : 'text-slate-300 bg-slate-50'}`}>
                          <ChevronDown className="h-6 w-6" />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail Overlay */}
                    {isExpanded && (
                      <div className="p-6 pt-0 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="h-px bg-slate-100 mb-6" />

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Items Section */}
                          <div className="lg:col-span-2 space-y-4">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Detalle de Ítems
                            </h5>
                            <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50/50 shadow-sm">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-100/50 text-slate-500 uppercase tracking-tighter font-black">
                                  <tr>
                                    <th className="text-left py-4 px-5">Descripción</th>
                                    <th className="text-center py-4 px-5 w-20">Cant</th>
                                    <th className="text-right py-4 px-5 w-32">
                                      Costo Unit ({compra.moneda_original === 'bs' ? 'BS' : '$'})
                                    </th>
                                    <th className="text-right py-4 px-5 w-36">
                                      Subtotal ({compra.moneda_original === 'bs' ? 'BS' : '$'})
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                  {compra.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-white transition-colors">
                                      <td className="py-4 px-5 font-bold text-slate-800">{item.nombre}</td>
                                      <td className="py-4 px-5 text-center font-mono">{item.cantidad}</td>
                                      <td className="py-4 px-5 text-right font-mono">
                                        {compra.moneda_original === 'bs'
                                          ? `Bs ${(item.costo_unitario_usd * compra.tasa_cambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                                          : `$${item.costo_unitario_usd.toFixed(2)}`
                                        }
                                      </td>
                                      <td className="py-4 px-5 text-right font-black text-slate-900 tabular-nums">
                                        {compra.moneda_original === 'bs'
                                          ? `Bs ${(item.subtotal_usd * compra.tasa_cambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                                          : `$${item.subtotal_usd.toFixed(2)}`
                                        }
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Financial Summary & Action Hub */}
                          <div className="space-y-6">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Resumen Fiscal ({compra.moneda_original === 'bs' ? 'BS' : 'USD'})
                            </h5>
                            <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100 space-y-4 shadow-sm">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Base Imponible:</span>
                                <span className="text-slate-900 font-bold">
                                  {compra.moneda_original === 'bs'
                                    ? `Bs ${(compra.subtotal_bs || (compra.subtotal_usd * compra.tasa_cambio)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                                    : `$${compra.subtotal_usd.toFixed(2)}`
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">I.V.A. (16%):</span>
                                <span className="text-slate-900 font-bold">
                                  {compra.moneda_original === 'bs'
                                    ? `Bs ${(compra.iva_monto_bs || (compra.iva_monto * compra.tasa_cambio)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                                    : `$${compra.iva_monto.toFixed(2)}`
                                  }
                                </span>
                              </div>
                              <div className="h-px bg-blue-100/50 my-2" />
                              <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                  <span className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Total Factura</span>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900 leading-none">
                                      {compra.moneda_original === 'bs'
                                        ? `Bs ${(compra.total_bs || (compra.total_usd * compra.tasa_cambio)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                                        : `$${compra.total_usd.toFixed(2)}`
                                      }
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right space-y-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                    Tasa BCV
                                  </span>
                                  <span className="block text-sm font-bold text-slate-600 tracking-tight">
                                    {compra.tasa_cambio.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons Hub */}
                            <div className="grid grid-cols-2 gap-3">
                              {(compra as any).numero_comprobante ? (
                                <>
                                  <Button
                                    variant="outline"
                                    onClick={(e) => handlePrint(e, compra, 'retention')}
                                    className="col-span-1 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl h-12 shadow-sm"
                                  >
                                    <Printer className="h-4 w-4 mr-2 text-blue-600" /> Retención
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={(e) => handleDownload(e, compra, 'retention')}
                                    className="col-span-1 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl h-12 shadow-sm"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : null}

                              <Button
                                variant="outline"
                                onClick={(e) => handlePrint(e, compra, 'summary')}
                                className="col-span-1 bg-blue-600/5 border-blue-200 hover:bg-blue-600/10 text-blue-700 font-bold rounded-xl h-12 shadow-sm"
                              >
                                <Printer className="h-4 w-4 mr-2" /> Resumen
                              </Button>
                              <Button
                                variant="outline"
                                onClick={(e) => handleDownload(e, compra, 'summary')}
                                className="col-span-1 bg-blue-600/5 border-blue-200 hover:bg-blue-600/10 text-blue-700 rounded-xl h-12 shadow-sm"
                              >
                                <Download className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                disabled={isDeleting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCompraToDelete(compra);
                                  setDeductInventory(true);
                                  setDeleteModalOpen(true);
                                }}
                                className="col-span-2 mt-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold uppercase text-[10px] tracking-[0.2em] rounded-xl h-12"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Anular Documento
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
          )}
        </div>
      </DialogContent>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-sm p-5 border-destructive/20 shadow-xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-full flex items-center justify-center -mb-2">
              <Trash2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-xl">¿Anular esta factura?</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Esta acción es irreversible. La factura será eliminada permanentemente.
            </p>

            <div className="bg-muted p-4 mt-2 mb-2 w-full flex items-start gap-3 rounded-lg border text-left cursor-pointer transition-colors hover:bg-muted/80" onClick={() => setDeductInventory(!deductInventory)}>
              <div className="flex items-center h-5 mt-0.5">
                <input
                  type="checkbox"
                  checked={deductInventory}
                  onChange={e => setDeductInventory(e.target.checked)}
                  onClick={e => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Eliminar del inventario</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {(() => {
                    const count = compraToDelete?.items?.filter(i => !i.producto_id.startsWith('new-')).reduce((a, b) => a + Number(b.cantidad), 0) || 0;
                    if (count === 0) return "Esta compra no tiene productos vinculados al inventario.";
                    return `Restará automáticamente ${count} unidades del stock actual.`;
                  })()}
                </span>
              </div>
            </div>

            <div className="flex w-full gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" className="flex-1" disabled={isDeleting} onClick={executeDelete}>
                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Sí, Anular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable Sheet (hidden by default, only shown when printing) */}
      {printData && (() => {
        const isBs = printData.moneda_original === 'bs';
        const sym = isBs ? 'Bs' : '$';
        const formatAmt = (usd: number) => (isBs && printData.tasa_cambio ? usd * printData.tasa_cambio : usd).toFixed(2);
        const hasIva = printData.iva_monto > 0;
        const formatBs = (usd: number) => (usd * (printData.tasa_cambio || 1)).toFixed(2);
        const hasRetention = !!(printData as any).numero_comprobante;
        const registeredAt = (printData as any).created_at?.toDate ? (printData as any).created_at.toDate() : new Date();

        const formatDateVE = (dateStr: string) => {
          if (!dateStr) return '—';
          // Unified format YYYY/MM/DD
          if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
          }
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[0].length === 4) return dateStr; // already YYYY/MM/DD
            const [d, m, y] = parts;
            return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
          }
          return dateStr;
        };

        const montoExento = (printData.items || []).reduce((acc, item) => !item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);
        const montoGravable = (printData.items || []).reduce((acc, item) => item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);

        const getBsNumber = (usd: number) => (usd * (printData.tasa_cambio || 1));

        const subtotalPlusIva = (montoExento + montoGravable + (printData.iva_monto || 0));
        const igtfUsd = !isBs ? (subtotalPlusIva * 0.03) : 0;
        const finalTotalUsd = subtotalPlusIva + igtfUsd;

        const totalBsNum = getBsNumber(finalTotalUsd);
        const exentoBsNum = getBsNumber(montoExento);
        const gravableBsNum = getBsNumber(montoGravable);
        const ivaBsNum = getBsNumber(printData.iva_monto || 0);
        const igtfBsNum = getBsNumber(igtfUsd);

        const pctRet = (printData as any).porcentaje_retencion_aplicado || 100;
        const ivaRetBsNum = ivaBsNum * (pctRet / 100);
        const netoAPagarBsNum = totalBsNum - ivaRetBsNum;

        const formatBsVal = (val: number) => val.toFixed(2);

        return (
          <div id="history-print-root" style={{ display: 'none' }}>
            <style dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  body * { visibility: hidden !important; }
                  #history-print-root, #history-print-root * { visibility: visible !important; }
                  #history-print-root { 
                    display: block !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 210mm !important;
                  }
                }
                @page { size: A4 portrait; margin: 0; }
                .print-root { width: 100%; background: white !important; }
                .page-break-after { page-break-after: always; break-after: page; }
            `}} />
            <div key={`history-print-${printData.id}-${printMode}`} className="print-root text-black font-sans bg-white w-[210mm]">
              {/* PAGE 1: PURCHASE SUMMARY */}
              {(printMode === 'both' || printMode === 'summary') && (
                <div
                  data-print-page="summary"
                  className={hasRetention && printMode === 'both' ? 'page-break-after' : ''}
                  style={{ padding: '8mm 15mm 5mm 15mm', height: '297mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>{concesionario?.logo_url
                      ? <img src={concesionario.logo_url} alt="Logo" crossOrigin="anonymous" style={{ width: 65, height: 65, objectFit: 'contain' }} />
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
                      <p style={{ margin: '2px 0' }}><strong>N° Factura:</strong> {printData.numero_factura || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>N° Control:</strong> {printData.numero_control || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {printData.proveedor_nombre} {printData.proveedor_rif ? `(${printData.proveedor_rif})` : ''}</p>
                      {printData.fecha_factura && <p style={{ margin: '2px 0' }}><strong>Fecha Factura:</strong> {formatDateVE(printData.fecha_factura)}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {`${registeredAt.getFullYear()}/${String(registeredAt.getMonth() + 1).padStart(2, '0')}/${String(registeredAt.getDate()).padStart(2, '0')}`}</p>
                      <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {printData.tasa_cambio ? `Bs ${printData.tasa_cambio.toFixed(2)}` : 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {printData.creado_por || 'Administrador'}</p>
                      {hasRetention && <p style={{ margin: '2px 0' }}><strong>N° Retención IVA:</strong> {printData.numero_comprobante}</p>}
                    </div>
                    {/* Disclaimer centered at the bottom of the grid box */}
                    <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, borderTop: '0.5px solid #ffffffff', paddingTop: 6 }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
                        Este documento no tiene validez fiscal.
                      </p>
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
                      {(printData.items || []).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{item.codigo || item.producto_id.split('-').pop()?.slice(0, 8)}</td>
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
                        <span style={{ fontWeight: 600 }}>IVA (16%):</span><span>{sym}{formatAmt(printData.iva_monto || 0)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontWeight: 600 }}>IGTF (3%):</span>
                        <span>{sym}{formatAmt(igtfUsd)}</span>
                      </div>
                      {!isBs && printData.tasa_cambio && (
                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>
                          Equiv: Bs {igtfBsNum.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '2px solid #d1d5db', paddingTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: 15 }}>
                        <span>Total:</span><span style={{ color: '#2563eb' }}>{sym}{formatAmt(finalTotalUsd)}</span>
                      </div>
                      {!isBs && printData.tasa_cambio && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          Equivalente: Bs {totalBsNum.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* PAGE 2: COMPROBANTE DE RETENCIÓN */}
              {hasRetention && (printMode === 'both' || printMode === 'retention') && (
                <div data-print-page="retention" style={{ display: 'flex', flexDirection: 'column' }}>
                  <LegalRetentionVoucher
                    concesionario={concesionario}
                    data={{
                      currency: 'USD',
                      exchange_rate: printData.tasa_cambio,
                      iva_retention_number: (printData as any).numero_comprobante || '',
                      invoice_number: printData.numero_factura || '',
                      control_number: printData.numero_control,
                      date: formatDateVE(printData.fecha_factura || ''),
                      original_invoice_date: formatDateVE(printData.fecha_factura || ''),
                      provider_name: printData.proveedor_nombre,
                      provider_rif: printData.proveedor_rif || '',
                      provider_direccion: printData.proveedor_direccion,
                      taxable_amount: montoGravable,
                      exempt_amount: montoExento,
                      iva_amount: printData.iva_monto,
                      total_amount: subtotalPlusIva,
                      igtf_amount: igtfUsd,
                      retention_iva_rate: (printData as any).porcentaje_retencion_aplicado,
                      type: 'EXPENSE'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </Dialog>
  );
}
