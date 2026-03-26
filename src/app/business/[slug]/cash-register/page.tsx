'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, Landmark, Banknote, ClipboardCheck } from 'lucide-react';
import type { RegistroCaja } from '@/lib/business-types';
import { TransactionFormDialog } from '@/components/business/transaction-form-dialog';
import { CashClosureDialog } from '@/components/business/cash-closure-dialog';
import { CashHistoryDialog } from '@/components/business/cash-history-dialog';
import { cn } from '@/lib/utils';

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatTime = (ts: Timestamp) => {
  return ts.toDate().toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function CashRegisterPage() {
  const { concesionario, hasPermission, isStaffLoggedIn, currentRole } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [transacciones, setTransacciones] = useState<RegistroCaja[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const permission = hasPermission('cash_register');

  const loadCaja = async () => {
    if (!concesionario) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(firestore, 'concesionarios', concesionario.id, 'caja'),
        orderBy('fecha', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RegistroCaja));
      setTransacciones(data);
    } catch (error) {
      console.error('[CashRegister] Error fetching transactions:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los movimientos.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isStaffLoggedIn && permission) {
      loadCaja();
    }
  }, [concesionario, isStaffLoggedIn, permission]);

  // Calculations
  const stats = useMemo(() => {
    let balanceTotal = 0;
    let balanceEfectivo = 0;
    let balanceZelle = 0;
    let balanceOtros = 0;

    transacciones.forEach(t => {
      const isIngreso = t.tipo === 'ingreso';
      const multiplicador = isIngreso ? 1 : -1;
      const montoNeto = t.monto * multiplicador;

      balanceTotal += montoNeto;

      if (t.metodo_pago.toLowerCase().includes('efectivo')) {
        balanceEfectivo += montoNeto;
      } else if (t.metodo_pago.toLowerCase().includes('zelle')) {
        balanceZelle += montoNeto;
      } else {
        balanceOtros += montoNeto;
      }
    });

    return { balanceTotal, balanceEfectivo, balanceZelle, balanceOtros };
  }, [transacciones]);

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const isReadOnly = permission === 'read';
  const canSeeTotals = currentRole === 'dueno' || currentRole === 'encargado';
  const canSeeHistory = currentRole === 'dueno' || currentRole === 'encargado' || currentRole === 'secretario';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Caja Chica y Pagos</h1>
          <p className="text-muted-foreground mt-1">Control de ingresos y egresos diarios</p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2 text-primary">
            {canSeeHistory && (
              <Button variant="outline" onClick={() => setHistoryDialogOpen(true)}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Histórico
              </Button>
            )}
            <Button variant="secondary" onClick={() => setClosureDialogOpen(true)}>
              <Wallet className="h-4 w-4 mr-2" />
              Cierre de Caja
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Movimiento
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards (Only for Admins) */}
      {canSeeTotals ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Balance Total</p>
                  <h3 className={cn("text-2xl font-bold font-headline", stats.balanceTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                    {formatMoney(stats.balanceTotal)}
                  </h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">En Efectivo</p>
                  <h3 className="text-xl font-bold font-headline">{formatMoney(stats.balanceEfectivo)}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">En Zelle</p>
                  <h3 className="text-xl font-bold font-headline">{formatMoney(stats.balanceZelle)}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border">
                  <span className="font-bold text-lg text-muted-foreground">Z</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Bancos / Otros</p>
                  <h3 className="text-xl font-bold font-headline">{formatMoney(stats.balanceOtros)}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="bg-primary/[0.03] border border-dashed border-primary/20 rounded-xl p-6 flex items-center gap-4 animate-in fade-in duration-500">
           <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="h-6 w-6 text-primary/60" />
           </div>
           <div>
              <h3 className="font-semibold text-lg">Caja Activa</h3>
              <p className="text-muted-foreground text-sm">Registra los movimientos del día. El balance acumulado solo es visible para gerencia.</p>
           </div>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Movimientos</CardTitle>
        </CardHeader>
        <CardContent className={transacciones.length === 0 ? "pb-8" : "p-0"}>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : transacciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold">No hay movimientos registrados</h3>
              <p className="text-muted-foreground mt-2">Los ingresos de ventas y egresos aparecerán aquí.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-y">
                  <tr>
                    <th className="px-6 py-3 font-medium">Fecha</th>
                    <th className="px-6 py-3 font-medium">Concepto</th>
                    <th className="px-6 py-3 font-medium">Método</th>
                    <th className="px-6 py-3 font-medium">Responsable</th>
                    <th className="px-6 py-3 font-medium text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transacciones.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {tx.fecha ? formatTime(tx.fecha) : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium block">{tx.descripcion}</span>
                        {tx.referencia_pago && (
                          <span className="text-xs text-muted-foreground">Ref: {tx.referencia_pago}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted">
                          {tx.metodo_pago}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {tx.cajero_nombre}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className={cn(
                          "flex items-center justify-end font-bold",
                          tx.tipo === 'ingreso' ? "text-green-600 dark:text-green-400" : "text-destructive"
                        )}>
                          {tx.tipo === 'ingreso' ? (
                            <ArrowUpCircle className="h-4 w-4 mr-1" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 mr-1" />
                          )}
                          {formatMoney(tx.monto)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        concesionarioId={concesionario?.id || ''}
        onSave={() => loadCaja()}
      />

      <CashClosureDialog
        open={closureDialogOpen}
        onOpenChange={setClosureDialogOpen}
        concesionarioId={concesionario?.id || ''}
        onSave={() => loadCaja()}
      />

      <CashHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        concesionarioId={concesionario?.id || ''}
      />
    </div>
  );
}
