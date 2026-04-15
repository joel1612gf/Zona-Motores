'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  fiscalNoteSchema, type FiscalNoteFormValues 
} from '@/lib/finance-schemas';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, query, where, doc, runTransaction, serverTimestamp, orderBy, getDocs, getDoc 
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { 
  Loader2, Search, FileText, ArrowUpDown, AlertCircle, CheckCircle2, Printer, Download 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Compra, Proveedor } from '@/lib/business-types';
import { useCurrency } from '@/context/currency-context';
import { FiscalNotePrint } from './fiscal-note-print';
import { downloadPdf } from '@/lib/download-pdf';

export function FiscalNoteForm({ type, onSuccess }: { type: 'DEBIT' | 'CREDIT', onSuccess: () => void }) {
  const { concesionario, staff } = useBusinessAuth();
  const { bcvRate } = useCurrency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'summary' | 'retention' | 'iva'>('summary');


  // Default exchange rate logic
  const defaultRate = useMemo(() => {
    return concesionario?.configuracion?.tasa_cambio_manual || bcvRate || 60;
  }, [concesionario, bcvRate]);

  // Fetch pending credit purchases
  const purchasesQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'compras'),
      where('tipo_pago', '==', 'credito'),
      where('estado', '==', 'pendiente'),
      orderBy('created_at', 'desc')
    );
  }, [concesionario, firestore]);

  const { data: purchases, isLoading: loadingPurchases } = useCollection<Compra>(purchasesQuery);

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter(p => 
      p.numero_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [purchases, searchTerm]);

  const form = useForm<FiscalNoteFormValues>({
    resolver: zodResolver(fiscalNoteSchema),
    defaultValues: {
      type,
      currency: 'VES',
      exchange_rate: defaultRate,
      taxable_amount: 0,
      exempt_amount: 0,
      iva_amount: 0,
      igtf_amount: 0,
      reason: '',
      note_number: '',
    },
  });

  const selectedInvoiceId = form.watch('invoice_id');

  // Logic to auto-generate Note Number when invoice is selected
  useEffect(() => {
    async function fetchNextNoteNumber() {
      if (selectedInvoiceId && concesionario?.id) {
        const inv = purchases?.find(p => p.id === selectedInvoiceId);
        if (!inv) return;

        try {
          const notesRef = collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales');
          const q = query(notesRef, where('invoice_id', '==', selectedInvoiceId));
          const snap = await getDocs(q);
          
          const nextSeq = snap.size + 1;
          const suffix = String(nextSeq).padStart(2, '0');
          form.setValue('note_number', `${inv.numero_factura}-${suffix}`, { shouldValidate: true });
        } catch (e) {
          console.error("Error fetching note sequence:", e);
        }
      }
    }
    fetchNextNoteNumber();
  }, [selectedInvoiceId, concesionario?.id, firestore, purchases, form]);

  const selectedCurrency = form.watch('currency');
  const currentRate = form.watch('exchange_rate') || 1;
  
  const selectedInvoice = useMemo(() => 
    purchases?.find(p => p.id === selectedInvoiceId), 
  [purchases, selectedInvoiceId]);

  const taxable = form.watch('taxable_amount') || 0;
  const exempt = form.watch('exempt_amount') || 0;
  const iva = taxable * 0.16;
  const igtf = selectedCurrency === 'USD' ? (taxable + exempt + iva) * 0.03 : 0;
  
  // Total in the currency of the NOTE
  const totalInNoteCurrency = taxable + exempt + iva + igtf;
  
  // Total in USD (to adjust the balance)
  const totalInUsd = selectedCurrency === 'VES' 
    ? totalInNoteCurrency / currentRate 
    : totalInNoteCurrency;

  const handleSubmit = async (values: FiscalNoteFormValues) => {
    if (!concesionario || !selectedInvoice) return;
    setIsSaving(true);
    try {
      // 1. Uniqueness check per provider
      const notesRef = collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales');
      const qDup = query(
        notesRef, 
        where('provider_id', '==', selectedInvoice.proveedor_id),
        where('note_number', '==', values.note_number.trim())
      );
      const snapDup = await getDocs(qDup);
      if (!snapDup.empty) {
        toast({ 
          variant: 'destructive', 
          title: 'Número de Nota Duplicado', 
          description: `Este proveedor ya tiene una nota registrada con el número ${values.note_number}.` 
        });
        setIsSaving(false);
        return;
      }

      // Fetch the actual provider to get full name and rif correctly
      let fullProviderName = selectedInvoice.proveedor_nombre;
      let fullProviderRif = (selectedInvoice as any).proveedor_rif || '';
      let fullProviderAddress = (selectedInvoice as any).proveedor_direccion || '';

      try {
        const provSnap = await getDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', selectedInvoice.proveedor_id));
        if (provSnap.exists()) {
          const provData = provSnap.data() as Proveedor;
          // Use full name and RIF from the provider document to avoid truncated data
          fullProviderName = provData.nombre || fullProviderName;
          fullProviderRif = provData.rif || fullProviderRif;
          fullProviderAddress = provData.direccion || fullProviderAddress;
        }
      } catch (e) {
        console.error("Error fetching full provider data:", e);
      }

      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const formattedToday = now.toISOString().split('T')[0];

      let resultPayload: any = null;

      await runTransaction(firestore, async (transaction) => {
        const counterRef = doc(firestore, 'concesionarios', concesionario.id, 'contadores', 'retencion_iva');
        const purchaseRef = doc(firestore, 'concesionarios', concesionario.id, 'compras', selectedInvoice.id);
        
        const counterSnap = await transaction.get(counterRef);
        const purchaseSnap = await transaction.get(purchaseRef);

        if (!purchaseSnap.exists()) throw new Error('La factura ya no existe.');

        let ivaSeq = 1;
        if (counterSnap.exists()) {
          ivaSeq = (counterSnap.data().ultimo_numero || 0) + 1;
        }

        const ivaRetentionNumber = `${yearMonth}${String(ivaSeq).padStart(8, '0')}`;
        const purchaseDocData = purchaseSnap.data() as any;
        const currentSaldo = purchaseDocData.saldo_pendiente ?? purchaseDocData.total_usd;
        
        // Balance Adjustment
        const adjustment = values.type === 'DEBIT' ? totalInUsd : -totalInUsd;
        const newSaldo = Math.max(0, currentSaldo + adjustment);

        const noteRef = doc(collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales'));
        
        resultPayload = {
          ...values,
          total_amount: totalInNoteCurrency,
          iva_amount: iva,
          igtf_amount: igtf,
          total_usd: totalInUsd,
          invoice_id: selectedInvoice.id,
          invoice_number: purchaseDocData.numero_factura || 'S/N',
          control_number: purchaseDocData.numero_control || 'S/N',
          provider_id: selectedInvoice.proveedor_id,
          provider_name: fullProviderName,
          provider_rif: fullProviderRif,
          provider_direccion: fullProviderAddress,
          invoice_date: purchaseDocData.fecha_factura || purchaseDocData.date || '',
          date: formattedToday, // Note issuance date
          iva_retention_number: ivaRetentionNumber,
          retention_iva_rate: purchaseDocData.porcentaje_retencion_aplicado || 75,
          status: 'COMPLETADO',
          created_at: serverTimestamp(),
          created_by: staff?.id || concesionario.owner_uid,
          creado_por: staff?.nombre || 'Administrador',
        };

        transaction.set(noteRef, resultPayload);

        transaction.update(purchaseRef, {
          saldo_pendiente: newSaldo,
          estado: newSaldo <= 0.01 ? 'pagada' : 'pendiente',
          updated_at: serverTimestamp(),
        });

        // Update unified counter
        transaction.set(counterRef, { ultimo_numero: ivaSeq, ultimo_prefix: yearMonth, updated_at: serverTimestamp() }, { merge: true });
      });

      setSuccessData(resultPayload);
      toast({ 
        title: `Nota de ${type === 'DEBIT' ? 'Débito' : 'Crédito'} generada`, 
        description: `El saldo de la factura ${selectedInvoice.numero_factura} ha sido actualizado.` 
      });
    } catch (error: any) {
      console.error('Error saving fiscal note:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo procesar la nota.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = (mode: 'summary' | 'retention') => {
    setPrintMode(mode);
    setTimeout(() => {
      const element = document.getElementById('fiscal-note-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 300);
  };

  const handleDownload = async (mode: 'summary' | 'retention' | 'iva') => {
    setPrintMode(mode);

    const filename = mode === 'summary'
      ? `Nota_Resumen_${successData?.invoice_number || 'N_A'}.pdf`
      : `Retencion_IVA_${successData?.iva_retention_number || 'N_A'}.pdf`;

    // Wait for React to commit the portal with new printMode
    await new Promise(r => setTimeout(r, 400));

    await downloadPdf({ elementId: 'fiscal-note-print-root', filename });
  };

  if (successData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center relative overflow-hidden">
          <CheckCircle2 className="w-12 h-12 animate-[bounce_1s_ease-out_1]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">¡Nota Cargada con Éxito!</h2>
          <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
            El ajuste se ha registrado y el saldo de la factura ha sido actualizado.
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex bg-background border rounded-2xl shadow-sm overflow-hidden h-14 items-stretch ring-1 ring-border">
              <Button
                variant="ghost"
                className="flex-1 rounded-none border-r px-4 gap-2 h-full font-bold text-primary"
                onClick={() => handlePrint('summary')}
              >
                <Printer className="w-4 h-4 text-primary" />
                Imprimir Resumen
              </Button>
              <Button
                variant="ghost"
                className="rounded-none px-5 h-full"
                onClick={() => handleDownload('summary')}
                title="Descargar PDF"
              >
                <Download className="w-4 h-4 text-primary" />
              </Button>
            </div>

            <div className="flex bg-background border rounded-2xl shadow-sm overflow-hidden h-14 items-stretch ring-1 ring-border">
              <Button
                variant="ghost"
                className="flex-1 rounded-none border-r px-4 gap-2 h-full font-bold text-primary"
                onClick={() => handlePrint('retention')}
              >
                <Printer className="w-4 h-4 text-primary" />
                Imprimir IVA
              </Button>
              <Button
                variant="ghost"
                className="rounded-none px-5 h-full"
                onClick={() => handleDownload('retention')}
                title="Descargar PDF"
              >
                <Download className="w-4 h-4 text-primary" />
              </Button>
            </div>
          </div>
          
          <Button
            size="lg"
            variant="outline"
            className="w-full rounded-2xl h-14 font-bold shadow-sm"
            onClick={onSuccess}
          >
            Continuar
          </Button>
        </div>

        <FiscalNotePrint 
          printMode={printMode} 
          concesionario={concesionario} 
          noteData={successData} 
        />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {!selectedInvoice ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar factura por número o proveedor..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-12 rounded-xl"
              />
            </div>

            <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {loadingPurchases ? (
                <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
              ) : filteredPurchases.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    form.setValue('invoice_id', p.id);
                    form.setValue('invoice_number', p.numero_factura || '');
                  }}
                  className="flex items-center justify-between p-4 rounded-2xl border bg-background hover:bg-primary/5 hover:border-primary/50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-xl group-hover:bg-primary/10 transition-colors">
                      <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{p.numero_factura || 'S/N'}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-black">{p.proveedor_nombre}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-primary">{formatCurrency(p.saldo_pendiente ?? p.total_usd, 'USD')}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Saldo Pendiente</p>
                  </div>
                </button>
              ))}
              {!loadingPurchases && filteredPurchases.length === 0 && (
                <div className="py-10 text-center opacity-40">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">No se encontraron facturas a crédito</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Factura Vinculada</p>
                  <p className="font-bold">{selectedInvoice.numero_factura} - {selectedInvoice.proveedor_nombre}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" type="button" onClick={() => form.setValue('invoice_id', '')} className="text-primary hover:text-primary hover:bg-primary/10">Cambiar</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="note_number"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                      <FileText className="h-3 w-3" /> Número de Nota de {type === 'DEBIT' ? 'Débito' : 'Crédito'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: 00122-01" 
                        {...field} 
                        className="h-12 rounded-xl font-bold border-primary/30 focus:border-primary" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Moneda de la Nota</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl font-bold">
                          <SelectValue placeholder="Seleccione Moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="VES">Bolívares (VES)</SelectItem>
                        <SelectItem value="USD">Dólares (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exchange_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Tasa de Cambio (BCV)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        className="h-12 rounded-xl font-bold bg-muted/30" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxable_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Monto Gravable</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        className="h-12 rounded-xl font-bold text-lg" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exempt_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Monto Exento</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        className="h-12 rounded-xl font-bold text-lg" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">IVA (16% Automático)</Label>
                <div className="h-12 flex items-center px-4 rounded-xl bg-muted/50 border font-bold text-muted-foreground italic">
                  + {formatCurrency(iva, selectedCurrency)}
                </div>
              </div>

              {selectedCurrency === 'USD' ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label className="text-xs font-black uppercase text-amber-600 tracking-widest flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> IGTF (3% Aplicado)
                  </Label>
                  <div className="h-12 flex items-center px-4 rounded-xl bg-amber-500/5 border border-amber-500/20 font-bold text-amber-700 italic">
                    + {formatCurrency(igtf, 'USD')}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Equivalente en USD</Label>
                  <div className="h-12 flex items-center px-4 rounded-xl bg-primary/5 border border-primary/10 font-bold text-primary italic">
                    ≈ {formatCurrency(totalInUsd, 'USD')}
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Motivo del Ajuste</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Ej: Devolución de mercancía dañada, error en precio pactado..." {...field} className="rounded-2xl min-h-[100px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="p-6 bg-primary rounded-3xl shadow-xl relative overflow-hidden group text-white">
              <ArrowUpDown className="absolute -bottom-4 -right-4 h-24 w-24 opacity-10 group-hover:scale-110 transition-transform" />
              <div className="flex justify-between items-end relative z-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Total Nota ({selectedCurrency})</p>
                  <p className="text-4xl font-bold font-headline">{formatCurrency(totalInNoteCurrency, selectedCurrency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Nuevo Saldo ({selectedCurrency})</p>
                  <p className="text-xl font-bold font-headline leading-none">
                    {formatCurrency(
                      Math.max(0, (selectedInvoice.saldo_pendiente ?? selectedInvoice.total_usd) + (type === 'DEBIT' ? totalInUsd : -totalInUsd)) * (selectedCurrency === 'VES' ? currentRate : 1), 
                      selectedCurrency
                    )}
                  </p>
                  <p className="text-[9px] font-black uppercase opacity-50 mt-1">
                    Ref: {formatCurrency(
                      Math.max(0, (selectedInvoice.saldo_pendiente ?? selectedInvoice.total_usd) + (type === 'DEBIT' ? totalInUsd : -totalInUsd)) * (selectedCurrency === 'USD' ? currentRate : 1),
                      selectedCurrency === 'USD' ? 'VES' : 'USD'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSaving} 
              className={cn(
                "w-full h-14 rounded-2xl font-bold text-lg shadow-xl transition-all gap-2",
                type === 'CREDIT' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-primary shadow-primary/20"
              )}
            >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Generar Nota de {type === 'DEBIT' ? 'Débito' : 'Crédito'}
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
