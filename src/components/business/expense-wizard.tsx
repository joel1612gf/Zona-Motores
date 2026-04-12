'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from '@/components/ui/form';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, query, where, orderBy, doc, runTransaction, serverTimestamp, increment 
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  expenseSchema, type ExpenseFormValues, ISLR_CONCEPTS 
} from '@/lib/finance-schemas';
import { formatCurrency } from '@/lib/utils';
import { 
  Loader2, Calculator, ArrowRight, ArrowLeft, CheckCircle2, ShieldAlert, FileText 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Proveedor } from '@/lib/business-types';

interface ExpenseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpenseWizard({ open, onOpenChange }: ExpenseWizardProps) {
  const { slug, concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Queries
  const providersQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'proveedores'),
      orderBy('nombre', 'asc')
    );
  }, [concesionario, firestore]);

  const { data: providers } = useCollection<Proveedor>(providersQuery);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      currency: 'USD',
      base_amount: 0,
      exempt_amount: 0,
      iva_amount: 0,
      retention_iva_rate: '75',
      description: '',
    },
  });

  const selectedProviderId = form.watch('provider_id');
  const selectedProvider = useMemo(() => 
    providers?.find(p => p.id === selectedProviderId), 
  [providers, selectedProviderId]);

  // Totals calculations
  const base = form.watch('base_amount') || 0;
  const exempt = form.watch('exempt_amount') || 0;
  const iva = form.watch('iva_amount') || 0;
  const islrPercentage = form.watch('islr_percentage') || 0;
  const retentionIvaRate = parseInt(form.watch('retention_iva_rate') || '0');

  const totalBeforeRetentions = base + exempt + iva;
  const retentionIvaAmount = (iva * retentionIvaRate) / 100;
  const retentionIslrAmount = (base + exempt) * islrPercentage;
  const netToPay = totalBeforeRetentions - retentionIvaAmount - retentionIslrAmount;

  const handleNext = async () => {
    const fieldsToValidate = step === 1 
      ? ['provider_id', 'invoice_number', 'control_number', 'date', 'base_amount', 'description'] 
      : [];
    
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      if (step === 1) setStep(2);
      else form.handleSubmit(handleSubmit)();
    }
  };

  const handleSubmit = async (values: ExpenseFormValues) => {
    if (!concesionario) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await runTransaction(firestore, async (transaction) => {
        const settingsRef = doc(firestore, 'concesionarios', concesionario.id, 'configuracion', 'business_settings');
        const settingsSnap = await transaction.get(settingsRef);
        
        let ivaSeq = 1;
        let islrSeq = 1;

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.last_iva_retention_period === yearMonth) {
            ivaSeq = (data.last_iva_retention_seq || 0) + 1;
          }
          if (data.last_islr_retention_period === yearMonth) {
            islrSeq = (data.last_islr_retention_seq || 0) + 1;
          }
        }

        const ivaRetentionNumber = `${yearMonth}${String(ivaSeq).padStart(4, '0')}`;
        const islrRetentionNumber = `ISLR-${yearMonth}-${String(islrSeq).padStart(4, '0')}`;

        // Create Expense Document
        const expenseRef = doc(collection(firestore, 'concesionarios', concesionario.id, 'gastos'));
        const payload = {
          ...values,
          provider_name: selectedProvider?.nombre || 'Proveedor Desconocido',
          provider_rif: selectedProvider?.rif || '',
          iva_retention_number: iva > 0 ? ivaRetentionNumber : null,
          iva_retention_amount: retentionIvaAmount,
          islr_retention_number: islrPercentage > 0 ? islrRetentionNumber : null,
          islr_retention_amount: retentionIslrAmount,
          total_amount: totalBeforeRetentions,
          net_to_pay: netToPay,
          status: 'COMPLETADO',
          created_at: serverTimestamp(),
          created_by: concesionario.owner_uid,
        };

        transaction.set(expenseRef, payload);

        // Update counters in settings
        transaction.set(settingsRef, {
          last_iva_retention_period: yearMonth,
          last_iva_retention_seq: iva > 0 ? ivaSeq : (settingsSnap.data()?.last_iva_retention_seq || 0),
          last_islr_retention_period: yearMonth,
          last_islr_retention_seq: islrPercentage > 0 ? islrSeq : (settingsSnap.data()?.last_islr_retention_seq || 0),
        }, { merge: true });

        // Add to Cash Flow
        const cashRef = doc(collection(firestore, 'concesionarios', concesionario.id, 'caja'));
        transaction.set(cashRef, {
          tipo: 'egreso',
          monto: netToPay,
          descripcion: `PAGO GASTO: ${values.invoice_number} - ${selectedProvider?.nombre}`,
          metodo_pago: values.currency === 'USD' ? 'Efectivo USD' : 'Transferencia VES',
          fecha: serverTimestamp(),
          referencia_pago: values.invoice_number,
        });
      });

      toast({ title: 'Gasto registrado con éxito', description: 'Se generaron los comprobantes de retención.' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({ variant: 'destructive', title: 'Error al guardar', description: 'No se pudo registrar el gasto.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-card/95 backdrop-blur-xl ring-1 ring-border">
        <DialogHeader className="p-8 bg-muted/30 border-b relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
              <Calculator className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold font-headline">Asistente de Gastos</DialogTitle>
              <p className="text-sm text-muted-foreground font-medium">Paso {step} de 2: {step === 1 ? 'Identificación y Montos' : 'Fiscalidad y Retenciones'}</p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {step === 1 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="md:col-span-2 space-y-4">
                  <FormField
                    control={form.control}
                    name="provider_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Proveedor</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-background/50 border-muted-foreground/20">
                              <SelectValue placeholder="Seleccione un proveedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl shadow-2xl">
                            {providers?.map(p => (
                              <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase text-xs">
                                {p.nombre} ({p.rif})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="invoice_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Número de Factura</FormLabel>
                      <FormControl><Input placeholder="000123" {...field} className="h-12 rounded-xl" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="control_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Número de Control</FormLabel>
                      <FormControl><Input placeholder="00-00123" {...field} className="h-12 rounded-xl" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fecha de Factura</FormLabel>
                      <FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Moneda de Pago</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Moneda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                          <SelectItem value="VES">Bolívares (VES)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-primary/[0.03] rounded-[2rem] border border-primary/10">
                  <FormField
                    control={form.control}
                    name="base_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-primary tracking-tighter">Base Imponible</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11 rounded-xl bg-background border-primary/20 font-bold" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="exempt_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-primary tracking-tighter">Monto Exento</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11 rounded-xl bg-background border-primary/20 font-bold" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="iva_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-primary tracking-tighter">IVA (Calculado)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="number" 
                              step="0.01" 
                              {...field} 
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              className="h-11 rounded-xl bg-background border-primary/20 font-bold pr-12" 
                            />
                            <button 
                              type="button"
                              onClick={() => form.setValue('iva_amount', Math.round(base * 0.16 * 100) / 100)}
                              className="absolute right-2 top-2 p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                            >
                              <Calculator className="h-4 w-4" />
                            </button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Descripción del Gasto</FormLabel>
                        <FormControl><Textarea placeholder="Ej: Pago de mantenimiento de aires acondicionados oficina principal..." {...field} className="rounded-2xl min-h-[100px]" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="flex items-start gap-4 p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem]">
                  <ShieldAlert className="h-8 w-8 text-amber-500 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-700">Validación Fiscal Venezuela 2026</p>
                    <p className="text-xs text-amber-600 font-medium">Configure las retenciones de ley para este proveedor según el concepto del servicio.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="retention_iva_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Retención de IVA</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl">
                              <SelectValue placeholder="Porcentaje" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="0">0% (Sin Retención)</SelectItem>
                            <SelectItem value="75">75% (Ordinario)</SelectItem>
                            <SelectItem value="100">100% (Especial / Sin RIF)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="islr_concept"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Concepto Retención ISLR</FormLabel>
                        <Select 
                          onValueChange={(val) => {
                            field.onChange(val);
                            const concept = ISLR_CONCEPTS.find(c => c.code === val);
                            form.setValue('islr_percentage', concept?.value || 0);
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl">
                              <SelectValue placeholder="Seleccione Concepto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="NONE" className="font-bold py-3 uppercase text-xs">No aplica retención</SelectItem>
                            {ISLR_CONCEPTS.map(c => (
                              <SelectItem key={c.code} value={c.code} className="font-bold py-3 uppercase text-xs">
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="p-8 bg-primary rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <FileText className="h-32 w-32 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-y-6 relative z-10">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-primary-foreground/60 uppercase tracking-widest">Monto Facturado</p>
                      <p className="text-2xl font-bold font-headline text-white">{formatCurrency(totalBeforeRetentions, 'USD')}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-black text-primary-foreground/60 uppercase tracking-widest">Retención IVA ({retentionIvaRate}%)</p>
                      <p className="text-xl font-bold font-headline text-white/80">{formatCurrency(retentionIvaAmount, 'USD')}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-primary-foreground/60 uppercase tracking-widest">Retención ISLR ({(islrPercentage * 100).toFixed(0)}%)</p>
                      <p className="text-xl font-bold font-headline text-white/80">{formatCurrency(retentionIslrAmount, 'USD')}</p>
                    </div>
                    <div className="pt-6 border-t border-white/10 col-span-2 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black text-primary-foreground/80 uppercase tracking-widest mb-1">Total Neto a Pagar</p>
                        <p className="text-4xl font-bold font-headline text-white">{formatCurrency(netToPay, 'USD')}</p>
                      </div>
                      <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
                        <p className="text-[9px] font-bold text-white/70 uppercase">Contravalor Bs.</p>
                        <p className="text-sm font-bold text-white tracking-tight">Cálculo Automático</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t flex flex-row justify-between items-center">
            {step === 2 && (
              <Button 
                variant="ghost" 
                type="button"
                onClick={() => setStep(1)} 
                disabled={isSaving}
                className="rounded-xl h-12 px-6 gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Anterior
              </Button>
            )}
            <div className="flex gap-3 ml-auto">
              <Button 
                variant="ghost" 
                type="button"
                onClick={() => onOpenChange(false)} 
                disabled={isSaving}
                className="rounded-xl h-12 px-6"
              >
                Cancelar
              </Button>
              <Button 
                type="button"
                onClick={handleNext} 
                disabled={isSaving}
                className={cn(
                  "rounded-xl h-12 px-8 shadow-xl transition-all gap-2 font-bold",
                  step === 2 ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-primary shadow-primary/20"
                )}
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    {step === 1 ? 'Siguiente' : 'Confirmar Registro'}
                    {step === 1 ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
