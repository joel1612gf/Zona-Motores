'use client';

import { useState } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, query, where, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Receipt, User, Car, History, DollarSign, X, Check, AlertCircle } from 'lucide-react';
import { SaleFormDialog } from '@/components/business/sale-form-dialog';
import { SaleHistoryDialog } from '@/components/business/sale-history-dialog';

export default function SalesPage() {
  const { concesionario, hasPermission, isStaffLoggedIn } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedPreInvoice, setSelectedPreInvoice] = useState<any>(null);

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
    setSelectedPreInvoice(pi);
    setDialogOpen(true);
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Ventas</h1>
          <p className="text-muted-foreground mt-1">Radar de caja y cobros pendientes</p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4 mr-2" />
              Ver Historial
            </Button>
            <Button onClick={handleCreate} className="bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Venta Rápida
            </Button>
          </div>
        )}
      </div>

      {/* Radar de Cajero */}
      {!isReadOnly && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Prefacturas Pendientes (Radar)</h2>
          </div>
          
          {isPreInvoicesLoading ? (
            <div className="flex justify-center p-8"><p className="text-muted-foreground">Buscando prefacturas...</p></div>
          ) : !preInvoices || preInvoices.length === 0 ? (
            <Card className="bg-muted/10 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Receipt className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
                <p className="text-muted-foreground font-medium">Radar despejado.</p>
                <p className="text-xs text-muted-foreground mt-1">No hay ventas pendientes por cobrar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {preInvoices.map((pi) => (
                <Card key={pi.id} className="overflow-hidden border-primary/20 shadow-md shadow-primary/5 hover:border-primary/40 transition-colors">
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                          {pi.item_tipo === 'vehiculo' ? <Car className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Prefactura</p>
                          <p className="font-semibold text-sm line-clamp-1">{pi.item_nombre}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm bg-muted/40 p-2 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">Vendedor</p>
                        <p className="font-medium truncate flex items-center gap-1"><User className="h-3 w-3"/> {pi.vendedor_nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Monto Acordado</p>
                        <p className="font-bold text-primary">${pi.precio_negociado.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">~Bs {(pi.precio_negociado * exchangeRate).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleCancelPreInvoice(pi)}>
                        <X className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                      <Button className="flex-1 bg-primary" onClick={() => handleProceedPreInvoice(pi)}>
                        <Check className="h-4 w-4 mr-1" /> Proceder
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <SaleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        concesionarioId={concesionario?.id || ''}
        onSave={() => {}}
        preInvoice={selectedPreInvoice}
      />

      {/* History Dialog */}
      <SaleHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
