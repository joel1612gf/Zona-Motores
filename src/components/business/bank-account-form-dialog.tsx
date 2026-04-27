'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import {
  collection, addDoc, updateDoc, doc, serverTimestamp, runTransaction, getDocs, query, orderBy
} from 'firebase/firestore';
import {
  Loader2, Landmark, Wallet, Zap, Bitcoin, CreditCard, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  bankAccountSchema, type BankAccountFormValues
} from '@/lib/bank-schemas';
import {
  BANK_ACCOUNT_TYPE_LABELS, BANK_ACCOUNT_CURRENCY,
  BANK_ENTRY_METHOD_LABELS, BANK_EXIT_METHOD_LABELS,
  type BankAccount, type BankEntryMethod, type BankExitMethod,
} from '@/lib/business-types';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'banco_nacional', label: 'Banco Nacional (VES)', icon: Landmark },
  { value: 'efectivo_bs',   label: 'Efectivo Bolívares',   icon: Wallet },
  { value: 'efectivo_usd',  label: 'Efectivo Dólares',     icon: Wallet },
  { value: 'zelle',         label: 'Zelle (USD)',           icon: Zap },
  { value: 'crypto',        label: 'Criptomoneda (USD)',    icon: Bitcoin },
  { value: 'otro',          label: 'Otro',                  icon: CreditCard },
] as const;

const ENTRY_METHODS: BankEntryMethod[] = [
  'pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_fisico', 'zelle', 'crypto'
];
const EXIT_METHODS: BankExitMethod[] = [
  'pago_movil', 'transferencia', 'efectivo_fisico', 'zelle', 'crypto'
];

/** Entry methods available per account type */
const ALLOWED_ENTRY: Record<string, BankEntryMethod[]> = {
  banco_nacional: ['pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_fisico'],
  efectivo_bs:    ['efectivo_fisico'],
  efectivo_usd:  ['efectivo_fisico'],
  zelle:          ['zelle'],
  crypto:         ['crypto'],
  otro:           ENTRY_METHODS,
};

const ALLOWED_EXIT: Record<string, BankExitMethod[]> = {
  banco_nacional: ['pago_movil', 'transferencia', 'efectivo_fisico'],
  efectivo_bs:    ['efectivo_fisico'],
  efectivo_usd:  ['efectivo_fisico'],
  zelle:          ['zelle'],
  crypto:         ['crypto'],
  otro:           EXIT_METHODS,
};

// ─── PROPS ─────────────────────────────────────────────────────────────────

interface BankAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAccount?: BankAccount | null;
  onSaved: () => void;
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────

