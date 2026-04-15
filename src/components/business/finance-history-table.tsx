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
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useBusinessAuth } from '@/context/business-auth-context';
import { Input } from '@/components/ui/input';
import { FiscalNotePrint } from './fiscal-note-print';
import { ExpensePrint } from './expense-print';
import { downloadPdf } from '@/lib/download-pdf';

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
  const [pageSize, setPageSize] = useState(50);

  // Query logic with smart loading
  const historyQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    
    let baseRef = type === 'EXPENSE' 
      ? collection(firestore, 'concesionarios', concesionario.id, 'gastos')
      : collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales');

    // If searching, we expand the limit to find matches across more records
    const searchLimit = searchTerm.trim().length > 0 ? 500 : pageSize;

    if (type === 'EXPENSE') {
      return query(baseRef, orderBy('created_at', 'desc'), limit(searchLimit));
    } else {
      return query(baseRef, where('type', '==', type), orderBy('created_at', 'desc'), limit(searchLimit));
    }
  }, [concesionario, type, firestore, pageSize, searchTerm]);

  const { data: records, isLoading } = useCollection<any>(historyQuery);

  const filteredRecords = records?.filter(r => 
    r.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  /** Enrich the record with missing data (dates, provider address) */
  const enrichRecord = async (record: any) => {
    const loadedRecord = { ...record };

    if (!loadedRecord.date && record.created_at?.toDate) {
      loadedRecord.date = record.created_at.toDate().toISOString().split('T')[0];
    }
    if (!loadedRecord.invoice_date && loadedRecord.date) {
      loadedRecord.invoice_date = loadedRecord.date;
    }

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

    return loadedRecord;
  };

  const handlePrint = async (record: any, mode: string) => {
    const loadedRecord = await enrichRecord(record);
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
    const loadedRecord = await enrichRecord(record);
    setPrintData(loadedRecord);
    setPrintMode(mode);

    // Build filename
    let filename: string;
    if (mode === 'iva' || mode === 'retention') {
      filename = `Retencion_IVA_${loadedRecord.iva_retention_number || 'S_N'}.pdf`;
    } else if (mode === 'islr') {
      filename = `Retencion_ISLR_${loadedRecord.islr_retention_number || 'S_N'}.pdf`;
    } else {
      filename = `${type === 'EXPENSE' ? 'Gasto' : 'Nota'}_Resumen_${loadedRecord.invoice_number || 'S_N'}.pdf`;
    }

    const elementId = type === 'EXPENSE' ? 'expense-print-root' : 'fiscal-note-print-root';

    // Wait for React to commit the portal
    await new Promise(r => setTimeout(r, 400));

    await downloadPdf({ elementId, filename });
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
          placeholder="Buscar por proveedor o factura..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 h-14 rounded-2xl bg-background/40 border-muted-foreground/10 focus:bg-background/80 focus:ring-2 focus:ring-primary/20 transition-all text-base shadow-inner"
        />
      </div>

      {filteredRecords.length === 0 ? (
        <div className="h-60 flex flex-col items-center justify-center opacity-30 bg-card/30 rounded-[2.5rem] border border-dashed">
          <div className="p-6 bg-muted rounded-full mb-4"><FileText className="h-12 w-12" /></div>
          <p className="font-bold text-sm uppercase tracking-widest">No hay registros para mostrar</p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block rounded-[2.5rem] border bg-card/30 overflow-hidden backdrop-blur-md shadow-2xl ring-1 ring-white/10">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-white/5">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 px-4">Fecha</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Proveedor / RIF</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Referencia</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total Operación</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center px-6">Registrado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
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
                        <p className="text-[10px] text-muted-foreground/60 font-medium tracking-tight mt-0.5">RIF: {record.provider_rif || '—'}</p>
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
                        <div className="flex flex-col items-center">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg">
                            {record.creado_por || 'Sistema'}
                          </Badge>
                          {record.created_at?.toDate && (
                            <span className="text-[9px] text-muted-foreground mt-1 font-medium italic">
                              {record.created_at.toDate().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedRow === record.id && (
                      <TableRow className="bg-primary/[0.04] border-none animate-in slide-in-from-top-2 duration-300">
                        <TableCell colSpan={6} className="p-8 px-12">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="space-y-4 lg:col-span-1">
                              <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <FileText className="h-3 w-3" /> Detalles de la Operación
                              </h4>
                              <div className="p-5 bg-background/60 rounded-[1.5rem] border border-white/10 shadow-sm ring-1 ring-black/5">
                                <p className="text-sm font-medium text-foreground/80 leading-relaxed italic">
                                  "{record.reason || record.description || 'Sin descripción detallada'}"
                                </p>
                              </div>
                            </div>

                            <div className="lg:col-span-2 space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Printer className="h-3 w-3" /> Gestión de Documentos
                              </h4>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="group/btn flex flex-col bg-background border border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                                  <Button variant="ghost" className="h-12 rounded-none border-b border-white/5 font-bold gap-2 text-xs" onClick={() => handlePrint(record, 'summary')}>
                                    <FileCheck className="h-4 w-4 text-primary" /> Resumen
                                  </Button>
                                  <Button variant="ghost" className="h-10 rounded-none bg-primary/[0.03] hover:bg-primary/10 text-[10px] font-black uppercase text-primary gap-2" onClick={() => handleDownload(record, 'summary')}>
                                    <Download className="h-3.5 w-3.5" /> Descargar PDF
                                  </Button>
                                </div>

                                {record.iva_retention_number && (
                                  <div className="group/btn flex flex-col bg-background border border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all ring-1 ring-black/5">
                                    <Button variant="ghost" className="h-12 rounded-none border-b border-white/5 font-bold gap-2 text-xs text-primary" onClick={() => handlePrint(record, 'iva')}>
                                      <ShieldCheck className="h-4 w-4" /> Imprimir IVA
                                    </Button>
                                    <Button variant="ghost" className="h-10 rounded-none bg-primary/[0.03] hover:bg-primary/10 text-[10px] font-black uppercase text-primary gap-2" onClick={() => handleDownload(record, 'iva')}>
                                      <Download className="h-3.5 w-3.5" /> Descargar PDF
                                    </Button>
                                  </div>
                                )}

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

          {/* MOBILE CARD VIEW */}
          <div className="md:hidden space-y-4">
            {filteredRecords.map((record) => {
              const isExpanded = expandedRow === record.id;
              return (
                <div 
                  key={record.id}
                  className={cn(
                    "rounded-[2rem] border bg-card/40 backdrop-blur-md transition-all duration-300 overflow-hidden",
                    isExpanded ? "ring-2 ring-primary/20 shadow-lg" : "shadow-sm border-white/10"
                  )}
                >
                  <div 
                    className="p-5 flex flex-col gap-3"
                    onClick={() => setExpandedRow(isExpanded ? null : record.id)}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                        {record.created_at?.toDate().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <div className="flex gap-1">
                        {record.iva_retention_number && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] font-black uppercase px-1.5 py-0">IVA</Badge>}
                        {record.islr_retention_number && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[8px] font-black uppercase px-1.5 py-0">ISLR</Badge>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-base leading-tight truncate">{record.provider_name}</h4>
                      <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter">RIF: {record.provider_rif || '—'}</p>
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter mt-0.5">#{record.invoice_number}</p>
                    </div>

                    <div className="flex justify-between items-end pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 bg-background/50 rounded-lg border border-white/5">
                          {type === 'EXPENSE' ? <TrendingDown className="h-3 w-3 text-red-500" /> : <ArrowUpDown className="h-3 w-3 text-primary" />}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">{type === 'EXPENSE' ? 'Gasto' : 'Nota'}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-primary leading-none">
                          {formatCurrency(record.total_amount, record.currency || 'USD')}
                        </p>
                        {record.currency === 'VES' && record.total_usd && (
                          <p className="text-[9px] text-muted-foreground font-bold italic mt-1">≈ {formatCurrency(record.total_usd, 'USD')}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-6 pt-2 space-y-5 animate-in slide-in-from-top-2 duration-300">
                      <div className="p-4 bg-background/40 rounded-2xl border border-white/5 italic">
                        <p className="text-xs text-foreground/70 leading-relaxed font-medium">
                          "{record.reason || record.description || 'Sin descripción'}"
                        </p>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Documentos Disponibles</p>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {/* Resumen Operación Group */}
                          <div className="flex bg-background/60 border border-white/10 rounded-xl overflow-hidden h-12 ring-1 ring-black/5 items-stretch shadow-sm">
                            <Button 
                              variant="ghost" 
                              className="flex-1 rounded-none border-r border-white/5 gap-2 font-bold h-full text-xs justify-start px-4"
                              onClick={(e) => { e.stopPropagation(); handlePrint(record, 'summary'); }}
                            >
                              <FileText className="h-4 w-4 text-primary" /> Resumen Operación
                            </Button>
                            <Button 
                              variant="ghost" 
                              className="px-4 h-full hover:bg-primary/5 group/dl"
                              onClick={(e) => { e.stopPropagation(); handleDownload(record, 'summary'); }}
                              title="Descargar PDF"
                            >
                              <Download className="h-4 w-4 text-primary transition-transform group-active/dl:scale-90" />
                            </Button>
                          </div>

                          {/* IVA Group */}
                          {record.iva_retention_number && (
                            <div className="flex bg-primary/5 border border-primary/10 rounded-xl overflow-hidden h-12 ring-1 ring-black/5 items-stretch shadow-sm">
                              <Button 
                                variant="ghost" 
                                className="flex-1 rounded-none border-r border-primary/10 gap-2 font-bold h-full text-xs text-primary justify-start px-4"
                                onClick={(e) => { e.stopPropagation(); handlePrint(record, 'iva'); }}
                              >
                                <ShieldCheck className="h-4 w-4" /> Retención IVA
                              </Button>
                              <Button 
                                variant="ghost" 
                                className="px-4 h-full hover:bg-primary/10 group/dl"
                                onClick={(e) => { e.stopPropagation(); handleDownload(record, 'iva'); }}
                                title="Descargar PDF"
                              >
                                <Download className="h-4 w-4 text-primary transition-transform group-active/dl:scale-90" />
                              </Button>
                            </div>
                          )}

                          {/* ISLR Group */}
                          {record.islr_retention_number && (
                            <div className="flex bg-amber-500/5 border border-amber-500/10 rounded-xl overflow-hidden h-12 ring-1 ring-black/5 items-stretch shadow-sm">
                              <Button 
                                variant="ghost" 
                                className="flex-1 rounded-none border-r border-amber-500/10 gap-2 font-bold h-full text-xs text-amber-600 justify-start px-4"
                                onClick={(e) => { e.stopPropagation(); handlePrint(record, 'islr'); }}
                              >
                                <ShieldCheck className="h-4 w-4" /> Comprobante ISLR
                              </Button>
                              <Button 
                                variant="ghost" 
                                className="px-4 h-full hover:bg-amber-500/10 group/dl"
                                onClick={(e) => { e.stopPropagation(); handleDownload(record, 'islr'); }}
                                title="Descargar PDF"
                              >
                                <Download className="h-4 w-4 text-amber-600 transition-transform group-active/dl:scale-90" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {filteredRecords.length >= pageSize && !searchTerm && (
        <div className="py-8 flex justify-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setPageSize(prev => prev + 50)}
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 gap-2"
          >
            <ChevronDown className="h-4 w-4" /> Cargar más registros
          </Button>
        </div>
      )}

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
