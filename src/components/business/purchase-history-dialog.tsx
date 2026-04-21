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
import { Search, Loader2, Calendar, FileText, User, ChevronDown, ChevronUp, Printer, Download, Trash2, ShieldCheck, AlertCircle, Package } from 'lucide-react';
import type { Compra } from '@/lib/business-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { LegalRetentionVoucher } from './legal-retention-voucher';
import { DeliveryNotePrint } from './delivery-note-print';
import { downloadPdf } from '@/lib/download-pdf';

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

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Printing state
  const [printData, setPrintData] = useState<Compra | null>(null);
  const [printMode, setPrintMode] = useState<'summary' | 'retention' | 'both'>('summary');

  useEffect(() => {
    if (open && concesionario?.id) {
      fetchPurchases();
    }
  }, [open, concesionario?.id]);

  const fetchPurchases = async () => {
    if (!concesionario?.id) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(firestore, 'concesionarios', concesionario.id, 'compras'),
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() } as Compra)));
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al cargar historial' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCompras = useMemo(() => {
    return compras.filter(c => {
      const matchesGeneral = !searchGeneral || 
        c.proveedor_nombre.toLowerCase().includes(searchGeneral.toLowerCase()) ||
        (c.numero_factura || '').toLowerCase().includes(searchGeneral.toLowerCase());
      
      const matchesProduct = !searchProduct || 
        c.items.some(it => it.nombre.toLowerCase().includes(searchProduct.toLowerCase()) || (it.codigo || '').toLowerCase().includes(searchProduct.toLowerCase()));
      
      const matchesCreator = !searchCreator || 
        c.creado_por.toLowerCase().includes(searchCreator.toLowerCase());

      const purchaseDate = c.created_at?.toDate ? c.created_at.toDate() : new Date();
      purchaseDate.setHours(0, 0, 0, 0);

      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (purchaseDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        if (purchaseDate > end) matchesDate = false;
      }

      return matchesGeneral && matchesProduct && matchesCreator && matchesDate;
    });
  }, [compras, searchGeneral, searchProduct, searchCreator, startDate, endDate]);

  const handlePrintSummary = (compra: Compra) => {
    setPrintData(compra);
    setPrintMode('summary');
    setTimeout(() => {
      const element = document.getElementById('history-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  const handlePrintRetention = (compra: Compra) => {
    setPrintData(compra);
    setPrintMode('retention');
    setTimeout(() => {
      const element = document.getElementById('history-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  const handleDownloadSummary = async (compra: Compra) => {
    setPrintData(compra);
    setPrintMode('summary');
    const filename = compra.is_fiscal === false 
      ? `Nota_Entrega_${compra.numero_factura || 'SN'}.pdf`
      : `Resumen_Compra_${compra.numero_factura || 'SN'}.pdf`;
    
    // Wait for React to render the hidden print content
    await new Promise(r => setTimeout(r, 400));
    await downloadPdf({ elementId: 'history-print-root', filename });
  };

  const executeDelete = async () => {
    if (!concesionario?.id || !compraToDelete) return;
    setIsDeleting(true);
    try {
      // 1. If deductInventory is true, reverse stock
      if (deductInventory) {
        await Promise.all(compraToDelete.items.map(it => {
          return updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'productos', it.producto_id), {
            stock_actual: increment(-it.cantidad),
            updated_at: serverTimestamp()
          });
        }));
      }

      // 2. Delete the purchase doc
      await deleteDoc(doc(firestore, 'concesionarios', concesionario.id, 'compras', compraToDelete.id));

      toast({ title: '✓ Compra anulada correctamente' });
      setDeleteModalOpen(false);
      setCompraToDelete(null);
      fetchPurchases();
      if (onPurchaseDeleted) onPurchaseDeleted();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al anular compra' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
        <DialogHeader className="px-6 py-4 border-b bg-white dark:bg-slate-900 shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" /> Historial de Compras y Entradas
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 bg-white dark:bg-slate-900 border-b grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Proveedor o Factura..." 
                className="pl-8 h-9 text-sm"
                value={searchGeneral}
                onChange={e => setSearchGeneral(e.target.value)}
              />
            </div>
            <div className="relative">
              <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Producto..." 
                className="pl-8 h-9 text-sm"
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="date" 
                  className="pl-8 h-9 text-xs" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <span className="text-slate-400 text-xs font-bold">AL</span>
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="date" 
                  className="pl-8 h-9 text-xs"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                <p className="text-slate-400 text-sm font-medium">Cargando registros...</p>
              </div>
            ) : filteredCompras.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-slate-400 text-sm italic">No se encontraron resultados</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b z-10">
                  <tr className="text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="p-4 w-10"></th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Proveedor</th>
                    <th className="p-4">Documento</th>
                    <th className="p-4 text-right">Total ($)</th>
                    <th className="p-4 text-center">Tipo</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-transparent">
                  {filteredCompras.map(compra => {
                    const isExpanded = expandedId === compra.id;
                    const date = compra.created_at?.toDate ? compra.created_at.toDate() : new Date();
                    const isDeliveryNote = compra.is_fiscal === false;

                    return (
                      <React.Fragment key={compra.id}>
                        <tr className={cn(
                          "hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group",
                          isExpanded && "bg-slate-50 dark:bg-slate-900/50 border-l-2 border-primary"
                        )} onClick={() => setExpandedId(isExpanded ? null : compra.id)}>
                          <td className="p-4">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />}
                          </td>
                          <td className="p-4 font-medium whitespace-nowrap">
                            {date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{compra.proveedor_nombre}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-tighter">ID: {compra.proveedor_id.slice(-6)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-bold text-slate-500">#{compra.numero_factura || 'S/N'}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-medium">{isDeliveryNote ? 'Nota de Entrega' : 'Factura Fiscal'}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-black text-slate-700 dark:text-slate-200">
                            ${compra.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-center">
                            <Badge variant="outline" className="capitalize text-[10px] py-0 h-5 border-slate-200">
                              {compra.tipo_pago === 'credito' ? `Crédito ${compra.dias_credito}d` : 'Contado'}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center">
                              {compra.estado === 'pagada' ? (
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" title="Pagada" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 animate-pulse" title="Pendiente" />
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-300 hover:text-destructive transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompraToDelete(compra);
                                setDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                            <td colSpan={8} className="p-0 border-b border-slate-100 dark:border-slate-800">
                              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-top-2 duration-300">
                                {/* Details Col */}
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-1">Detalle del Documento</h4>
                                  <div className="grid grid-cols-2 gap-y-3 text-xs">
                                    <span className="text-slate-500 font-medium">Registrado por:</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{compra.creado_por}</span>
                                    
                                    <span className="text-slate-500 font-medium">Moneda Original:</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">{compra.moneda_original || 'USD'}</span>
                                    
                                    <span className="text-slate-500 font-medium">Tasa BCV:</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{compra.tasa_cambio.toFixed(2)} Bs</span>

                                    {!isDeliveryNote && (
                                      <>
                                        <span className="text-slate-500 font-medium">N° Control:</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{compra.numero_control || 'N/A'}</span>
                                      </>
                                    )}

                                    {compra.numero_comprobante && (
                                      <>
                                        <span className="text-slate-500 font-medium">Retención IVA:</span>
                                        <span className="font-bold text-emerald-600">{compra.numero_comprobante}</span>
                                      </>
                                    )}
                                  </div>

                                  <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" className="h-8 gap-2 text-[10px] font-bold uppercase rounded-lg border-slate-200" onClick={() => handlePrintSummary(compra)}>
                                      <Printer className="w-3.5 h-3.5" /> Imprimir {isDeliveryNote ? 'Nota' : 'Resumen'}
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 w-8 rounded-lg p-0 border-slate-200" onClick={() => handleDownloadSummary(compra)}>
                                      <Download className="w-3.5 h-3.5" />
                                    </Button>
                                    {compra.numero_comprobante && (
                                      <Button variant="outline" size="sm" className="h-8 gap-2 text-[10px] font-bold uppercase rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => handlePrintRetention(compra)}>
                                        <ShieldCheck className="w-3.5 h-3.5" /> Retención
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Items Col */}
                                <div className="md:col-span-2 space-y-4">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-1">Productos Cargados</h4>
                                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                                    <table className="w-full text-[11px]">
                                      <thead className="bg-slate-50 dark:bg-slate-800">
                                        <tr className="text-left text-slate-400 font-bold">
                                          <th className="p-2 pl-4">Producto</th>
                                          <th className="p-2 text-center">Cant</th>
                                          <th className="p-2 text-right">Costo ($)</th>
                                          <th className="p-2 text-right pr-4">Subtotal ($)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {compra.items.map((it, idx) => (
                                          <tr key={idx}>
                                            <td className="p-2 pl-4">
                                              <p className="font-bold text-slate-700 dark:text-slate-200">{it.nombre}</p>
                                              <p className="text-[9px] text-slate-400 font-mono">{it.codigo || 'S/N'}</p>
                                            </td>
                                            <td className="p-2 text-center font-medium">{it.cantidad}</td>
                                            <td className="p-2 text-right text-slate-500">${it.costo_unitario_usd.toFixed(2)}</td>
                                            <td className="p-2 text-right font-bold pr-4 text-slate-700 dark:text-slate-200">${it.subtotal_usd.toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-slate-50/50 dark:bg-slate-800/50 font-bold border-t border-slate-100 dark:border-slate-800">
                                        <tr>
                                          <td colSpan={3} className="p-2 pl-4 text-slate-400 uppercase text-[9px]">Total Administrativo</td>
                                          <td className="p-2 text-right pr-4 text-slate-900 dark:text-white">${compra.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
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
        </div>
      </DialogContent>

      {/* Delete Confirmation */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-full flex items-center justify-center -mb-2">
              <Trash2 className="w-7 h-7" />
            </div>
            
            <DialogTitle className="text-xl">¿Anular esta factura?</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Esta acción no se puede deshacer. Se eliminará el registro de compra permanentemente.
            </p>

            <div className="bg-muted p-4 mt-2 mb-2 w-full flex items-start gap-3 rounded-lg border text-left cursor-pointer transition-colors hover:bg-muted/80" onClick={() => setDeductInventory(!deductInventory)}>
              <div className="flex items-center h-5 mt-0.5">
                <input
                  type="checkbox"
                  checked={deductInventory}
                  onChange={() => {}} // Controlled by div click
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Eliminar del inventario</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {(() => {
                    if (!compraToDelete) return '';
                    const count = compraToDelete.items.reduce((acc, it) => acc + it.cantidad, 0);
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

        if (!printData.is_fiscal) {
          return (
            <DeliveryNotePrint 
              data={printData} 
              concesionario={concesionario} 
              id="history-print-root" 
            />
          );
        }

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
                    left: 0 !important; top: 0 !important;
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>IVA (16%):</span><span>{sym}{formatAmt(printData.iva_monto || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontWeight: 600 }}>IGTF (3%):</span>
                        <span>{sym}{formatAmt(igtfUsd)}</span>
                      </div>
                      {!isBs && printData.tasa_cambio && (
                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>Bs {getBsNumber(igtfUsd).toFixed(2)}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '2px solid #d1d5db', paddingTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: 15 }}>
                        <span>Total:</span><span style={{ color: '#2563eb' }}>{sym}{formatAmt(finalTotalUsd)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                        {isBs ? `Ref: $${finalTotalUsd.toFixed(2)}` : `Equiv: Bs ${formatBsVal(totalBsNum)}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                    <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 1, margin: 0 }}>Zona Motores Business - Sistema de Gestión Automotriz</p>
                  </div>
                </div>
              )}
              {/* PAGE 2: RETENTION (Only if exists) */}
              {hasRetention && (printMode === 'both' || printMode === 'retention') && (
                <div data-print-page="retention" style={{ display: 'flex', flexDirection: 'column' }}>
                  <LegalRetentionVoucher
                    concesionario={concesionario}
                    compra={printData}
                    config={{
                      montoExento,
                      montoGravable,
                      ivaMonto: printData.iva_monto || 0,
                      totalUsd: finalTotalUsd,
                      tasaCambio: printData.tasa_cambio || 1,
                      isBs,
                      formatBs: formatBsVal
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
