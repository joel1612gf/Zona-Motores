'use client';

import { useState, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Receipt, User, Car, Calendar, DollarSign, History } from 'lucide-react';
import type { Venta } from '@/lib/business-types';
import { SaleFormDialog } from '@/components/business/sale-form-dialog';
import { SaleHistoryDialog } from '@/components/business/sale-history-dialog';

// Fallback formatters
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatTime = (ts: Timestamp) => {
  return ts.toDate().toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function SalesPage() {
  const { concesionario, hasPermission, isStaffLoggedIn } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const permission = hasPermission('sales');

  const loadVentas = async () => {
    if (!concesionario) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
        orderBy('fecha', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venta));
      setVentas(data);
    } catch (error) {
      console.error('[Sales] Error fetching sales:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las ventas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isStaffLoggedIn && permission) {
      loadVentas();
    }
  }, [concesionario, isStaffLoggedIn, permission]);

  const handleCreate = () => {
    setDialogOpen(true);
  };

  const handleSaveSale = () => {
    loadVentas();
  };

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const isReadOnly = permission === 'read';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Ventas</h1>
          <p className="text-muted-foreground mt-1">Registro de negocios y cierres</p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4 mr-2" />
              Histórico
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Venta
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <p className="text-muted-foreground">Cargando ventas...</p>
        </div>
      ) : ventas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">No hay ventas registradas</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              Haz clic en "Registrar Venta" para cerrar un negocio y guardar el ingreso en el sistema.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Vehículo</th>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium">Vendedor asignado</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium text-right">Monto Final</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ventas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {venta.fecha ? formatTime(venta.fecha) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center font-medium">
                        <Car className="h-4 w-4 mr-2 text-primary/70" />
                        {venta.vehiculo_nombre}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{venta.comprador_nombre}</span>
                        {venta.comprador_cedula && (
                          <span className="text-xs text-muted-foreground">{venta.comprador_cedula}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                        {venta.vendedor_nombre}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {venta.metodo_pago}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400">
                      {formatMoney(venta.precio_venta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <SaleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        concesionarioId={concesionario?.id || ''}
        onSave={handleSaveSale}
      />

      {/* History Dialog */}
      <SaleHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
