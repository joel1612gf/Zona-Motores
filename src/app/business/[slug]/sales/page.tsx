'use client';

import { useState } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, query, where, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Receipt, User, Car, History, DollarSign, X, Check, AlertCircle, Package } from 'lucide-react';
import { SaleFormDialog } from '@/components/business/sale-form-dialog';
import { SaleHistoryTable } from '@/components/business/sale-history-dialog';

export default function SalesPage() {
  const { concesionario, hasPermission, isStaffLoggedIn } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedPreInvoice, setSelectedPreInvoice] = useState<any>(null);
  const [reviewPreInvoice, setReviewPreInvoice] = useState<any>(null);

  const permission = hasPermission('sales');

  const preInvoicesQuery = useMemoFirebase(() => {
    if (!concesionario?.id || !isStaffLoggedIn || !permission) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'pre_invoices'),
      where('estado', '==', 'pendiente'),
      orderBy('created_at', 'asc')
    );
  }, [concesionario?.id, isStaffLoggedIn, permission]);

  const { data: preInvoices, isLoading: isPreInvoicesLoading } = useCollection(preInvoicesQuery);

  const handleCreate = () => {
    setSelectedPreInvoice(null);
    setDialogOpen(true);
  };

  const handleProceedPreInvoice = (pi: any) => {
    if (pi.item_tipo === 'producto') {
      setReviewPreInvoice(pi);
      setReviewModalOpen(true);
    } else {
      setSelectedPreInvoice(pi);
      setDialogOpen(true);
    }
  };

  const handleCancelPreInvoice = async (pi: any) => {
    if (!concesionario?.id) return;
    try {
      // 1. Release vehicle back to stock (assuming most were published)
      if (pi.item_tipo === 'vehiculo' && pi.item_id) {
        await updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'inventario', pi.item_id), {
          estado_stock: 'publico_web'
        });
      }
      // 2. Delete pre_invoice
      await deleteDoc(doc(firestore, 'concesionarios', concesionario.id, 'pre_invoices', pi.id));
      toast({ title: 'Prefactura cancelada y stock restaurado' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const isReadOnly = permission === 'read';
  const exchangeRate = concesionario?.configuracion?.tasa_cambio_manual || 36.2; // Fallback

  return (
    <div className="space-y-8 relative animate-in fade-in duration-500 pb-12">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-1 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Receipt className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Ventas y Caja</h1>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            Radar de cobros pendientes de <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full sm:w-auto">
            <Button onClick={handleCreate} className="h-12 px-6 rounded-2xl bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90 font-bold tracking-tight">
              <Plus className="h-4 w-4 mr-2" />
              Venta Rápida
            </Button>
          </div>
        )}
      </div>

      {!isReadOnly && (
        <Tabs defaultValue="radar" className="space-y-8 relative z-10">
          <TabsList className="bg-background/40 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl h-auto flex flex-wrap max-w-fit shadow-inner">
            <TabsTrigger value="radar" className="rounded-xl px-6 py-2.5 text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all gap-2">
              <AlertCircle className="h-4 w-4" />
              Radar de Cobros
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all gap-2">
              <History className="h-4 w-4" />
              Historial de Ventas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="radar" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-3xl border border-border/50">
              <div className="p-2 bg-background rounded-xl shadow-sm">
                <AlertCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-headline tracking-tight">Prefacturas Pendientes (Radar)</h2>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Enviadas a caja por los vendedores</p>
              </div>
            </div>
            
            {isPreInvoicesLoading ? (
              <div className="flex justify-center p-8"><p className="text-muted-foreground">Buscando prefacturas...</p></div>
            ) : !preInvoices || preInvoices.length === 0 ? (
              <Card className="bg-card/40 backdrop-blur-md border-dashed border-2 border-muted-foreground/20 rounded-[2rem]">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-muted/50 rounded-full mb-4">
                    <Receipt className="h-10 w-10 text-muted-foreground opacity-60" />
                  </div>
                  <p className="text-lg font-bold font-headline text-foreground">Radar despejado</p>
                  <p className="text-sm text-muted-foreground mt-1">No hay ventas pendientes por cobrar en este momento.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {preInvoices.map((pi) => (
                  <Card key={pi.id} className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden hover:ring-primary/40 hover:-translate-y-1 transition-all group flex flex-col rounded-[1.5rem]">
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-3 rounded-2xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {pi.item_tipo === 'vehiculo' ? <Car className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Prefactura</p>
                            <p className="font-bold text-base font-headline leading-tight line-clamp-1 group-hover:text-primary transition-colors">{pi.item_nombre}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm bg-background/50 p-3 rounded-2xl border border-border/50 mb-5">
                        <div className="flex flex-col justify-center">
                          <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Vendedor</p>
                          <p className="font-medium truncate flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground"/> {pi.vendedor_nombre}</p>
                        </div>
                        <div className="text-right border-l pl-3">
                          <p className="text-[10px] uppercase font-black text-primary tracking-widest mb-1">Monto Acordado</p>
                          <p className="font-bold text-lg font-headline text-primary">${(pi.precio_negociado ?? pi.total_usd ?? pi.precio_total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-[10px] font-mono font-medium text-muted-foreground mt-0.5">~Bs {((pi.precio_negociado ?? pi.total_usd ?? pi.precio_total ?? 0) * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-auto">
                        <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-border rounded-xl h-10 font-bold transition-all shadow-sm" onClick={() => handleCancelPreInvoice(pi)}>
                          <X className="h-4 w-4 mr-1.5" /> Cancelar
                        </Button>
                        <Button className="flex-1 bg-primary hover:bg-primary/90 rounded-xl h-10 font-bold shadow-md shadow-primary/20 transition-all" onClick={() => handleProceedPreInvoice(pi)}>
                          <Check className="h-4 w-4 mr-1.5" /> Proceder
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="history" className="focus-visible:outline-none focus-visible:ring-0">
            <SaleHistoryTable />
          </TabsContent>
        </Tabs>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Revisión de Carrito</DialogTitle>
            <DialogDescription>
              Vendedor: {reviewPreInvoice?.vendedor_nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {reviewPreInvoice?.items?.map((it: any, i: number) => (
              <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <p className="font-bold text-sm">{it.nombre}</p>
                  <p className="text-xs text-slate-500">Cód: {it.codigo || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{it.cantidad}x ${(it.precio_final ?? it.precio_usd)?.toFixed(2)}</p>
                  <p className="text-[10px] font-mono text-slate-400">Sub: ${(it.subtotal_usd ?? (it.precio_usd * it.cantidad))?.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReviewModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button 
              className="rounded-xl"
              onClick={() => {
                setReviewModalOpen(false);
                setSelectedPreInvoice(reviewPreInvoice);
                setDialogOpen(true);
              }}
            >
              Continuar al Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <SaleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        concesionarioId={concesionario?.id || ''}
        onSave={() => {}}
        preInvoice={selectedPreInvoice}
      />
    </div>
  );
}
