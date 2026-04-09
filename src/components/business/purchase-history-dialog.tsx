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
    if (!loadedCompra.proveedor_direccion && concesionario?.id) {
      try {
        const pSnap = await getDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', compra.proveedor_id));
        if (pSnap.exists() && pSnap.data().direccion) {
          loadedCompra.proveedor_direccion = pSnap.data().direccion;
        }
      } catch (err) {
        console.error('Error fetching provider address:', err);
      }
    }

    setPrintData(loadedCompra as Compra);
    setPrintMode(mode);

    // For printing, use simple display toggle + window.print
    setTimeout(() => {
      const element = document.getElementById('history-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  const handleDownload = async (e: React.MouseEvent, compra: Compra, mode: 'retention' | 'summary') => {
    e.stopPropagation();

    let loadedCompra = { ...compra } as any;
    if (!loadedCompra.proveedor_direccion && concesionario?.id) {
      try {
        const pSnap = await getDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', compra.proveedor_id));
        if (pSnap.exists() && pSnap.data().direccion) {
          loadedCompra.proveedor_direccion = pSnap.data().direccion;
        }
      } catch (err) {
        console.error('Error fetching provider address:', err);
      }
    }

    setPrintData(loadedCompra as Compra);
    setPrintMode(mode);

    if (mode === 'print') {
      setTimeout(() => {
        const element = document.getElementById('history-print-root');
        if (element) {
          element.style.display = 'block';
          window.print();
          element.style.display = 'none';
        }
      }, 150);
      return;
    }

    setTimeout(async () => {
      const element = document.getElementById('history-print-root');
      if (!element) return;

      // Make the element visible but positioned far off-screen so it has
      // full computed styles. Cloning from display:none causes layout issues.
      element.style.display = 'block';
      element.style.position = 'fixed';
      element.style.top = '0px';
      element.style.left = '-99999px';
      element.style.zIndex = '-9999';

      try {
        const printRoot = element.querySelector('.print-root');
        if (!printRoot) return;

        // Determine which page div to capture: first child = summary, second child = retention.
        const pageDivs = Array.from(printRoot.children) as HTMLElement[];
        let targetEl: HTMLElement | null = null;
        if (mode === 'summary') {
          targetEl = pageDivs[0] ?? null;
        } else if (mode === 'retention') {
          targetEl = pageDivs.length > 1 ? pageDivs[1] : pageDivs[0] ?? null;
        }
        if (!targetEl) return;

        // Wait for images inside the target element to load
        const images = targetEl.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));

        // A4 at 96 dpi: 210mm × 297mm → 794px × 1123px
        const A4_W = Math.round(210 * 96 / 25.4); // 794
        const A4_H = Math.round(297 * 96 / 25.4); // 1123

        const SCALE = 2;
        const html2canvasLib = (await import('html2canvas')).default;
        const canvas = await html2canvasLib(targetEl, {
          scale: SCALE,
          useCORS: true,
          allowTaint: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: A4_W,
          height: A4_H,
          windowWidth: A4_W,
          windowHeight: A4_H,
        });

        // Crop canvas at full 2x resolution to preserve sharpness.
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = A4_W * SCALE;
        croppedCanvas.height = A4_H * SCALE;
        const ctx = croppedCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, A4_W * SCALE, A4_H * SCALE);
        }

        const { jsPDF } = await import('jspdf');
        const filename = mode === 'summary'
          ? `Resumen_Compra_${compra.numero_factura || 'N_A'}.pdf`
          : `Retencion_IVA_${(compra as any).numero_comprobante || 'N_A'}.pdf`;

        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const imgData = croppedCanvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        if (pdf.getNumberOfPages && pdf.getNumberOfPages() > 1) {
          while (pdf.getNumberOfPages() > 1) {
            pdf.deletePage(pdf.getNumberOfPages());
          }
        }
        pdf.save(filename);
      } catch (err) {
        console.error('Error generating PDF:', err);
      } finally {
        // Always restore the element to its hidden state
        element.style.display = 'none';
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.zIndex = '9999';
      }
    }, 400);
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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-2xl font-bold flex items-center">
            Historial de Compras (Gestión de Inventario)
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-col gap-3 py-4 border-b">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor o factura..."
                value={searchGeneral}
                onChange={e => setSearchGeneral(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto en items..."
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Registrado por (usuario)..."
                value={searchCreator}
                onChange={e => setSearchCreator(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-1 border-t md:border-t-0 md:pt-0">
            <div className="flex items-center gap-1.5 min-w-[100px]">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Fecha:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full sm:w-[150px] text-sm"
              />
              <span className="text-muted-foreground text-sm">-</span>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full sm:w-[150px] text-sm"
              />
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="h-9 px-2 text-muted-foreground hover:text-foreground"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-y-auto mt-4 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCompras.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay registros de compra activos que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10 hidden md:table-header-group">
                  <tr>
                    <th className="text-left p-3 font-semibold w-10"></th>
                    <th className="text-left p-3 font-semibold">Fecha / Creador</th>
                    <th className="text-left p-3 font-semibold">Proveedor</th>
                    <th className="text-left p-3 font-semibold">Factura</th>
                    <th className="text-left p-3 font-semibold">Condición</th>
                    <th className="text-right p-3 font-semibold">Total ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCompras.map((compra) => {
                    const isExpanded = expandedRow === compra.id;
                    const dateObj = compra.created_at?.toDate ? compra.created_at.toDate() : new Date();

                    return (
                      <React.Fragment key={compra.id}>
                        {/* Main Row */}
                        <tr
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : compra.id)}
                        >
                          <td className="p-3 text-center align-middle">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                          <td className="p-3 align-top md:align-middle">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium whitespace-nowrap">
                                {dateObj.toLocaleDateString('es-VE', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" /> {compra.creado_por || 'Desconocido'}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 font-medium align-top md:align-middle">
                            {compra.proveedor_nombre}
                          </td>
                          <td className="p-3 align-top md:align-middle">
                            {compra.numero_factura ? (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                {compra.numero_factura}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 align-top md:align-middle">
                            <Badge variant={compra.tipo_pago === 'credito' ? 'outline' : 'secondary'} className={
                              compra.tipo_pago === 'credito' ? 'border-amber-500/50 text-amber-700' : ''
                            }>
                              {compra.tipo_pago === 'credito' ? `Crédito (${compra.dias_credito} días)` : 'Contado'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-bold text-primary align-top md:align-middle">
                            ${compra.total_usd.toFixed(2)}
                          </td>
                        </tr>

                        {/* Expanded Area */}
                        {isExpanded && (
                          <tr className="bg-muted/10">
                            <td colSpan={6} className="p-0 border-b">
                              <div className="p-4 md:pl-14 border-l-2 border-l-primary mx-3 my-2 bg-background rounded-md shadow-sm relative">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex flex-wrap gap-2">
                                    {(compra as any).numero_comprobante && (
                                      <div className="flex gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => handlePrint(e, compra, 'retention')}
                                        >
                                          <Printer className="h-4 w-4 mr-2" /> Imprimir Retención
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => handleDownload(e, compra, 'retention')}
                                          title="Descargar archivo PDF directamente"
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                    <div className="flex gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => handlePrint(e, compra, 'summary')}
                                      >
                                        <Printer className="h-4 w-4 mr-2" /> Imprimir Resumen
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => handleDownload(e, compra, 'summary')}
                                        title="Descargar archivo PDF directamente"
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="border-b bg-muted/30">
                                      <tr>
                                        <th className="text-left py-2 px-3">Producto</th>
                                        <th className="text-center py-2 px-3 w-20">Cant.</th>
                                        <th className="text-right py-2 px-3 w-28">Costo Unit. ($)</th>
                                        <th className="text-right py-2 px-3 w-28">Subtotal ($)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                      {compra.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="py-2 px-3 font-medium">{item.nombre}</td>
                                          <td className="py-2 px-3 text-center">{item.cantidad}</td>
                                          <td className="py-2 px-3 text-right">${item.costo_unitario_usd.toFixed(2)}</td>
                                          <td className="py-2 px-3 text-right font-semibold">${item.subtotal_usd.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="mt-4 flex justify-end">
                                  <div className="text-xs text-right bg-muted/40 p-3 rounded-md w-full md:w-64">
                                    <div className="flex justify-between mb-1">
                                      <span className="text-muted-foreground">Subtotal:</span>
                                      <span>${compra.subtotal_usd.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between mb-2">
                                      <span className="text-muted-foreground">IVA (16%):</span>
                                      <span>${compra.iva_monto.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm border-t pt-2">
                                      <span>TOTAL:</span>
                                      <span>${compra.total_usd.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground mt-1 text-[10px] mb-3">
                                      <span>Tasa BCV: {compra.tasa_cambio.toFixed(2)}</span>
                                      <span>Bs {compra.total_bs.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-end pt-3 border-t">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 text-xs px-2 gap-1.5"
                                        disabled={isDeleting}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCompraToDelete(compra);
                                          setDeductInventory(true); // default true
                                          setDeleteModalOpen(true);
                                        }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Anular/Borrar Factura
                                      </Button>
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
          // If it's YYYY-MM-DD
          if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
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
          <div id="history-print-root" style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '210mm', background: 'white', color: 'black', zIndex: 9999 }}>
            <style type="text/css">
              {`
                @media print {
                  body * { visibility: hidden !important; }
                  #history-print-root, #history-print-root * { visibility: visible !important; }
                  #history-print-root { 
                    position: absolute !important; 
                    left: 0 !important; 
                    top: 0 !important; 
                    display: block !important; 
                    width: 210mm !important;
                  }
                }
                @page { size: A4; margin: 0mm; }
                .print-root { width: 100%; background: white !important; }
                .page-break-after { page-break-after: always; break-after: page; }
              `}
            </style>
            <div className="print-root text-black font-sans bg-white w-[210mm]">
              {/* PAGE 1: PURCHASE SUMMARY */}
              {(printMode === 'both' || printMode === 'summary') && (
                <div className={hasRetention && printMode === 'both' ? 'page-break-after' : ''} style={{ padding: '8mm 15mm 5mm 15mm', height: '297mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>{concesionario?.logo_url
                      ? <img src={concesionario.logo_url} alt="Logo" style={{ width: 65, height: 65, objectFit: 'contain' }} />
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
                      <p style={{ margin: '2px 0' }}><strong>N° Factura:</strong> {printData.numero_factura || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>N° Control:</strong> {printData.numero_control || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {printData.proveedor_nombre} {(printData as any).proveedor_rif ? `(${(printData as any).proveedor_rif})` : ''}</p>
                      {(printData as any).fecha_factura && <p style={{ margin: '2px 0' }}><strong>Fecha Factura:</strong> {formatDateVE((printData as any).fecha_factura)}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {registeredAt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                      <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {printData.tasa_cambio ? `Bs ${printData.tasa_cambio.toFixed(2)}` : 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {printData.creado_por || 'Administrador'}</p>
                      {hasRetention && <p style={{ margin: '2px 0' }}><strong>N° Retención IVA:</strong> {(printData as any).numero_comprobante}</p>}
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

              {/* PAGE 2: COMPROBANTE DE RETENCIÓN (conditional) */}
              {hasRetention && (printMode === 'both' || printMode === 'retention') && (
                <div style={{ padding: '8mm 15mm 5mm 15mm', height: '284mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      {concesionario?.logo_url ? (
                        <img
                          src={concesionario.logo_url}
                          alt="Logo"
                          style={{ width: 65, height: 65, objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ width: 65, height: 65, background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 4 }}>ZM</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', color: '#2563eb', letterSpacing: 1, margin: 0 }}>{concesionario?.nombre_empresa}</h1>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>RIF: {concesionario?.rif || 'N/A'}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Comprobante de Retención de I.V.A.</h2>
                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Providencia Administrativa N° SNAT/2025/000054 de fecha 02/07/2025</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f9fafb', border: '1px solid #dbeafe', padding: 14, borderRadius: 6 }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Datos del Agente de Retención (Comprador)</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Razón Social:</strong> {concesionario?.nombre_empresa}</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>R.I.F.:</strong> {concesionario?.rif || 'N/A'}</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Dirección:</strong> {concesionario?.direccion || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Datos del Sujeto Retenido (Proveedor)</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Razón Social:</strong> {printData.proveedor_nombre}</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>R.I.F.:</strong> {(printData as any).proveedor_rif || 'N/A'}</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Dirección:</strong> {(printData as any).proveedor_direccion || '—'}</p>
                    </div>
                  </div>
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '8px 14px', borderRadius: 6, marginBottom: 14, fontSize: 12 }}>
                    <p style={{ margin: '2px 0' }}><strong>Número de Comprobante:</strong> {(printData as any).numero_comprobante}</p>
                    <p style={{ margin: '2px 0' }}><strong>Fecha de Emisión:</strong> {registeredAt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <h3 style={{ fontSize: 12, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', borderBottom: '1.5px solid #dbeafe', paddingBottom: 4, marginBottom: 7 }}>Documentos de Referencia</h3>
                    <p style={{ fontSize: 12, margin: 0 }}>
                      <strong>N° Factura:</strong> {printData.numero_factura || 'N/A'}&emsp;
                      <strong>N° Control:</strong> {printData.numero_control || 'N/A'}&emsp;
                      <strong>Fecha Factura:</strong> {formatDateVE((printData as any).fecha_factura)}
                    </p>
                  </div>
                  <table style={{ width: '58%', marginLeft: 'auto', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {([
                        [!isBs || igtfUsd > 0 ? 'Total Factura (Compras Incluyendo IVA e IGTF):' : 'Total Factura (Compras Incluyendo IVA):', `Bs ${formatBsVal(totalBsNum)}`],
                        ['Base Imponible (Total Compras Gravadas):', `Bs ${formatBsVal(gravableBsNum)}`],
                        ['Monto Exento (Sin Derecho a Crédito Fiscal):', `Bs ${formatBsVal(exentoBsNum)}`],
                        ['Alícuota %:', '16%'],
                        ['Impuesto Causado (I.V.A. Total):', `Bs ${formatBsVal(ivaBsNum)}`],
                        ['Porcentaje de Retención (SENIAT):', `${pctRet}%`],
                        ['I.G.T.F. (3%):', `Bs ${formatBsVal(igtfBsNum)}`],
                      ] as [string, string][]).map(([label, value], i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>{label}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', width: 120 }}>{value}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#dbeafe' }}>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1d4ed8', fontWeight: 'bold' }}>I.V.A. RETENIDO (A ENTERAR AL SENIAT):</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', width: 120 }}>Bs {formatBsVal(ivaRetBsNum)}</td>
                      </tr>
                      <tr style={{ borderTop: '2px solid #d1d5db' }}>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>Neto a Pagar a Proveedor:</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', width: 120 }}>Bs {formatBsVal(netoAPagarBsNum)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', fontStyle: 'italic', padding: '4px 0' }}>
                    Este comprobante se emite en función a lo establecido en la Providencia Administrativa N° SNAT/2025/000054 de fecha 02/07/2025 Publicada en Gaceta Oficial Nro. 43.171 de fecha 16 de Julio de 2025
                  </p>
                  <div style={{ marginTop: 'auto', paddingBottom: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: '2mm' }}>
                      <div style={{ borderTop: '1px solid #374151', paddingTop: 8, textAlign: 'center', fontSize: 11 }}>
                        <p style={{ margin: 0 }}>Firma y Sello Agente de Retención</p>
                        <p style={{ margin: 0, color: '#6b7280' }}>({concesionario?.nombre_empresa})</p>
                      </div>
                      <div style={{ borderTop: '1px solid #374151', paddingTop: 8, textAlign: 'center', fontSize: 11 }}>
                        <p style={{ margin: 0 }}>Recibido por (Proveedor):</p>
                        <p style={{ margin: 0, color: '#6b7280' }}>Nombre/Firma/Cédula/Fecha</p>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </Dialog>
  );
}
