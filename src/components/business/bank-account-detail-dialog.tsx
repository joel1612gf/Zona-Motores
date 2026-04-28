'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog as AdjustDialog, DialogContent as AdjustDialogContent,
  DialogHeader as AdjustDialogHeader, DialogTitle as AdjustDialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import {
  collection, query, orderBy, limit, getDocs, doc, runTransaction,
  serverTimestamp, addDoc, Timestamp
} from 'firebase/firestore';
import {
  Landmark, TrendingUp, TrendingDown, Loader2, SlidersHorizontal,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, AlertCircle, Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BankAccount, BankTransaction, BankEntryMethod, BankExitMethod } from '@/lib/business-types';
import {
  BANK_ACCOUNT_TYPE_LABELS, BANK_ENTRY_METHOD_LABELS, BANK_EXIT_METHOD_LABELS,
  BANK_TRANSACTION_TYPE_LABELS
} from '@/lib/business-types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { balanceAdjustmentSchema, type BalanceAdjustmentFormValues } from '@/lib/bank-schemas';

// ─── HELPERS ───────────────────────────────────────────────────────────────

function formatBalance(amount: number, moneda: 'USD' | 'VES'): string {
  if (moneda === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' Bs';
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// ─── ENTRY METHODS LIST ────────────────────────────────────────────────────

const ALL_ENTRY: BankEntryMethod[] = [
  'pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_fisico', 'zelle', 'crypto'
];
const ALL_EXIT: BankExitMethod[] = [
  'pago_movil', 'transferencia', 'efectivo_fisico', 'zelle', 'crypto'
];

// ─── PROPS ─────────────────────────────────────────────────────────────────

interface BankAccountDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
  concesionarioId: string;
  onRefresh: () => void;
  onEdit: (account: BankAccount) => void;
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────

export function BankAccountDetailDialog({
  open, onOpenChange, account, concesionarioId, onRefresh, onEdit
}: BankAccountDetailDialogProps) {
  const firestore = useFirestore();
  const { staff } = useBusinessAuth();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);

  const adjustForm = useForm<BalanceAdjustmentFormValues>({
    resolver: zodResolver(balanceAdjustmentSchema),
    defaultValues: { monto_ajuste: 0, concepto: '', referencia: '' },
  });

  // ── LOAD TRANSACTIONS ──────────────────────────────────────────────────

  const loadTransactions = useCallback(async () => {
    if (!account?.id || !concesionarioId) return;
    setIsLoading(true);
    try {
      const txCol = collection(
        firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', account.id, 'transacciones'
      );
      const snap = await getDocs(query(txCol, orderBy('fecha', 'desc'), limit(50)));
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankTransaction)));
    } catch (err) {
      console.error('[BankDetail] Error loading transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [account?.id, concesionarioId, firestore]);

  useEffect(() => {
    if (open && account) {
      loadTransactions();
      adjustForm.reset({ monto_ajuste: 0, concepto: '', referencia: '' });
    }
  }, [open, account]);

  // ── ADJUST BALANCE ──────────────────────────────────────────────────────

  const handleAdjust = async (values: BalanceAdjustmentFormValues) => {
    if (!account || !staff) return;
    setIsSavingAdjust(true);
    try {
      const accountRef = doc(
        firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', account.id
      );
      const txColRef = collection(
        firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', account.id, 'transacciones'
      );

      const ajuste = values.monto_ajuste;
      const nuevoSaldo = account.saldo_actual + ajuste;

      if (nuevoSaldo < 0) {
        toast({
          variant: 'destructive',
          title: 'Saldo resultante negativo',
          description: `El ajuste dejaría la cuenta en ${formatBalance(nuevoSaldo, account.moneda)}. Verifique el monto.`,
        });
        setIsSavingAdjust(false);
        return;
      }

      await runTransaction(firestore, async (tx) => {
        tx.update(accountRef, {
          saldo_actual: nuevoSaldo,
          updated_at: serverTimestamp(),
        });
        const txDoc = doc(txColRef);
        tx.set(txDoc, {
          cuenta_id: account.id,
          tipo: 'ajuste_manual',
          flujo: ajuste >= 0 ? 'entrada' : 'salida',
          monto: Math.abs(ajuste),
          concepto: values.concepto,
          referencia: values.referencia?.trim() || null,
          registrado_por_id: staff.id,
          registrado_por_nombre: staff.nombre,
          saldo_anterior: account.saldo_actual,
          saldo_posterior: nuevoSaldo,
          fecha: serverTimestamp(),
        });
      });

      toast({ title: '✓ Ajuste registrado', description: `Nuevo saldo: ${formatBalance(nuevoSaldo, account.moneda)}` });
      setAdjustOpen(false);
      onRefresh();
      await loadTransactions();
    } catch (err) {
      console.error('[BankDetail] Adjust error:', err);
      toast({ variant: 'destructive', title: 'Error al registrar el ajuste.' });
    } finally {
      setIsSavingAdjust(false);
    }
  };

  if (!account) return null;

  const totalEntradas = transactions.filter(t => t.flujo === 'entrada').reduce((s, t) => s + t.monto, 0);
  const totalSalidas  = transactions.filter(t => t.flujo === 'salida').reduce((s, t) => s + t.monto, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-2xl rounded-[2rem] p-0 gap-0">

          {/* Header */}
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Landmark className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                    {BANK_ACCOUNT_TYPE_LABELS[account.tipo]}
                  </p>
                  <p className="font-black">{account.nombre}</p>
                </div>
              </DialogTitle>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Saldo Actual</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatBalance(account.saldo_actual, account.moneda)}
                </p>
              </div>
            </div>

            {/* Mini stats */}
            <div className="flex items-center gap-4 mt-4 pb-1">
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <ArrowDownCircle className="h-4 w-4" />
                <span className="text-xs font-semibold">{formatBalance(totalEntradas, account.moneda)} entradas</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                <ArrowUpCircle className="h-4 w-4" />
                <span className="text-xs font-semibold">{formatBalance(totalSalidas, account.moneda)} salidas</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-8 w-8 rounded-lg"
                onClick={loadTransactions}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
                onClick={() => onEdit(account)}
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-xs gap-1.5 border-slate-300 dark:border-slate-700"
                onClick={() => setAdjustOpen(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar Saldo
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="transactions" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4">
              <TabsList className="w-full bg-slate-100/80 dark:bg-slate-800/80 rounded-xl">
                <TabsTrigger value="transactions" className="flex-1 rounded-lg text-xs">
                  Transacciones
                </TabsTrigger>
                <TabsTrigger value="config" className="flex-1 rounded-lg text-xs">
                  Métodos Habilitados
                </TabsTrigger>
                <TabsTrigger value="info" className="flex-1 rounded-lg text-xs">
                  Info
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TRANSACTIONS TAB */}
            <TabsContent value="transactions" className="flex-1 overflow-hidden mt-0 px-6 pb-6 pt-4">
              <ScrollArea className="h-[380px] pr-2">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                    <AlertCircle className="h-8 w-8" />
                    <p className="text-sm">Sin transacciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all',
                          tx.flujo === 'entrada'
                            ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-900/30'
                            : 'bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-900/30'
                        )}
                      >
                        <div className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                          tx.flujo === 'entrada' ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'
                        )}>
                          {tx.flujo === 'entrada'
                            ? <ArrowDownCircle className="h-4 w-4 text-green-600" />
                            : <ArrowUpCircle className="h-4 w-4 text-red-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {tx.concepto}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              {BANK_TRANSACTION_TYPE_LABELS[tx.tipo]}
                            </Badge>
                            <span className="text-[10px] text-slate-400">{formatDate(tx.fecha as Timestamp)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn(
                            'text-sm font-bold',
                            tx.flujo === 'entrada' ? 'text-green-600' : 'text-red-500'
                          )}>
                            {tx.flujo === 'entrada' ? '+' : '-'}{formatBalance(tx.monto, account.moneda)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            ≙ {formatBalance(tx.saldo_posterior, account.moneda)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* CONFIG TAB — show enabled status and currency info */}
            <TabsContent value="config" className="flex-1 overflow-auto mt-0 px-6 pb-6 pt-4">
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Estado de la Cuenta</p>
                      <p className="text-xs text-muted-foreground">Define si la cuenta es visible en el sistema</p>
                    </div>
                    <Badge className={cn(
                      'rounded-full px-3 py-1 font-black text-[10px]',
                      account.activa ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
                    )} variant="outline">
                      {account.activa ? 'ACTIVA' : 'INACTIVA'}
                    </Badge>
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Moneda de Operación</p>
                      <p className="text-xs text-muted-foreground">Moneda base para transacciones</p>
                    </div>
                    <Badge variant="outline" className="rounded-xl px-4 py-1 font-black bg-primary/5 border-primary/20 text-primary">
                      {account.moneda}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                    ℹ️ Esta cuenta está configurada como un método de pago automático. Su nombre <strong>"{account.nombre}"</strong> aparecerá directamente en los asistentes de venta y compra.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* INFO TAB */}
            <TabsContent value="info" className="mt-0 px-6 pb-6 pt-4">
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Tipo', value: BANK_ACCOUNT_TYPE_LABELS[account.tipo] },
                  { label: 'Moneda', value: account.moneda },
                  { label: 'Banco', value: account.banco || '—' },
                  { label: 'N° de Cuenta', value: account.numero_cuenta || '—' },
                  { label: 'Titular', value: account.titular || '—' },
                  { label: 'Cédula / RIF', value: account.cedula_rif_titular || '—' },
                  { label: 'Teléfono Pago Móvil', value: account.telefono_pago_movil || '—' },
                  { label: 'Saldo Inicial', value: formatBalance(account.saldo_inicial, account.moneda) },
                  { label: 'Aplica IGTF', value: account.es_divisa ? 'Sí (3%)' : 'No' },
                  { label: 'Estado', value: account.activa ? 'Activa' : 'Inactiva' },
                  ...(account.notas ? [{ label: 'Notas', value: account.notas }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-slate-500 dark:text-slate-400 text-xs">{label}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[60%] break-words">{value}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ADJUSTMENT DIALOG */}
      <AdjustDialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <AdjustDialogContent className="w-[95vw] sm:max-w-md bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl rounded-[2rem] border-white/20 dark:border-white/10">
          <AdjustDialogHeader>
            <AdjustDialogTitle className="flex items-center gap-2 text-lg font-bold">
              <SlidersHorizontal className="h-5 w-5 text-blue-500" />
              Ajuste de Saldo — {account.nombre}
            </AdjustDialogTitle>
          </AdjustDialogHeader>

          <form onSubmit={adjustForm.handleSubmit(handleAdjust)} className="space-y-4 mt-2">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                ⚠️ Use valores positivos para aumentar el saldo y negativos para reducirlo.
                Cada ajuste queda registrado en el historial.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Monto del Ajuste ({account.moneda}) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ej: 50.00 o -20.00"
                {...adjustForm.register('monto_ajuste', { valueAsNumber: true })}
                className="h-11 rounded-xl"
              />
              {adjustForm.formState.errors.monto_ajuste && (
                <p className="text-xs text-red-500">{adjustForm.formState.errors.monto_ajuste.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Concepto / Motivo *</Label>
              <Input
                placeholder="Ej: Comisión bancaria, diferencia de cierre"
                {...adjustForm.register('concepto')}
                className="h-11 rounded-xl"
              />
              {adjustForm.formState.errors.concepto && (
                <p className="text-xs text-red-500">{adjustForm.formState.errors.concepto.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Referencia (opcional)</Label>
              <Input
                placeholder="Número de operación, etc."
                {...adjustForm.register('referencia')}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo actual</span>
                <span className="font-semibold">{formatBalance(account.saldo_actual, account.moneda)}</span>
              </div>
              {adjustForm.watch('monto_ajuste') !== 0 && (
                <div className="flex justify-between mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Saldo resultante</span>
                  <span className={cn(
                    'font-bold',
                    (account.saldo_actual + (adjustForm.watch('monto_ajuste') || 0)) >= 0
                      ? 'text-green-600' : 'text-red-500'
                  )}>
                    {formatBalance(account.saldo_actual + (adjustForm.watch('monto_ajuste') || 0), account.moneda)}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingAdjust} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                {isSavingAdjust
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aplicando...</>
                  : 'Aplicar Ajuste'}
              </Button>
            </DialogFooter>
          </form>
        </AdjustDialogContent>
      </AdjustDialog>
    </>
  );
}
