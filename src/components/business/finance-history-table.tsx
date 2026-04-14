'use client';

import React, { useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Printer, Download, FileText, Search, ChevronDown, ChevronRight, 
  TrendingDown, ArrowUpDown, Receipt, ShieldCheck, FileCheck 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useBusinessAuth } from '@/context/business-auth-context';
import { Input } from '@/components/ui/input';
import { FiscalNotePrint } from './fiscal-note-print';
import { ExpensePrint } from './expense-print';

interface FinanceHistoryTableProps {
  type: 'EXPENSE' | 'DEBIT' | 'CREDIT';
}

export function FinanceHistoryTable({ type }: FinanceHistoryTableProps) {
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [printMode, setPrintMode] = useState<any>('summary');

  // Query logic
  const historyQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    if (type === 'EXPENSE') {
      return query(collection(firestore, 'concesionarios', concesionario.id, 'gastos'), orderBy('created_at', 'desc'));
    } else {
      return query(collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales'), where('type', '==', type), orderBy('created_at', 'desc'));
    }
  }, [concesionario, type, firestore]);

  const { data: records, isLoading } = useCollection<any>(historyQuery);

  const filteredRecords = records?.filter(r => 
    r.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handlePrint = async (record: any, mode: string) => {
    let loadedRecord = { ...record };
    if (!loadedRecord.provider_direccion && concesionario?.id && record.provider_id) {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const pSnap = await getDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', record.provider_id));
        if (pSnap.exists() && pSnap.data().direccion) {
          loadedRecord.provider_direccion = pSnap.data().direccion;
        }
      } catch (err) {
        console.error('Error fetching provider address:', err);
      }
    }

    setPrintData(loadedRecord);
    setPrintMode(mode);
    setTimeout(() => {
      const elementId = type === 'EXPENSE' ? 'expense-print-root' : 'fiscal-note-print-root';
      const element = document.getElementById(elementId);
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 300);
  };

  const handleDownload = async (record: any, mode: string) => {
    let loadedRecord = { ...record };
    if (!loadedRecord.provider_direccion && concesionario?.id && record.provider_id) {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const pSnap = await getDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', record.provider_id));
        if (pSnap.exists() && pSnap.data().direccion) {
          loadedRecord.provider_direccion = pSnap.data().direccion;
        }
      } catch (err) {
        console.error('Error fetching provider address:', err);
      }
    }

    setPrintData(loadedRecord);
    setPrintMode(mode);
    setTimeout(async () => {
      const elementId = type === 'EXPENSE' ? 'expense-print-root' : 'fiscal-note-print-root';
      const element = document.getElementById(elementId);
      if (!element) return;
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        
        let filename = `${type}_${mode}_${record.invoice_number}.pdf`;
        if (mode === 'iva' || mode === 'retention') {
          filename = `Retencion_IVA_${record.iva_retention_number || 'S_N'}.pdf`;
        } else if (mode === 'islr') {
          filename = `Retencion_ISLR_${record.islr_retention_number || 'S_N'}.pdf`;
        } else if (mode === 'summary') {
          filename = `${type === 'EXPENSE' ? 'Gasto' : 'Nota'}_Resumen_${record.invoice_number}.pdf`;
        }

        const opt = {
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, width: 794, windowWidth: 794 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.display = 'block';
        clone.style.width = '210mm';
        await html2pdf().set(opt).from(clone).save();
      } catch (err) { console.error(err); }
    }, 400);
  };

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando finanzas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar por proveedor, RIF o número de factura..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 h-14 rounded-2xl bg-background/40 border-muted-foreground/10 focus:bg-background/80 focus:ring-2 focus:ring-primary/20 transition-all text-base shadow-inner"
        />
      </div>

      <div className="rounded-[2.5rem] border bg-card/30 overflow-hidden backdrop-blur-md shadow-2xl ring-1 ring-white/10">
        <Table>
          <TableHeader className="bg-muted/40 border-b border-white/5">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 px-4">Fecha</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Proveedor / RIF</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Referencia</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total Operación</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-center px-6">Estado Fiscal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-60 text-center opacity-30">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-6 bg-muted rounded-full"><FileText className="h-12 w-12" /></div>
                    <p className="font-bold text-sm uppercase tracking-widest">No hay registros para mostrar</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredRecords.map((record) => (
              <React.Fragment key={record.id}>
                <TableRow 
                  className={cn(
                    "group cursor-pointer transition-all duration-300 border-b-white/5",
                    expandedRow === record.id ? "bg-primary/[0.07]" : "hover:bg-primary/[0.03]"
                  )}
                  onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                >
                  <TableCell className="pl-6">
                    {expandedRow === record.id ? 
                      <ChevronDown className="h-5 w-5 text-primary animate-in fade-in duration-300" /> : 
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    }
                  </TableCell>
                  <TableCell className="font-bold text-xs whitespace-nowrap">
                    {record.created_at?.toDate().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <p className="font-bold text-sm leading-tight text-foreground/90">{record.provider_name}</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{record.provider_rif}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">
                        {type === 'EXPENSE' ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> : <ArrowUpDown className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <span className="font-mono text-sm font-black text-foreground/70">#{record.invoice_number}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-black text-sm text-primary">
                      {formatCurrency(record.total_amount, record.currency || 'USD')}
                    </p>
                    {record.currency === 'VES' && record.total_usd && (
                      <p className="text-[10px] text-muted-foreground font-bold italic">≈ {formatCurrency(record.total_usd, 'USD')}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-center px-6">
                    <div className="flex justify-center gap-1.5">
                      {record.iva_retention_number && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-black uppercase">IVA</Badge>}
                      {record.islr_retention_number && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] font-black uppercase">ISLR</Badge>}
                      {!record.iva_retention_number && !record.islr_retention_number && <span className="text-[10px] text-muted-foreground italic font-medium">No aplica</span>}
                    </div>
                  </TableCell>
                </TableRow>

                {/* EXPANDED AREA */}
                {expandedRow === record.id && (
                  <TableRow className="bg-primary/[0.04] border-none animate-in slide-in-from-top-2 duration-300">
                    <TableCell colSpan={6} className="p-8">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="space-y-4 lg:col-span-1">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <FileText className="h-3 w-3" /> Detalles de la Operación
                          </h4>
                          <div className="p-5 bg-background/60 rounded-[1.5rem] border border-white/10 shadow-sm ring-1 ring-black/5">
                            <p className="text-sm font-medium text-foreground/80 leading-relaxed italic italic">
                              "{record.reason || record.description || 'Sin descripción detallada'}"
                            </p>
                          </div>
                        </div>

                        <div className="lg:col-span-2 space-y-4">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Printer className="h-3 w-3" /> Gestión de Documentos Fiscales
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Summary Button */}
                            <div className="group/btn flex flex-col bg-background border border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                              <Button variant="ghost" className="h-12 rounded-none border-b border-white/5 font-bold gap-2 text-xs" onClick={() => handlePrint(record, 'summary')}>
                                <FileCheck className="h-4 w-4 text-primary" /> Imprimir Resumen
                              </Button>
                              <Button variant="ghost" className="h-10 rounded-none bg-primary/[0.03] hover:bg-primary/10 text-[10px] font-black uppercase text-primary gap-2" onClick={() => handleDownload(record, 'summary')}>
                                <Download className="h-3.5 w-3.5" /> Descargar PDF
                              </Button>
                            </div>

                            {/* IVA Button */}
                            {record.iva_retention_number && (
                              <div className="group/btn flex flex-col bg-background border border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                                <Button variant="ghost" className="h-12 rounded-none border-b border-white/5 font-bold gap-2 text-xs text-primary" onClick={() => handlePrint(record, 'retention' in record ? 'retention' : 'iva')}>
                                  <ShieldCheck className="h-4 w-4" /> Imprimir IVA
                                </Button>
                                <Button variant="ghost" className="h-10 rounded-none bg-primary/[0.03] hover:bg-primary/10 text-[10px] font-black uppercase text-primary gap-2" onClick={() => handleDownload(record, 'retention' in record ? 'retention' : 'iva')}>
                                  <Download className="h-3.5 w-3.5" /> Descargar PDF
                                </Button>
                              </div>
                            )}

                            {/* ISLR Button (Only for Expenses) */}
                            {record.islr_retention_number && (
                              <div className="group/btn flex flex-col bg-background border border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                                <Button variant="ghost" className="h-12 rounded-none border-b border-white/5 font-bold gap-2 text-xs text-amber-600" onClick={() => handlePrint(record, 'islr')}>
                                  <ShieldCheck className="h-4 w-4" /> Comprobante ISLR
                                </Button>
                                <Button variant="ghost" className="h-10 rounded-none bg-amber-500/[0.03] hover:bg-amber-500/10 text-[10px] font-black uppercase text-amber-600 gap-2" onClick={() => handleDownload(record, 'islr')}>
                                  <Download className="h-3.5 w-3.5" /> Descargar PDF
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {printData && type === 'EXPENSE' && (
        <ExpensePrint 
          printMode={printMode} 
          concesionario={concesionario} 
          expenseData={printData} 
        />
      )}
      
      {printData && type !== 'EXPENSE' && (
        <FiscalNotePrint 
          printMode={printMode} 
          concesionario={concesionario} 
          noteData={printData} 
        />
      )}
    </div>
  );
}