export function BankAccountFormDialog({
  open, onOpenChange, editAccount, onSaved
}: BankAccountFormDialogProps) {
  const firestore = useFirestore();
  const { concesionario, staff } = useBusinessAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!editAccount;

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      tipo: 'banco_nacional',
      nombre: '',
      banco: '',
      numero_cuenta: '',
      titular: '',
      cedula_rif_titular: '',
      telefono_pago_movil: '',
      moneda: 'VES',
      saldo_inicial: 0,
      saldo_actual: 0,
      metodos_entrada: {},
      metodos_salida: {},
      es_divisa: false,
      activa: true,
      orden: 0,
      notas: '',
    },
  });

  const tipoSeleccionado = form.watch('tipo');
  const monedaAuto = BANK_ACCOUNT_CURRENCY[tipoSeleccionado] ?? 'VES';

  // Auto-set moneda and es_divisa when tipo changes
  useEffect(() => {
    form.setValue('moneda', monedaAuto);
    form.setValue('es_divisa', monedaAuto === 'USD');
    // Reset methods when tipo changes
    form.setValue('metodos_entrada', {});
    form.setValue('metodos_salida', {});
  }, [tipoSeleccionado]);

  // Populate form when editing
  useEffect(() => {
    if (open && editAccount) {
      form.reset({
        tipo: editAccount.tipo,
        nombre: editAccount.nombre,
        banco: editAccount.banco ?? '',
        numero_cuenta: editAccount.numero_cuenta ?? '',
        titular: editAccount.titular ?? '',
        cedula_rif_titular: editAccount.cedula_rif_titular ?? '',
        telefono_pago_movil: editAccount.telefono_pago_movil ?? '',
        moneda: editAccount.moneda,
        saldo_inicial: editAccount.saldo_inicial,
        saldo_actual: editAccount.saldo_actual,
        metodos_entrada: editAccount.metodos_entrada as Record<BankEntryMethod, boolean>,
        metodos_salida: editAccount.metodos_salida as Record<BankExitMethod, boolean>,
        es_divisa: editAccount.es_divisa,
        activa: editAccount.activa,
        orden: editAccount.orden,
        notas: editAccount.notas ?? '',
      });
    } else if (open && !editAccount) {
      form.reset();
    }
  }, [open, editAccount]);

  const allowedEntry = ALLOWED_ENTRY[tipoSeleccionado] ?? ENTRY_METHODS;
  const allowedExit  = ALLOWED_EXIT[tipoSeleccionado]  ?? EXIT_METHODS;

  // ── SUBMIT ──────────────────────────────────────────────────────────────

  const handleSubmit = async (values: BankAccountFormValues) => {
    if (!concesionario?.id || !staff) return;
    setIsSaving(true);

    try {
      const colRef = collection(firestore, 'concesionarios', concesionario.id, 'cuentas_bancarias');

      if (isEditing && editAccount) {
        // Update existing account (do NOT change saldo_actual here — only via transactions)
        await updateDoc(doc(colRef, editAccount.id), {
          tipo: values.tipo,
          nombre: values.nombre.toUpperCase().trim(),
          banco: values.banco?.trim() || null,
          numero_cuenta: values.numero_cuenta?.trim() || null,
          titular: values.titular?.trim() || null,
          cedula_rif_titular: values.cedula_rif_titular?.trim() || null,
          telefono_pago_movil: values.telefono_pago_movil?.trim() || null,
          moneda: values.moneda,
          metodos_entrada: values.metodos_entrada,
          metodos_salida: values.metodos_salida,
          es_divisa: values.es_divisa,
          activa: values.activa,
          orden: values.orden,
          notas: values.notas?.trim() || null,
          updated_at: serverTimestamp(),
        });
        toast({ title: '✓ Cuenta actualizada' });
      } else {
        // Determine insertion order (append last)
        const snap = await getDocs(query(colRef, orderBy('orden', 'desc')));
        const nextOrden = snap.empty ? 0 : (snap.docs[0].data().orden ?? 0) + 1;

        // Create account + initial transaction in a single Firestore transaction
        await runTransaction(firestore, async (tx) => {
          // Create the account document
          const accountDocRef = doc(colRef);
          const initialBalance = values.saldo_inicial;

          tx.set(accountDocRef, {
            tipo: values.tipo,
            nombre: values.nombre.toUpperCase().trim(),
            banco: values.banco?.trim() || null,
            numero_cuenta: values.numero_cuenta?.trim() || null,
            titular: values.titular?.trim() || null,
            cedula_rif_titular: values.cedula_rif_titular?.trim() || null,
            telefono_pago_movil: values.telefono_pago_movil?.trim() || null,
            moneda: values.moneda,
            saldo_inicial: initialBalance,
            saldo_actual: initialBalance,
            metodos_entrada: values.metodos_entrada,
            metodos_salida: values.metodos_salida,
            es_divisa: values.es_divisa,
            activa: values.activa,
            orden: nextOrden,
            notas: values.notas?.trim() || null,
            created_at: serverTimestamp(),
          });

          // Create initial balance transaction if > 0
          if (initialBalance > 0) {
            const txDocRef = doc(
              collection(firestore, 'concesionarios', concesionario.id, 'cuentas_bancarias', accountDocRef.id, 'transacciones')
            );
            tx.set(txDocRef, {
              cuenta_id: accountDocRef.id,
              tipo: 'ajuste_manual',
              flujo: 'entrada',
              monto: initialBalance,
              concepto: 'Saldo inicial de apertura',
              registrado_por_id: staff.id,
              registrado_por_nombre: staff.nombre,
              saldo_anterior: 0,
              saldo_posterior: initialBalance,
              fecha: serverTimestamp(),
            });
          }
        });

        toast({ title: '✓ Cuenta creada', description: `${values.nombre.toUpperCase()} ha sido registrada.` });
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error('[BankAccountForm] Error saving account:', err);
      toast({ variant: 'destructive', title: 'Error al guardar la cuenta.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────

  const metodos_entrada = form.watch('metodos_entrada') as Record<string, boolean>;
  const metodos_salida  = form.watch('metodos_salida')  as Record<string, boolean>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-2xl rounded-[2rem] custom-scrollbar">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Landmark className="h-5 w-5 text-blue-500" />
            </div>
            {isEditing ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

          {/* TIPO DE CUENTA */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tipo de Cuenta *
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map(({ value, label, icon: Icon }) => {
                const isSelected = tipoSeleccionado === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => form.setValue('tipo', value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all duration-200',
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 text-slate-500 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/30'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isSelected && 'text-blue-500')} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MONEDA BADGE */}
          <div className="flex items-center gap-2">
            <Badge variant={monedaAuto === 'USD' ? 'default' : 'secondary'} className="text-xs">
              {monedaAuto === 'USD' ? '🇺🇸 Moneda: USD' : '🇻🇪 Moneda: VES (Bolívares)'}
            </Badge>
            {monedaAuto === 'USD' && (
              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                ⚠️ Aplica IGTF 3%
              </Badge>
            )}
          </div>

          {/* DATOS PRINCIPALES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nombre de la Cuenta *</Label>
              <Input
                placeholder="Ej: BANCAMIGA, EFECTIVO Bs"
                {...form.register('nombre')}
                className="h-11 bg-white/50 dark:bg-slate-900/50 rounded-xl uppercase"
              />
              {form.formState.errors.nombre && (
                <p className="text-xs text-red-500">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            {tipoSeleccionado === 'banco_nacional' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Nombre del Banco</Label>
                <Input
                  placeholder="Ej: Bancamiga, Banesco"
                  {...form.register('banco')}
                  className="h-11 bg-white/50 dark:bg-slate-900/50 rounded-xl"
                />
              </div>
            )}

            {tipoSeleccionado === 'banco_nacional' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Número de Cuenta</Label>
                <Input
                  placeholder="0172-0000-00-0000000000"
                  {...form.register('numero_cuenta')}
                  className="h-11 bg-white/50 dark:bg-slate-900/50 rounded-xl font-mono"
                />
              </div>
            )}

            {tipoSeleccionado === 'banco_nacional' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Teléfono Pago Móvil</Label>
                <Input
                  placeholder="04140000000"
                  {...form.register('telefono_pago_movil')}
                  className="h-11 bg-white/50 dark:bg-slate-900/50 rounded-xl font-mono"
                />
              </div>
            )}

            {(tipoSeleccionado === 'banco_nacional' || tipoSeleccionado === 'otro') && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Titular de la Cuenta</Label>
                  <Input
                    placeholder="Nombre completo"
                    {...form.register('titular')}
                    className="h-11 bg-white/50 dark:bg-slate-900/50 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Cédula / RIF Titular</Label>
                  <Input
                    placeholder="V-12345678"
                    {...form.register('cedula_rif_titular')}
                    className="h-11 bg-white/50 dark:bg-slate-900/50 rounded-xl"
                  />
                </div>
              </>
            )}

            {/* Saldo inicial (only on create) */}
            {!isEditing && (
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-semibold">
                  Saldo Inicial ({monedaAuto})
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  {...form.register('saldo_inicial', { valueAsNumber: true })}
                  className="h-11 bg-white/50 dark:bg-slate-900/50 rounded-xl"
                />
                {form.formState.errors.saldo_inicial && (
                  <p className="text-xs text-red-500">{form.formState.errors.saldo_inicial.message}</p>
                )}
              </div>
            )}
          </div>

          {/* MÉTODOS HABILITADOS */}
          <div className="space-y-4">
            <Separator />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Métodos de Pago Habilitados
            </p>

            {/* Entrada */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-600 dark:text-green-400">
                ↓ Entrada (Cobros)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allowedEntry.map((method) => (
                  <div
                    key={method}
                    className={cn(
                      'flex items-center justify-between gap-2 p-3 rounded-xl border transition-all duration-200',
                      metodos_entrada[method]
                        ? 'border-green-400/50 bg-green-50/50 dark:bg-green-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30'
                    )}
                  >
                    <Label className="text-xs font-medium cursor-pointer">
                      {BANK_ENTRY_METHOD_LABELS[method]}
                    </Label>
                    <Switch
                      checked={!!metodos_entrada[method]}
                      onCheckedChange={(checked) => {
                        form.setValue('metodos_entrada', {
                          ...metodos_entrada,
                          [method]: checked,
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Salida */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-500 dark:text-red-400">
                ↑ Salida (Pagos)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allowedExit.map((method) => (
                  <div
                    key={method}
                    className={cn(
                      'flex items-center justify-between gap-2 p-3 rounded-xl border transition-all duration-200',
                      metodos_salida[method]
                        ? 'border-red-400/50 bg-red-50/50 dark:bg-red-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30'
                    )}
                  >
                    <Label className="text-xs font-medium cursor-pointer">
                      {BANK_EXIT_METHOD_LABELS[method]}
                    </Label>
                    <Switch
                      checked={!!metodos_salida[method]}
                      onCheckedChange={(checked) => {
                        form.setValue('metodos_salida', {
                          ...metodos_salida,
                          [method]: checked,
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* NOTAS */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notas Internas (opcional)</Label>
            <Textarea
              placeholder="Uso interno, instrucciones especiales..."
              {...form.register('notas')}
              rows={2}
              className="bg-white/50 dark:bg-slate-900/50 rounded-xl resize-none"
            />
          </div>

          {/* CUENTA ACTIVA */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30">
            <div>
              <p className="text-sm font-semibold">Cuenta Activa</p>
              <p className="text-xs text-slate-500">Las cuentas inactivas no aparecen en los wizards de pago.</p>
            </div>
            <Switch
              checked={form.watch('activa')}
              onCheckedChange={(v) => form.setValue('activa', v)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
              ) : (
                isEditing ? 'Guardar Cambios' : 'Crear Cuenta'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
