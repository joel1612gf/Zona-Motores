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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente'>('all');

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

      const matchesStatus = statusFilter === 'all' || c.estado !== 'pagada';

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

      return matchesGeneral && matchesProduct && matchesCreator && matchesDate && matchesStatus;
    });
  }, [compras, searchGeneral, searchProduct, searchCreator, startDate, endDate, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredCompras.reduce((acc, c) => acc + c.total_usd, 0);
    const count = compras.length;
    const pending = compras.filter(c => c.estado !== 'pagada').length;
    return { total, count, pending };
  }, [compras, filteredCompras]);

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
    
    await new Promise(r => setTimeout(r, 400));
    await downloadPdf({ elementId: 'history-print-root', filename });
  };

  const executeDelete = async () => {
    if (!concesionario?.id || !compraToDelete) return;
    setIsDeleting(true);
    try {
      if (deductInventory) {
        await Promise.all(compraToDelete.items.map(it => {
          return updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'productos', it.producto_id), {
            stock_actual: increment(-it.cantidad),
            updated_at: serverTimestamp()
          });
        }));
      }

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
      <DialogContent className="w-[96vw] max-w-6xl h-[92vh] md:h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-2xl rounded-[2rem] md:rounded-3xl">
        <DialogHeader className="px-6 py-5 border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <DialogTitle className="text-2xl font-black flex items-center gap-3 text-slate-800 dark:text-white">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span>Historial de Compras</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Gestión de Inventario</span>
              </div>
            </DialogTitle>
            
            {/* Quick Stats & Filters */}
            <div className="flex items-center gap-6">
              <div className="hidden lg:flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Periodo</span>
                <span className="text-2xl font-black text-primary leading-none tracking-tighter">
                  ${stats.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden md:block mx-1" />
              <div className="flex gap-2">
                <button 
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    "flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-300 border shadow-sm min-w-[100px]",
                    statusFilter === 'all' 
                      ? "bg-primary border-primary text-white shadow-primary/20 scale-105" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-primary/30"
                  )}
                >
                  <span className="text-xs font-black uppercase tracking-widest">{stats.count}</span>
                  <span className="text-[9px] font-bold uppercase opacity-70">Todos</span>
                </button>

                {stats.pending > 0 && (
                  <button 
                    onClick={() => setStatusFilter('pendiente')}
                    className={cn(
                      "flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-300 border shadow-sm min-w-[100px]",
                      statusFilter === 'pendiente' 
                        ? "bg-slate-800 border-slate-800 text-white scale-105" 
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-400"
                    )}
                  >
                    <span className="text-xs font-black uppercase tracking-widest">{stats.pending}</span>
                    <span className="text-[9px] font-bold uppercase opacity-70">Pendientes</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters Bar - More compact and visual */}
          <div className="px-6 py-4 bg-white/30 dark:bg-slate-900/30 border-b grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0 items-end">
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Búsqueda Principal</label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Proveedor, Factura o N° Control..." 
                  className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-primary/20 rounded-xl transition-all"
                  value={searchGeneral}
                  onChange={e => setSearchGeneral(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-3 space-y-1.5 hidden md:block">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Producto Específico</label>
              <div className="relative group">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Nombre o Código..." 
                  className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Rango de Fechas</label>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 px-2 h-11 shadow-sm">
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input 
                    type="date" 
                    className="pl-7 h-8 border-none bg-transparent text-xs focus-visible:ring-0" 
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input 
                    type="date" 
                    className="pl-7 h-8 border-none bg-transparent text-xs focus-visible:ring-0"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-slate-50/50 dark:bg-slate-950/50">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <Loader2 className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
                </div>
                <p className="text-slate-500 text-sm font-bold tracking-tight">Sincronizando historial...</p>
              </div>
            ) : filteredCompras.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-3xl flex items-center justify-center text-slate-300 dark:text-slate-700 shadow-inner">
                  <Search className="w-10 h-10" />
                </div>
                <div className="text-center">
                  <p className="text-slate-800 dark:text-slate-200 font-bold">No se encontraron registros</p>
                  <p className="text-slate-400 text-xs mt-1">Intenta ajustando los filtros de búsqueda</p>
                </div>
                <Button variant="ghost" className="text-xs text-primary font-bold uppercase" onClick={() => {
                  setSearchGeneral('');
                  setSearchProduct('');
                  setSearchCreator('');
                  setStatusFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}>
                  Limpiar todos los filtros
                </Button>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-3">
                {/* Header (Desktop Only) */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <div className="col-span-2">Fecha</div>
                  <div className="col-span-3">Proveedor / RIF</div>
                  <div className="col-span-2">Documento</div>
                  <div className="col-span-2 text-right">Monto Total</div>
                  <div className="col-span-2 text-center">Estado</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Rows */}
                {filteredCompras.map(compra => {
                  const isExpanded = expandedId === compra.id;
                  const date = compra.created_at?.toDate ? compra.created_at.toDate() : new Date();
                  const isDeliveryNote = compra.is_fiscal === false;

                  return (
                    <div 
                      key={compra.id}
                      className={cn(
                        "group bg-white dark:bg-slate-900 rounded-[1.5rem] border transition-all duration-500 overflow-hidden shadow-sm",
                        isExpanded 
                          ? "ring-2 ring-primary/30 shadow-2xl border-transparent scale-[1.01] z-20" 
                          : "border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
                      )}
                    >
                      <div 
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center p-4 md:px-6 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : compra.id)}
                      >
                        {/* Fecha Mobile/Desktop */}
                        <div className="col-span-2 flex items-center gap-4">
                          <div className={cn(
                            "w-11 h-11 rounded-2xl flex flex-col items-center justify-center transition-all duration-300",
                            isExpanded ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          )}>
                            <span className="text-[10px] font-black leading-none uppercase">{date.toLocaleDateString('es-VE', { month: 'short' })}</span>
                            <span className="text-lg font-black leading-none mt-1">{date.getDate()}</span>
                          </div>
                          <div className="flex flex-col md:hidden flex-1 truncate">
                            <span className="font-black text-slate-800 dark:text-slate-200 text-sm truncate">{compra.proveedor_nombre}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[9px] h-4 px-1 font-black opacity-70">#{compra.numero_factura || 'SN'}</Badge>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">{isDeliveryNote ? 'Nota' : 'Factura'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Proveedor Desktop */}
                        <div className="hidden md:flex col-span-3 flex-col">
                          <span className="font-black text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors truncate">
                            {compra.proveedor_nombre}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter font-bold">
                            RIF: {compra.proveedor_rif || 'S/R'}
                          </span>
                        </div>

                        {/* Documento Desktop */}
                        <div className="hidden md:flex col-span-2 flex-col">
                          <Badge variant="outline" className="w-fit text-[9px] font-black uppercase px-2 h-5 rounded-md mb-1 border-slate-200 dark:border-slate-800 text-slate-500">
                            {isDeliveryNote ? 'Nota Entrega' : 'Factura Fiscal'}
                          </Badge>
                          <span className="text-xs font-black text-slate-400 font-mono tracking-tighter">
                            #{compra.numero_factura || 'S/N'}
                          </span>
                        </div>

                        {/* Monto */}
                        <div className="col-span-2 flex md:flex-col justify-between items-center md:items-end">
                          <span className="md:hidden text-[10px] font-black uppercase text-slate-400 tracking-widest">Inversión:</span>
                          <div className="flex flex-col items-end">
                            <span className="text-xl font-black text-slate-800 dark:text-white leading-tight tracking-tighter">
                              ${compra.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">
                              {compra.estado !== 'pagada' ? (
                                <span className="text-primary dark:text-blue-400 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">Por Pagar</span>
                              ) : (
                                <span className="text-slate-400">{compra.tipo_pago === 'credito' ? `Crédito ${compra.dias_credito}d` : 'Contado'}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Estado */}
                        <div className="col-span-2 flex md:justify-center items-center justify-between">
                          <span className="md:hidden text-[10px] font-black uppercase text-slate-400 tracking-widest">Estado:</span>
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-800 shadow-sm transition-all",
                            compra.estado === 'pagada' ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "text-slate-400 bg-slate-50 dark:bg-slate-900"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", compra.estado === 'pagada' ? "bg-emerald-500" : "bg-slate-300")} />
                            {compra.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                          </div>
                        </div>

                        {/* Acciones Rápidas */}
                        <div className="col-span-1 flex justify-end items-center gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl text-slate-300 hover:text-destructive hover:bg-destructive/10 transition-all hidden md:flex"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompraToDelete(compra);
                              setDeleteModalOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                            isExpanded ? "rotate-180 bg-primary/10 text-primary" : "text-slate-300 bg-slate-100 dark:bg-slate-800"
                          )}>
                            <ChevronDown className="w-5 h-5" />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                            {/* General Data Card */}
                            <div className="md:col-span-4 space-y-6">
                              <div className="space-y-4">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                  <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Detalles de Auditoría
                                </h4>
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-5">
                                  <div className="grid grid-cols-2 gap-y-5 text-xs">
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-slate-400 font-bold uppercase text-[9px]">Registrado por</span>
                                      <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-black">
                                          {compra.creado_por.charAt(0)}
                                        </div>
                                        {compra.creado_por}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 text-right">
                                      <span className="text-slate-400 font-bold uppercase text-[9px]">Tasa Aplicada</span>
                                      <span className="font-black text-slate-800 dark:text-slate-200 tracking-tighter">{compra.tasa_cambio.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-slate-400 font-bold uppercase text-[9px]">Moneda Original</span>
                                      <Badge variant="outline" className="w-fit text-[10px] font-black uppercase border-slate-200 bg-slate-50 dark:bg-slate-800 px-2 py-0.5">{compra.moneda_original || 'USD'}</Badge>
                                    </div>
                                    {!isDeliveryNote && (
                                      <div className="flex flex-col gap-1.5 text-right">
                                        <span className="text-slate-400 font-bold uppercase text-[9px]">N° Control</span>
                                        <span className="font-mono font-black text-slate-400 tracking-tighter">{compra.numero_control || 'N/A'}</span>
                                      </div>
                                    )}
                                  </div>

                                  {compra.numero_comprobante && (
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                      <div className="flex flex-col gap-1">
                                        <span className="text-primary font-black uppercase text-[9px]">Retención de IVA</span>
                                        <span className="font-black text-slate-800 dark:text-slate-200 text-sm tracking-tight">{compra.numero_comprobante}</span>
                                      </div>
                                      <Badge variant="outline" className="border-slate-200 text-slate-400 font-black text-[9px] tracking-widest uppercase bg-slate-50 dark:bg-slate-800">Procesado</Badge>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-3">
                                {/* Fila Factura/Nota */}
                                <div className="flex gap-2">
                                  <Button 
                                    className="flex-1 h-12 gap-2 text-[11px] font-black uppercase rounded-[1.25rem] bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all active:scale-95"
                                    onClick={() => handlePrintSummary(compra)}
                                  >
                                    <Printer className="w-4 h-4" /> {isDeliveryNote ? 'Imprimir Nota' : 'Imprimir Factura'}
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className="h-12 w-12 rounded-[1.25rem] p-0 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                                    onClick={() => handleDownloadSummary(compra)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>

                                {/* Fila Comprobante IVA (Solo si existe) */}
                                {compra.numero_comprobante && (
                                  <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <Button 
                                      variant="outline" 
                                      className="flex-1 h-12 gap-2 text-[11px] font-black uppercase rounded-[1.25rem] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                                      onClick={() => handlePrintRetention(compra)}
                                    >
                                      <ShieldCheck className="w-4 h-4 text-primary" /> Imprimir Comprobante IVA
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      className="h-12 w-12 rounded-[1.25rem] p-0 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                                      onClick={async () => {
                                        setPrintData(compra);
                                        setPrintMode('retention');
                                        await new Promise(r => setTimeout(r, 400));
                                        await downloadPdf({ 
                                          elementId: 'history-print-root', 
                                          filename: `Retencion_IVA_${compra.numero_comprobante}.pdf` 
                                        });
                                      }}
                                    >
                                      <Download className="w-4 h-4 text-primary" />
                                    </Button>
                                  </div>
                                )}

                                <Button
                                  variant="ghost"
                                  className="md:hidden h-11 text-xs font-bold text-destructive hover:bg-destructive/5 rounded-xl mt-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCompraToDelete(compra);
                                    setDeleteModalOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Anular este registro
                                </Button>
                              </div>
                            </div>

                            {/* Items Card */}
                            <div className="md:col-span-8 space-y-4">
                              <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                <Package className="w-3.5 h-3.5 text-primary" /> Detalle de Productos
                              </h4>
                              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
                                <div className="overflow-x-auto scrollbar-hide">
                                  <table className="w-full">
                                    <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                                      <tr className="text-left text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">
                                        <th className="px-6 py-5">Descripción</th>
                                        <th className="px-4 py-5 text-center">Cant</th>
                                        <th className="px-4 py-5 text-right">Costo Unit.</th>
                                        <th className="px-6 py-5 text-right">Total Item</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {compra.items.map((it, idx) => {
                                        const isBs = compra.moneda_original === 'bs';
                                        const unitOrig = isBs ? (it.costo_unitario_usd * compra.tasa_cambio) : it.costo_unitario_usd;
                                        const subOrig = isBs ? (it.subtotal_usd * compra.tasa_cambio) : it.subtotal_usd;
                                        const unitRef = isBs ? it.costo_unitario_usd : (it.costo_unitario_usd * compra.tasa_cambio);
                                        const subRef = isBs ? it.subtotal_usd : (it.subtotal_usd * compra.tasa_cambio);

                                        return (
                                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors text-slate-600 dark:text-slate-400">
                                            <td className="px-6 py-5">
                                              <div className="flex flex-col">
                                                <span className="font-black text-slate-800 dark:text-slate-200 text-[13px] tracking-tight leading-none mb-1">{it.nombre}</span>
                                                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-widest">{it.codigo || 'SIN CÓDIGO'}</span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 shadow-inner">
                                                {it.cantidad}
                                              </span>
                                            </td>
                                            <td className="px-4 py-5 text-right">
                                              <div className="flex flex-col">
                                                <span className="font-black text-[13px] text-slate-800 dark:text-slate-200 tracking-tighter">
                                                  {isBs ? 'Bs' : '$'} {unitOrig.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase italic tracking-tighter">
                                                  Ref: {isBs ? '$' : 'Bs'} {unitRef.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                              <div className="flex flex-col">
                                                <span className="font-black text-[14px] text-primary tracking-tighter">
                                                  {isBs ? 'Bs' : '$'} {subOrig.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-black uppercase italic tracking-tighter">
                                                  Ref: {isBs ? '$' : 'Bs'} {subRef.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-50/80 dark:bg-slate-800/30 border-t-2 border-slate-100 dark:border-slate-800">
                                      <tr>
                                        <td colSpan={3} className="px-6 py-6 text-right">
                                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Inversión Total:</span>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                          <div className="flex flex-col">
                                            <span className="text-xl font-black text-primary tracking-tighter leading-none mb-1">
                                              {compra.moneda_original === 'bs' ? 'Bs' : '$'} {(compra.moneda_original === 'bs' ? (compra.total_usd * compra.tasa_cambio) : compra.total_usd).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                              Equivalente: {compra.moneda_original === 'bs' ? '$' : 'Bs'} {(compra.moneda_original === 'bs' ? compra.total_usd : (compra.total_usd * compra.tasa_cambio)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                  <AlertCircle className="w-5 h-5 text-primary" />
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                  Operación registrada por <strong>{compra.creado_por}</strong> el día <strong>{date.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>. El inventario ha sido actualizado y conciliado exitosamente.
                                </p>
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
        </div>
      </DialogContent>

      {/* Delete Confirmation */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl p-6 rounded-[2rem]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center -mb-2 shadow-inner">
              <Trash2 className="w-8 h-8" />
            </div>
            
            <DialogTitle className="text-2xl font-black tracking-tight">¿Anular esta compra?</DialogTitle>
            <p className="text-slate-500 text-sm font-medium px-4 leading-relaxed">
              Esta acción eliminará el registro permanentemente. ¿Deseas también revertir el stock de los productos?
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 p-5 mt-2 mb-2 w-full flex items-start gap-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-700/50 group" onClick={() => setDeductInventory(!deductInventory)}>
              <div className="flex items-center h-5 mt-1">
                <input
                  type="checkbox"
                  checked={deductInventory}
                  onChange={() => {}} // Controlled by div click
                  className="h-5 w-5 rounded-lg border-slate-300 text-primary focus:ring-primary accent-primary transition-all group-hover:scale-110"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Revertir Inventario</span>
                <span className="text-[11px] text-slate-500 font-medium mt-1">
                  {(() => {
                    if (!compraToDelete) return '';
                    const count = compraToDelete.items.reduce((acc, it) => acc + it.cantidad, 0);
                    return `Se restarán automáticamente ${count} unidades del almacén.`;
                  })()}
                </span>
              </div>
            </div>

            <div className="flex w-full gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl font-bold border-slate-200" onClick={() => setDeleteModalOpen(false)}>
                No, Volver
              </Button>
              <Button type="button" variant="destructive" className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[11px]" disabled={isDeleting} onClick={executeDelete}>
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

        // Solo mostrar Nota de Entrega si is_fiscal es ESTRICTAMENTE false
        if (printData.is_fiscal === false) {
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
                    <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
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
              </div>
            )}
              {/* PAGE 2: RETENTION (Only if exists) */}
              {hasRetention && (printMode === 'both' || printMode === 'retention') && (
                <div data-print-page="retention" style={{ display: 'flex', flexDirection: 'column' }}>
                  <LegalRetentionVoucher
                    concesionario={concesionario}
                    data={{
                      currency: 'USD', // Forzamos USD para que el componente multiplique por la tasa y muestre Bs
                      exchange_rate: printData.tasa_cambio,
                      iva_retention_number: printData.numero_comprobante || '',
                      invoice_number: printData.numero_factura || '',
                      control_number: printData.numero_control || '',
                      date: printData.fecha_factura || '',
                      provider_name: printData.proveedor_nombre,
                      provider_rif: printData.proveedor_rif || '—',
                      provider_direccion: printData.proveedor_direccion || '—',
                      taxable_amount: montoGravable,
                      exempt_amount: montoExento,
                      iva_amount: printData.iva_monto || 0,
                      total_amount: finalTotalUsd,
                      igtf_amount: igtfUsd,
                      retention_iva_rate: (printData as any).porcentaje_retencion_aplicado || 75
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
