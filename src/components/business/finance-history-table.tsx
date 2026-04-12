'use client';

import React, { useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Printer, Download, FileText, Search, AlertCircle, ArrowUpDown, Receipt, TrendingDown 
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useBusinessAuth } from '@/context/business-auth-context';
import { Input } from '@/components/ui/input';
import { FiscalNotePrint } from './fiscal-note-print';

interface FinanceHistoryTableProps {
  type: 'EXPENSE' | 'DEBIT' | 'CREDIT';
}

export function FinanceHistoryTable({ type }: FinanceHistoryTableProps) {
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [printData, setPrintData] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'summary' | 'retention'>('summary');

  // Query logic based on type
  const historyQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    
    if (type === 'EXPENSE') {
      return query(
        collection(firestore, 'concesionarios', concesionario.id, 'gastos'),
        orderBy('created_at', 'desc')
      );
    } else {
      return query(
        collection(firestore, 'concesionarios', concesionario.id, 'notas_fiscales'),
        where('type', '==', type),
        orderBy('created_at', 'desc')
      );
    }
  }, [concesionario, type, firestore]);

  const { data: records, isLoading } = useCollection<any>(historyQuery);

  const filteredRecords = records?.filter(r => 
    r.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAction = (record: any, mode: 'summary' | 'retention') => {
    setPrintData(record);
    setPrintMode(mode);
    setTimeout(() => {
      const element = document.getElementById('fiscal-history-print-root');
      if (element) {
        element.style.display = 'block';
        window.print();
        element.style.display = 'none';
      }
    }, 250);
  };

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Cargando registros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por proveedor o factura..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-11 h-12 rounded-2xl bg-background/50 border-muted-foreground/20 focus:bg-background transition-all"
        />
      </div>

      <div className="rounded-[2rem] border bg-background/30 overflow-hidden backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-b-muted-foreground/10">
              <TableHead className="text-[10px] font-black uppercase tracking-tighter py-5 px-6">Fecha</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tighter">Proveedor</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tighter">Documento</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tighter text-right">Monto Total</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tighter text-center">Retención</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tighter text-right px-6">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center opacity-40">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-10 w-10" />
                    <p className="font-bold text-xs uppercase tracking-widest">No se encontraron registros</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredRecords.map((record) => (
              <TableRow key={record.id} className="group hover:bg-primary/[0.02] transition-colors border-b-muted-foreground/5">
                <TableCell className="px-6 py-4 font-medium text-xs">
                  {record.created_at?.toDate().toLocaleDateString('es-VE')}
                </TableCell>
                <TableCell>
                  <p className="font-bold text-sm leading-tight">{record.provider_name}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase">{record.provider_rif || record.provider_id}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {type === 'EXPENSE' ? <TrendingDown className="h-3 w-3 text-red-500" /> : <ArrowUpDown className="h-3 w-3 text-primary" />}
                    <span className="font-mono text-xs font-bold">#{record.invoice_number}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold truncate max-w-[150px]">{record.reason || record.description}</p>
                </TableCell>
                <TableCell className="text-right">
                  <p className="font-bold text-sm text-primary">
                    {formatCurrency(record.total_amount, record.currency || 'USD')}
                  </p>
                  {record.currency === 'VES' && record.total_usd && (
                    <p className="text-[10px] text-muted-foreground">≈ {formatCurrency(record.total_usd, 'USD')}</p>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {record.iva_retention_number ? (
                    <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-black text-[9px] uppercase px-2 py-0.5">
                      {record.iva_retention_number}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">N/A</span>
                  )}
                </TableCell>
                <TableCell className="text-right px-6">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleAction(record, 'summary')}
                      className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                      title="Imprimir Resumen"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    {record.iva_retention_number && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleAction(record, 'retention')}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600"
                        title="Imprimir Retención"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {printData && (
        <FiscalNotePrint 
          rootId="fiscal-history-print-root"
          printMode={printMode} 
          concesionario={concesionario} 
          noteData={printData} 
        />
      )}
    </div>
  );
}
