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
import { downloadPdf } from '@/lib/download-pdf';

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

    let filename = `Gasto_Resumen_${successData?.invoice_number}.pdf`;
    if (mode === 'iva') {
      filename = `Retencion_IVA_${successData?.iva_retention_number || 'S_N'}.pdf`;
    } else if (mode === 'islr') {
      filename = `Retencion_ISLR_${successData?.islr_retention_number || 'S_N'}.pdf`;
    }

    // Wait for React to commit the portal with new printMode
    await new Promise(r => setTimeout(r, 400));

    await downloadPdf({ elementId: 'expense-print-root', filename });
  };

  if (successData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-[600px] p-6 md:p-8 text-center rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl bg-card/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
              <CheckCircle2 className="w-10 h-10 md:w-14 md:h-14" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold font-headline">Gasto Registrado</h2>
              <p className="text-sm md:text-base text-muted-foreground font-medium">La operación se ha procesado exitosamente.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 w-full pt-4">
              {/* Resumen */}
              <div className="flex bg-background border rounded-xl md:rounded-2xl overflow-hidden h-12 md:h-14 ring-1 ring-border items-stretch">
                <Button variant="ghost" className="flex-1 rounded-none border-r gap-2 font-bold h-full text-xs md:text-sm" onClick={() => handlePrint('summary')}>
                  <Printer className="w-4 h-4 text-primary" /> Resumen
                </Button>
                <Button variant="ghost" className="px-4 md:px-5 h-full" onClick={() => handleDownload('summary')}>
                  <Download className="w-4 h-4 text-primary" />
                </Button>
              </div>

              {/* IVA */}
              {successData.iva_retention_number && (
                <div className="flex bg-background border rounded-xl md:rounded-2xl overflow-hidden h-12 md:h-14 ring-1 ring-border items-stretch">
                  <Button variant="ghost" className="flex-1 rounded-none border-r gap-2 font-bold text-primary h-full text-xs md:text-sm" onClick={() => handlePrint('iva')}>
                    <Printer className="w-4 h-4 text-primary" /> IVA
                  </Button>
                  <Button variant="ghost" className="px-4 md:px-5 h-full" onClick={() => handleDownload('iva')}>
                    <Download className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              )}

              {/* ISLR */}
              {successData.islr_retention_number && (
                <div className="flex bg-background border rounded-xl md:rounded-2xl overflow-hidden h-12 md:h-14 ring-1 ring-border items-stretch">
                  <Button variant="ghost" className="flex-1 rounded-none border-r gap-2 font-bold text-amber-600 h-full text-xs md:text-sm" onClick={() => handlePrint('islr')}>
                    <Printer className="w-4 h-4 text-amber-600" /> ISLR
                  </Button>
                  <Button variant="ghost" className="px-4 md:px-5 h-full" onClick={() => handleDownload('islr')}>
                    <Download className="w-4 h-4 text-amber-600" />
                  </Button>
                </div>
              )}
            </div>

            <Button size="lg" className="w-full rounded-xl md:rounded-2xl h-12 md:h-14 font-bold text-base md:text-lg mt-4 shadow-xl shadow-primary/20" onClick={() => onOpenChange(false)}>
              Finalizar
            </Button>
          </div>
          <ExpensePrint printMode={printMode} concesionario={concesionario} expenseData={successData} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border-none shadow-2xl bg-card/95 backdrop-blur-xl ring-1 ring-border max-h-[95vh] flex flex-col">
        <DialogHeader className="p-6 md:p-8 bg-muted/30 border-b relative overflow-hidden shrink-0">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-2.5 md:p-3 bg-primary rounded-xl md:rounded-2xl shadow-lg shadow-primary/20">
              <Calculator className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-bold font-headline">Asistente de Gastos</DialogTitle>
              <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">Paso {step} de 2: {step === 1 ? 'Identificación' : 'Fiscalidad'}</p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            {step === 1 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="sm:col-span-2 space-y-4">
                  <FormField control={form.control} name="provider_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-11 md:h-12 rounded-xl bg-background/50 border-muted-foreground/20 text-xs md:text-sm"><SelectValue placeholder="Seleccione un proveedor" /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl shadow-2xl">
                          {providers?.map(p => (
                            <SelectItem key={p.id} value={p.id} className="font-bold py-2 md:py-3 uppercase text-[10px] md:text-xs">{p.nombre} ({p.rif})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="invoice_number" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">Factura</FormLabel>
                  <FormControl><Input placeholder="000123" {...field} className="h-11 md:h-12 rounded-xl text-xs md:text-sm" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="control_number" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">N° Control</FormLabel>
                  <FormControl><Input placeholder="00-00123" {...field} className="h-11 md:h-12 rounded-xl text-xs md:text-sm" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">Fecha</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-11 md:h-12 rounded-xl text-xs md:text-sm" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-11 md:h-12 rounded-xl text-xs md:text-sm"><SelectValue placeholder="Moneda" /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-xl"><SelectItem value="VES">Bolívares (VES)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />

                <div className="sm:col-span-2 grid grid-cols-3 gap-2 md:gap-4 p-4 md:p-6 bg-primary/[0.03] rounded-[1.5rem] md:rounded-[2rem] border border-primary/10">
                  <FormField control={form.control} name="base_amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-[8px] md:text-[10px] font-black uppercase text-primary tracking-tighter">Gravable</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="h-9 md:h-11 rounded-lg md:rounded-xl bg-background border-primary/20 font-bold text-xs md:text-sm p-2" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="exempt_amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-[8px] md:text-[10px] font-black uppercase text-primary tracking-tighter">Exento</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="h-9 md:h-11 rounded-lg md:rounded-xl bg-background border-primary/20 font-bold text-xs md:text-sm p-2" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="iva_amount" render={({ field }) => (
                    <FormItem><FormLabel className="text-[8px] md:text-[10px] font-black uppercase text-primary tracking-tighter">IVA 16%</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} readOnly className="h-9 md:h-11 rounded-lg md:rounded-xl bg-muted border-primary/10 font-bold text-muted-foreground opacity-70 text-xs md:text-sm p-2" /></FormControl></FormItem>
                  )} />
                </div>

                <div className="sm:col-span-2">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">Descripción</FormLabel>
                    <FormControl><Textarea placeholder="Ej: Pago de mantenimiento..." {...field} className="rounded-xl md:rounded-2xl min-h-[80px] md:min-h-[100px] text-xs md:text-sm" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {duplicateInvoice && (
                  <div className="sm:col-span-2 p-3 md:p-4 bg-destructive/10 border border-destructive/20 rounded-xl md:rounded-2xl flex items-start gap-2 md:gap-3 animate-in slide-in-from-top-2">
                    <ShieldAlert className="h-4 w-4 md:h-5 md:w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs md:text-sm font-bold text-destructive">Factura o Control Duplicado</p>
                      <p className="text-[10px] md:text-xs text-destructive/80 leading-tight">Ya existe una factura registrada con estos datos.</p>
                      <Button variant="link" size="sm" className="h-auto p-0 text-destructive font-black text-[10px] uppercase underline" onClick={() => setDuplicateInvoice(null)}>Corregir</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="grid grid-cols-1 gap-6">
                  <FormField control={form.control} name="islr_concept" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">Retención ISLR</FormLabel>
                      <Select onValueChange={(val) => { field.onChange(val); const concept = ISLR_CONCEPTS.find(c => c.code === val); form.setValue('islr_percentage', concept?.value || 0, { shouldValidate: true }); }} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 md:h-14 rounded-xl md:rounded-2xl border-primary/20 bg-primary/5 font-bold text-sm md:text-lg"><SelectValue placeholder="Seleccione Concepto" /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl md:rounded-2xl"><SelectItem value="NONE" className="font-bold py-3 md:py-4 uppercase text-[10px] md:text-xs text-muted-foreground">No aplica</SelectItem>{ISLR_CONCEPTS.map(c => (<SelectItem key={c.code} value={c.code} className="font-bold py-3 md:py-4 uppercase text-[10px] md:text-xs">{c.label}</SelectItem>))}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="p-6 md:p-8 bg-primary rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10 group-hover:scale-110 transition-transform"><FileText className="h-24 w-24 md:h-32 md:w-32 text-white" /></div>
                  <div className="grid grid-cols-2 gap-y-4 md:gap-y-6 relative z-10 text-white">
                    <div className="space-y-1"><p className="text-[8px] md:text-[10px] font-black opacity-60 uppercase tracking-widest">Monto Facturado</p><p className="text-xl md:text-2xl font-bold font-headline">{formatCurrency(totalBeforeRetentions, selectedCurrency)}</p></div>
                    <div className="space-y-1 text-right"><p className="text-[8px] md:text-[10px] font-black opacity-60 uppercase tracking-widest">Ret. IVA</p><p className="text-lg md:text-xl font-bold font-headline text-white/80">{formatCurrency(retentionIvaAmount, selectedCurrency)}</p></div>
                    <div className="space-y-1"><p className="text-[8px] md:text-[10px] font-black opacity-60 uppercase tracking-widest">Ret. ISLR ({(islrPercentage * 100).toFixed(0)}%)</p><p className="text-lg md:text-xl font-bold font-headline text-white/80">{formatCurrency(retentionIslrAmount, selectedCurrency)}</p></div>
                    <div className="pt-4 md:pt-6 border-t border-white/10 col-span-2 flex justify-between items-end">
                      <div><p className="text-[8px] md:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Neto a Pagar</p><p className="text-3xl md:text-4xl font-bold font-headline">{formatCurrency(netToPay, selectedCurrency)}</p></div>
                      <div className="bg-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl backdrop-blur-md">
                        <p className="text-[7px] md:text-[9px] font-bold text-white/70 uppercase">Ref. {selectedCurrency === 'USD' ? 'Bs.' : '$'}</p>
                        <p className="text-xs md:text-sm font-bold text-white tracking-tight">{formatCurrency(netToPayAlternative, selectedCurrency === 'USD' ? 'VES' : 'USD')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 md:p-8 bg-muted/20 border-t flex flex-row justify-between items-center shrink-0">
            {step === 2 ? (
              <Button variant="ghost" type="button" onClick={() => setStep(1)} disabled={isSaving} className="rounded-xl h-11 md:h-12 px-4 md:px-6 gap-2 text-xs md:text-sm">
                <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Anterior</span>
              </Button>
            ) : <div className="w-10" />}
            <div className="flex gap-2 md:gap-3">
              <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={isSaving} className="rounded-xl h-11 md:h-12 px-4 md:px-6 text-xs md:text-sm">Cancelar</Button>
              <Button type="button" onClick={handleNext} disabled={isSaving} className={cn("rounded-xl h-11 md:h-12 px-6 md:px-8 shadow-xl transition-all gap-2 font-bold text-xs md:text-sm", step === 2 ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-primary shadow-primary/20")}>
                {isSaving ? <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" /> : (<>{step === 1 ? 'Siguiente' : 'Registrar'}{step === 1 ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</>)}
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
