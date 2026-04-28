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

const INITIAL_VALUES: BankAccountFormValues = {
  tipo: 'banco',
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
};

const ACCOUNT_TYPES = [
  { value: 'banco',    label: 'Banco',    icon: Landmark },
  { value: 'efectivo', label: 'Efectivo', icon: Wallet },
  { value: 'otro',     label: 'Otro',     icon: CreditCard },
] as const;

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
    defaultValues: INITIAL_VALUES,
  });

  const tipoSeleccionado = form.watch('tipo');
  const monedaSeleccionada = form.watch('moneda');

  // Auto-set initial currency and handle Cash naming logic
  useEffect(() => {
    if (!isEditing && open) {
      if (tipoSeleccionado === 'banco') {
        form.setValue('moneda', 'VES');
        form.setValue('es_divisa', false);
      } else if (tipoSeleccionado === 'efectivo') {
        const currentCurrency = monedaSeleccionada || 'USD';
        form.setValue('moneda', currentCurrency);
        form.setValue('nombre', currentCurrency === 'VES' ? 'EFECTIVO EN BS' : 'EFECTIVO EN $');
      } else {
        form.setValue('moneda', monedaSeleccionada || 'USD');
      }
    }
  }, [tipoSeleccionado, monedaSeleccionada, isEditing, open]);

  // Sync es_divisa with moneda
  useEffect(() => {
    form.setValue('es_divisa', monedaSeleccionada === 'USD');
  }, [monedaSeleccionada]);

  // Populate form when editing or clear strictly when creating NEW
  useEffect(() => {
    if (open) {
      if (editAccount) {
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
      } else {
        form.reset(INITIAL_VALUES);
      }
    }
  }, [open, editAccount]);

  // ── SUBMIT ──────────────────────────────────────────────────────────────

  const handleSubmit = async (values: BankAccountFormValues) => {
    if (!concesionario?.id || !staff) return;
    setIsSaving(true);

    try {
      const colRef = collection(firestore, 'concesionarios', concesionario.id, 'cuentas_bancarias');

      // Internal mapping for legacy compatibility (auto-enable relevant methods)
      const autoMethods: Record<string, boolean> = {};
      if (values.tipo === 'banco') {
        autoMethods.transferencia = true;
        autoMethods.pago_movil = true;
      } else if (values.tipo === 'efectivo') {
        autoMethods.efectivo_fisico = true;
      } else {
        // 'otro' accounts use their own name as method, but we enable a generic one internally
        autoMethods.transferencia = true;
      }

      const finalValues = {
        ...values,
        nombre: values.nombre.toUpperCase().trim(),
        banco: values.banco?.trim() || null,
        numero_cuenta: values.numero_cuenta?.trim() || null,
        titular: values.titular?.trim() || null,
        cedula_rif_titular: values.cedula_rif_titular?.trim() || null,
        telefono_pago_movil: values.telefono_pago_movil?.trim() || null,
        notas: values.notas?.trim() || null,
        metodos_entrada: autoMethods,
        metodos_salida: autoMethods,
      };

      if (isEditing && editAccount) {
        await updateDoc(doc(colRef, editAccount.id), {
          ...finalValues,
          updated_at: serverTimestamp(),
        });
        toast({ title: '✓ Cuenta actualizada' });
      } else {
        const snap = await getDocs(query(colRef, orderBy('orden', 'desc')));
        const nextOrden = snap.empty ? 0 : (snap.docs[0].data().orden ?? 0) + 1;

        await runTransaction(firestore, async (tx) => {
          const accountDocRef = doc(colRef);
          const initialBalance = values.saldo_inicial;

          tx.set(accountDocRef, {
            ...finalValues,
            saldo_actual: initialBalance,
            created_at: serverTimestamp(),
            orden: nextOrden,
          });

          if (initialBalance > 0) {
            const txDocRef = doc(collection(firestore, 'concesionarios', concesionario.id, 'cuentas_bancarias', accountDocRef.id, 'transacciones'));
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

      onOpenChange(false);
      // Small delay before notifying parent to allow modal animations to cleanup
      setTimeout(() => {
        onSaved();
      }, 100);
    } catch (err) {
      console.error('[BankAccountForm] Error saving account:', err);
      toast({ variant: 'destructive', title: 'Error al guardar la cuenta.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-2xl rounded-[2.5rem] custom-scrollbar">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-4 text-2xl font-black tracking-tight">
            <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
              <Landmark className="h-6 w-6 text-primary-foreground" />
            </div>
            {isEditing ? 'Editar Cuenta' : 'Nueva Cuenta'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">

          {/* TIPO DE CUENTA */}
          <div className="space-y-4">
            <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground ml-1">
              Tipo de Cuenta
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {ACCOUNT_TYPES.map(({ value, label, icon: Icon }) => {
                const isSelected = tipoSeleccionado === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => form.setValue('tipo', value)}
                    className={cn(
                      'flex flex-col items-center gap-3 p-5 rounded-[1.5rem] border-2 transition-all duration-300 group relative overflow-hidden',
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10'
                        : 'border-slate-100 dark:border-slate-800 bg-card hover:border-primary/50 text-muted-foreground hover:text-primary'
                    )}
                  >
                    <div className={cn(
                      'p-2.5 rounded-xl transition-colors duration-300',
                      isSelected ? 'bg-primary text-white shadow-md' : 'bg-muted group-hover:bg-primary/10'
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-bold tracking-tight">{label}</span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SELECTOR DE MONEDA (Para Efectivo y Otros) */}
          {(tipoSeleccionado === 'efectivo' || tipoSeleccionado === 'otro') && (
            <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold tracking-tight">Divisa de la Cuenta</Label>
                  <p className="text-xs text-muted-foreground font-medium">
                    Seleccione si esta cuenta maneja Dólares ($) o Bolívares (Bs)
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner border border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => form.setValue('moneda', 'VES')}
                    className={cn(
                      'px-4 py-2 rounded-xl text-xs font-black transition-all',
                      monedaSeleccionada === 'VES' 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-700'
                    )}
                  >
                    VES
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setValue('moneda', 'USD')}
                    className={cn(
                      'px-4 py-2 rounded-xl text-xs font-black transition-all',
                      monedaSeleccionada === 'USD' 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-700'
                    )}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DATOS PRINCIPALES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-bold ml-1">Nombre Identificador *</Label>
              <Input
                placeholder="Ej: BANCAMIGA, EFECTIVO CAJA, ZINLI"
                {...form.register('nombre')}
                className="h-12 bg-card border-slate-100 dark:border-white/5 rounded-2xl uppercase font-bold"
              />
              {form.formState.errors.nombre && (
                <p className="text-xs text-red-500">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            {tipoSeleccionado === 'banco' && (
              <div className="space-y-2">
                <Label className="text-sm font-bold ml-1">Nombre del Banco</Label>
                <Input
                  placeholder="Ej: Banesco, Mercantil"
                  {...form.register('banco')}
                  className="h-12 bg-card border-slate-100 dark:border-white/5 rounded-2xl"
                />
              </div>
            )}

            {(tipoSeleccionado === 'banco' || tipoSeleccionado === 'otro') && (
              <div className="space-y-2">
                <Label className="text-sm font-bold ml-1">
                  Número de Cuenta {tipoSeleccionado === 'otro' && '(Opcional)'}
                </Label>
                <Input
                  placeholder="0172-0000-00-0000000000"
                  {...form.register('numero_cuenta')}
                  className="h-12 bg-card border-slate-100 dark:border-white/5 rounded-2xl font-mono"
                />
              </div>
            )}

            {tipoSeleccionado === 'banco' && (
              <div className="space-y-2">
                <Label className="text-sm font-bold ml-1">Teléfono Pago Móvil</Label>
                <Input
                  placeholder="04140000000"
                  {...form.register('telefono_pago_movil')}
                  className="h-12 bg-card border-slate-100 dark:border-white/5 rounded-2xl font-mono"
                />
              </div>
            )}

            {(tipoSeleccionado === 'banco' || tipoSeleccionado === 'otro') && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-bold ml-1">Titular de la Cuenta</Label>
                  <Input
                    placeholder="Nombre completo"
                    {...form.register('titular')}
                    className="h-12 bg-card border-slate-100 dark:border-white/5 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold ml-1">Cédula / RIF Titular</Label>
                  <Input
                    placeholder="V-12345678"
                    {...form.register('cedula_rif_titular')}
                    className="h-12 bg-card border-slate-100 dark:border-white/5 rounded-2xl font-mono"
                  />
                </div>
              </>
            )}

            {/* Saldo inicial (only on create) */}
            {!isEditing && (
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between mb-1 ml-1">
                  <Label className="text-sm font-bold">
                    Saldo Inicial ({monedaSeleccionada})
                  </Label>
                  <Badge variant="outline" className="rounded-lg text-[10px] font-black tracking-tighter uppercase opacity-60">
                    Apertura de Cuenta
                  </Badge>
                </div>
                <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black pointer-events-none">
                     {monedaSeleccionada === 'USD' ? '$' : 'Bs'}
                   </div>
                   <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    {...form.register('saldo_inicial', { valueAsNumber: true })}
                    className="h-14 pl-10 bg-card border-slate-100 dark:border-white/5 rounded-2xl text-xl font-black tracking-tight"
                  />
                </div>
                {form.formState.errors.saldo_inicial && (
                  <p className="text-xs text-red-500">{form.formState.errors.saldo_inicial.message}</p>
                )}
              </div>
            )}
          </div>

          {/* NOTAS */}
          <div className="space-y-2">
            <Label className="text-sm font-bold ml-1">Notas Internas (Opcional)</Label>
            <Textarea
              placeholder="Instrucciones para cajeros o notas contables..."
              {...form.register('notas')}
              rows={2}
              className="bg-card border-slate-100 dark:border-white/5 rounded-2xl resize-none"
            />
          </div>

          <DialogFooter className="pt-6 border-t border-slate-100 dark:border-white/5 gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => onOpenChange(false)} 
              className="rounded-2xl h-12 px-6 font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-2xl h-12 px-8 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 font-black min-w-[160px]"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando...</>
              ) : (
                isEditing ? 'Guardar Cambios' : 'Registrar Cuenta'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

