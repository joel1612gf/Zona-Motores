'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Loader2, Calculator, ArrowRight, ArrowLeft, CheckCircle2, ShieldAlert, FileText, Printer, Download 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Proveedor } from '@/lib/business-types';
import { useCurrency } from '@/context/currency-context';
import { ExpensePrint } from './expense-print';

interface ExpenseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpenseWizard({ open, onOpenChange }: ExpenseWizardProps) {
  const { slug, concesionario, staff } = useBusinessAuth();
  const { bcvRate } = useCurrency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateInvoice, setDuplicateInvoice] = useState<any>(null);
  const [successData, setSuccessData] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'summary' | 'iva' | 'islr'>('summary');

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
      currency: 'VES',
      base_amount: 0,
      exempt_amount: 0,
      iva_amount: 0,
      retention_iva_rate: '75',
      islr_concept: 'NONE',
      islr_percentage: 0,
      description: '',
    },
  });

  const selectedProviderId = form.watch('provider_id');
  const selectedCurrency = form.watch('currency');
  const invoiceNumber = form.watch('invoice_number');
  const controlNumber = form.watch('control_number');
  const base = form.watch('base_amount') || 0;
  const exempt = form.watch('exempt_amount') || 0;
  
  // 1. Auto-fill IVA
  useEffect(() => {
    const calculatedIva = Math.round(base * 0.16 * 100) / 100;
    form.setValue('iva_amount', calculatedIva, { shouldValidate: true });
  }, [base, form]);

  // 2. Auto-fill Retention Rate from Provider
  useEffect(() => {
    if (selectedProviderId && providers) {
      const p = providers.find(p => p.id === selectedProviderId);
      if (p) {
        const rate = p.porcentaje_retencion_iva !== undefined ? String(p.porcentaje_retencion_iva) : '75';
        form.setValue('retention_iva_rate', rate as any, { shouldValidate: true });
      }
    }
  }, [selectedProviderId, providers, form]);

  const selectedProvider = useMemo(() => 
    providers?.find(p => p.id === selectedProviderId),
  [providers, selectedProviderId]);

  // Totals
  const iva = form.watch('iva_amount') || 0;
  const islrPercentage = form.watch('islr_percentage') || 0;
  const retentionIvaRate = parseInt(form.watch('retention_iva_rate') || '0');

  const totalBeforeRetentions = base + exempt + iva;
  const retentionIvaAmount = (iva * retentionIvaRate) / 100;
  const retentionIslrAmount = (base + exempt) * islrPercentage;
  const netToPay = totalBeforeRetentions - retentionIvaAmount - retentionIslrAmount;

  const rate = bcvRate || 60;
  const netToPayAlternative = selectedCurrency === 'USD' ? netToPay * rate : netToPay / rate;

  const handleNext = async () => {
    const fieldsToValidate = step === 1 
      ? ['provider_id', 'invoice_number', 'control_number', 'date', 'base_amount', 'description'] 
      : [];
    
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      if (step === 1) {
        // DUPLICATE CHECK
        if (!concesionario?.id) return;
        setIsCheckingDuplicate(true);
        try {
          const invNum = invoiceNumber?.trim();
          const ctrlNum = controlNumber?.trim();

          // Check in 'compras'
          const { getDocs } = await import('firebase/firestore');
          const qFacP = query(collection(firestore, 'concesionarios', concesionario.id, 'compras'), 
            where('proveedor_id', '==', selectedProviderId), where('numero_factura', '==', invNum));
          const qCtrlP = query(collection(firestore, 'concesionarios', concesionario.id, 'compras'), 
            where('proveedor_id', '==', selectedProviderId), where('numero_control', '==', ctrlNum));
          
          // Check in 'gastos'
          const qFacE = query(collection(firestore, 'concesionarios', concesionario.id, 'gastos'), 
            where('provider_id', '==', selectedProviderId), where('invoice_number', '==', invNum));
          const qCtrlE = query(collection(firestore, 'concesionarios', concesionario.id, 'gastos'), 
            where('provider_id', '==', selectedProviderId), where('control_number', '==', ctrlNum));

          const [snapFP, snapCP, snapFE, snapCE] = await Promise.all([
            getDocs(qFacP), getDocs(qCtrlP), getDocs(qFacE), getDocs(qCtrlE)
          ]);

          if (!snapFP.empty || !snapCP.empty || !snapFE.empty || !snapCE.empty) {
            setDuplicateInvoice(true);
            return;
          }
          setStep(2);
        } catch (e) {
          console.error(e);
          setStep(2);
        } finally {
          setIsCheckingDuplicate(false);
        }
      }
      else form.handleSubmit(handleSubmit)();
    }
  };

  const handleSubmit = async (values: ExpenseFormValues) => {
    if (!concesionario) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      let finalPayload: any = null;

      await runTransaction(firestore, async (transaction) => {
        const counterRef = doc(firestore, 'concesionarios', concesionario.id, 'contadores', 'retencion_iva');
        const counterSnap = await transaction.get(counterRef);
        
        let ivaSeq = 1;
        if (counterSnap.exists()) {
          ivaSeq = (counterSnap.data().ultimo_numero || 0) + 1;
        }

        const ivaRetentionNumber = `${yearMonth}${String(ivaSeq).padStart(8, '0')}`;
        
        // ISLR counter logic (can keep 4 digits as ISLR is different, but let's at least keep it sequential)
        const settingsRef = doc(firestore, 'concesionarios', concesionario.id, 'configuracion', 'business_settings');
        const settingsSnap = await transaction.get(settingsRef);
        let islrSeq = 1;
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.last_islr_retention_period === yearMonth) islrSeq = (data.last_islr_retention_seq || 0) + 1;
        }
        const islrRetentionNumber = `ISLR-${yearMonth}-${String(islrSeq).padStart(4, '0')}`;

        const expenseRef = doc(collection(firestore, 'concesionarios', concesionario.id, 'gastos'));
        finalPayload = {
          ...values,
          islr_concept: values.islr_concept || 'NONE',
          islr_percentage: values.islr_percentage || 0,
          provider_name: selectedProvider?.nombre || 'Proveedor Desconocido',
          provider_rif: selectedProvider?.rif || '',
          provider_direccion: selectedProvider?.direccion || '',
          iva_retention_number: iva > 0 && retentionIvaRate > 0 ? ivaRetentionNumber : null,
          iva_retention_amount: retentionIvaAmount,
          islr_retention_number: islrPercentage > 0 ? islrRetentionNumber : null,
          islr_retention_amount: retentionIslrAmount,
          total_amount: totalBeforeRetentions,
          net_to_pay: netToPay,
          total_usd: selectedCurrency === 'USD' ? netToPay : netToPay / rate,
          exchange_rate: rate,
          status: 'COMPLETADO',
          created_at: serverTimestamp(),
          created_by: staff?.id || concesionario.owner_uid,
          creado_por: staff?.nombre || 'Administrador',
        };

        transaction.set(expenseRef, finalPayload);

        // Update unified IVA counter
        if (iva > 0 && retentionIvaRate > 0) {
          transaction.set(counterRef, { ultimo_numero: ivaSeq, ultimo_prefix: yearMonth, updated_at: serverTimestamp() }, { merge: true });
        }

        // Update ISLR settings
        transaction.set(settingsRef, {
          last_islr_retention_period: yearMonth,
          last_islr_retention_seq: islrPercentage > 0 ? islrSeq : (settingsSnap.data()?.last_islr_retention_seq || 0),
        }, { merge: true });

        const cashRef = doc(collection(firestore, 'concesionarios', concesionario.id, 'caja'));
        transaction.set(cashRef, {
          tipo: 'egreso',
          monto: selectedCurrency === 'USD' ? netToPay : netToPay / rate,
          descripcion: `PAGO GASTO: ${values.invoice_number} - ${selectedProvider?.nombre}`,
          metodo_pago: values.currency === 'USD' ? 'Efectivo USD' : 'Transferencia VES',
          fecha: serverTimestamp(),
          referencia_pago: values.invoice_number,
        });
      });

      setSuccessData(finalPayload);
      toast({ title: 'Gasto registrado con éxito' });
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = (mode: 'summary' | 'iva' | 'islr') => {
    setPrintMode(mode);
    setTimeout(() => {
      const element = document.getElementById('expense-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  const handleDownload = async (mode: 'summary' | 'iva' | 'islr') => {
    setPrintMode(mode);
    setTimeout(async () => {
      const element = document.getElementById('expense-print-root');
      if (!element) return;
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        
        let filename = `Gasto_Resumen_${successData?.invoice_number}.pdf`;
        if (mode === 'iva') {
          filename = `Retencion_IVA_${successData?.iva_retention_number || 'S_N'}.pdf`;
        } else if (mode === 'islr') {
          filename = `Retencion_ISLR_${successData?.islr_retention_number || 'S_N'}.pdf`;
        }

        const opt = {
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false, 
            width: 800,
            windowWidth: 800 
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.display = 'block';
        clone.style.width = '800px';
        await html2pdf().set(opt).from(clone).save();
      } catch (err) { console.error(err); }
    }, 300);
  };

  if (successData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] p-8 text-center rounded-[2.5rem] border-none shadow-2xl bg-card/95 backdrop-blur-xl">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
              <CheckCircle2 className="w-14 h-14" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold font-headline">Gasto Registrado</h2>
              <p className="text-muted-foreground font-medium">La operación se ha procesado exitosamente.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 w-full pt-4">
              {/* Resumen */}
              <div className="flex bg-background border rounded-2xl overflow-hidden h-14 ring-1 ring-border items-stretch">
                <Button variant="ghost" className="flex-1 rounded-none border-r gap-2 font-bold h-full" onClick={() => handlePrint('summary')}>
                  <Printer className="w-4 h-4 text-primary" /> Imprimir Resumen
                </Button>
                <Button variant="ghost" className="px-5 h-full" onClick={() => handleDownload('summary')}>
                  <Download className="w-4 h-4 text-primary" />
                </Button>
              </div>

              {/* IVA */}
              {successData.iva_retention_number && (
                <div className="flex bg-background border rounded-2xl overflow-hidden h-14 ring-1 ring-border items-stretch">
                  <Button variant="ghost" className="flex-1 rounded-none border-r gap-2 font-bold text-primary h-full" onClick={() => handlePrint('iva')}>
                    <Printer className="w-4 h-4 text-primary" /> Imprimir IVA
                  </Button>
                  <Button variant="ghost" className="px-5 h-full" onClick={() => handleDownload('iva')}>
                    <Download className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              )}

              {/* ISLR */}
              {successData.islr_retention_number && (
                <div className="flex bg-background border rounded-2xl overflow-hidden h-14 ring-1 ring-border items-stretch">
                  <Button variant="ghost" className="flex-1 rounded-none border-r gap-2 font-bold text-amber-600 h-full" onClick={() => handlePrint('islr')}>
                    <Printer className="w-4 h-4 text-amber-600" /> Imprimir ISLR
                  </Button>
                  <Button variant="ghost" className="px-5 h-full" onClick={() => handleDownload('islr')}>
                    <Download className="w-4 h-4 text-amber-600" />
                  </Button>
                </div>
              )}
            </div>

            <Button size="lg" className="w-full rounded-2xl h-14 font-bold text-lg mt-4 shadow-xl shadow-primary/20" onClick={() => onOpenChange(false)}>
              Finalizar y Continuar
            </Button>
          </div>
          <ExpensePrint printMode={printMode} concesionario={concesionario} expenseData={successData} />
        </DialogContent>
      </Dialog>
    );
  }

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
                  <FormField control={form.control} name="provider_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-12 rounded-xl bg-background/50 border-muted-foreground/20"><SelectValue placeholder="Seleccione un proveedor" /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl shadow-2xl">
                          {providers?.map(p => (
                            <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase text-xs">{p.nombre} ({p.rif})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="invoice_number" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Número de Factura</FormLabel>
                  <FormControl><Input placeholder="000123" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="control_number" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Número de Control</FormLabel>
                  <FormControl><Input placeholder="00-00123" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fecha de Factura</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Moneda de Pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Moneda" /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-xl"><SelectItem value="VES">Bolívares (VES)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-primary/[0.03] rounded-[2rem] border border-primary/10">
                  <FormField control={form.control} name="base_amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-tighter">Monto Gravable</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="h-11 rounded-xl bg-background border-primary/20 font-bold" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="exempt_amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-tighter">Monto Exento</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="h-11 rounded-xl bg-background border-primary/20 font-bold" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="iva_amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary tracking-tighter">IVA (16% Auto)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} readOnly className="h-11 rounded-xl bg-muted border-primary/10 font-bold text-muted-foreground opacity-70" /></FormControl></FormItem>
                  )} />
                </div>

                <div className="md:col-span-2">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Descripción del Gasto</FormLabel>
                    <FormControl><Textarea placeholder="Ej: Pago de mantenimiento de aires acondicionados oficina principal..." {...field} className="rounded-2xl min-h-[100px]" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {duplicateInvoice && (
                  <div className="md:col-span-2 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
                    <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-destructive">Factura o Control Duplicado</p>
                      <p className="text-xs text-destructive/80">Este proveedor ya tiene registrada una factura o número de control idéntico en el sistema (Compras o Gastos). Por favor verifica los datos.</p>
                      <Button variant="link" size="sm" className="h-auto p-0 text-destructive font-bold underline" onClick={() => setDuplicateInvoice(null)}>Entendido, corregir</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="grid grid-cols-1 gap-6">
                  {/* Retention IVA is now hidden as it is automatic */}
                  <FormField control={form.control} name="islr_concept" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Concepto Retención ISLR</FormLabel>
                      <Select onValueChange={(val) => { field.onChange(val); const concept = ISLR_CONCEPTS.find(c => c.code === val); form.setValue('islr_percentage', concept?.value || 0, { shouldValidate: true }); }} value={field.value}>
                        <FormControl><SelectTrigger className="h-14 rounded-2xl border-primary/20 bg-primary/5 font-bold text-lg"><SelectValue placeholder="Seleccione Concepto" /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-2xl"><SelectItem value="NONE" className="font-bold py-4 uppercase text-xs text-muted-foreground">No aplica retención</SelectItem>{ISLR_CONCEPTS.map(c => (<SelectItem key={c.code} value={c.code} className="font-bold py-4 uppercase text-xs">{c.label}</SelectItem>))}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="p-8 bg-primary rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><FileText className="h-32 w-32 text-white" /></div>
                  <div className="grid grid-cols-2 gap-y-6 relative z-10 text-white">
                    <div className="space-y-1"><p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Monto Facturado ({selectedCurrency})</p><p className="text-2xl font-bold font-headline">{formatCurrency(totalBeforeRetentions, selectedCurrency)}</p></div>
                    <div className="space-y-1 text-right"><p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Retención IVA ({retentionIvaRate}%)</p><p className="text-xl font-bold font-headline text-white/80">{formatCurrency(retentionIvaAmount, selectedCurrency)}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Retención ISLR ({(islrPercentage * 100).toFixed(0)}%)</p><p className="text-xl font-bold font-headline text-white/80">{formatCurrency(retentionIslrAmount, selectedCurrency)}</p></div>
                    <div className="pt-6 border-t border-white/10 col-span-2 flex justify-between items-end">
                      <div><p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Total Neto a Pagar ({selectedCurrency})</p><p className="text-4xl font-bold font-headline">{formatCurrency(netToPay, selectedCurrency)}</p></div>
                      <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
                        <p className="text-[9px] font-bold text-white/70 uppercase">Contravalor {selectedCurrency === 'USD' ? 'Bs.' : '$'}</p>
                        <p className="text-sm font-bold text-white tracking-tight">{formatCurrency(netToPayAlternative, selectedCurrency === 'USD' ? 'VES' : 'USD')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t flex flex-row justify-between items-center">
            {step === 2 && <Button variant="ghost" type="button" onClick={() => setStep(1)} disabled={isSaving} className="rounded-xl h-12 px-6 gap-2"><ArrowLeft className="h-4 w-4" /> Anterior</Button>}
            <div className="flex gap-3 ml-auto">
              <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={isSaving} className="rounded-xl h-12 px-6">Cancelar</Button>
              <Button type="button" onClick={handleNext} disabled={isSaving} className={cn("rounded-xl h-12 px-8 shadow-xl transition-all gap-2 font-bold", step === 2 ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-primary shadow-primary/20")}>
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>{step === 1 ? 'Siguiente' : 'Confirmar Registro'}{step === 1 ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</>)}
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
