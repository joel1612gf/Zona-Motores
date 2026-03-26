'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { StaffMember, CierreCaja } from '@/lib/business-types';
import { Loader2, Search, Filter, Calendar, User, ChevronRight, FileDown, AlertCircle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface CashHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concesionarioId: string;
}

export function CashHistoryDialog({ open, onOpenChange, concesionarioId }: CashHistoryDialogProps) {
  const firestore = useFirestore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  
  // Filters
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-01')); // Default to start of month
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [selectedCierre, setSelectedCierre] = useState<CierreCaja | null>(null);

  useEffect(() => {
    if (open) {
      fetchStaff();
      fetchHistory();
    }
  }, [open, concesionarioId]);

  const fetchStaff = async () => {
    try {
      const q = query(collection(firestore, 'concesionarios', concesionarioId, 'staff'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));
      setStaffList(data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const start = startOfDay(parseISO(startDate));
      const end = endOfDay(parseISO(endDate));
      
      let q = query(
        collection(firestore, 'concesionarios', concesionarioId, 'cierres_caja'),
        where('fecha', '>=', Timestamp.fromDate(start)),
        where('fecha', '<=', Timestamp.fromDate(end)),
        orderBy('fecha', 'desc')
      );

      const snap = await getDocs(q);
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CierreCaja));
      
      // Client-side filter for staff if needed (Firestore composite index might be missing)
      if (selectedStaffId !== 'all') {
        data = data.filter(c => c.cajero_staff_id === selectedStaffId);
      }
      
      setCierres(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Aggregates
  const summary = useMemo(() => {
    return cierres.reduce((acc, c) => ({
      totalManual: acc.totalManual + c.total_manual,
      totalSistema: acc.totalSistema + c.total_sistema,
      totalDiferencia: acc.totalDiferencia + c.total_diferencia,
    }), { totalManual: 0, totalSistema: 0, totalDiferencia: 0 });
  }, [cierres]);

  const formatDateTime = (ts: Timestamp) => {
    return format(ts.toDate(), "d 'de' MMMM, HH:mm", { locale: es });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            Histórico de Cierres de Caja
          </DialogTitle>
          <DialogDescription>
            Consulta y audita los cierres realizados por el personal.
          </DialogDescription>
        </DialogHeader>

        {/* Filters Bar */}
        <div className="p-6 pt-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 border-y mt-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Cajero</Label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Todos los cajeros" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los cajeros</SelectItem>
                {staffList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Desde</Label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground font-bold">Hasta</Label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-full"
            />
          </div>

          <div className="flex items-end">
            <Button onClick={fetchHistory} className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4 mr-2" />}
              Filtrar Resultados
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Buscando registros...</p>
            </div>
          ) : cierres.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-semibold">No se encontraron cierres</p>
                <p className="text-sm text-muted-foreground">Ajusta los filtros para ver otros resultados.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground font-bold uppercase text-[10px] tracking-wider border-b">
                    <tr>
                      <th className="px-4 py-3">Fecha y Hora</th>
                      <th className="px-4 py-3">Cajero</th>
                      <th className="px-4 py-3 text-right">Declarado</th>
                      <th className="px-4 py-3 text-right">Sistema</th>
                      <th className="px-4 py-3 text-right">Diferencia</th>
                      <th className="px-4 py-3 whitespace-nowrap"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cierres.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {formatDateTime(c.fecha)}
                          <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold">
                            #{c.numero_cierre}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{c.cajero_nombre}</div>
                          <div className="text-[10px] text-muted-foreground">ID: {c.cajero_staff_id.slice(-6)}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(c.total_manual)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatCurrency(c.total_sistema)}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right font-bold",
                          Math.abs(c.total_diferencia) < 0.01 ? "text-muted-foreground" : c.total_diferencia > 0 ? "text-green-600" : "text-destructive"
                        )}>
                          {c.total_diferencia > 0 ? '+' : ''}{formatCurrency(c.total_diferencia)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedCierre(c)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Detalles
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {cierres.length > 0 && !isLoading && (
          <div className="p-6 bg-primary/[0.03] border-t grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Total Declarado (Contado)</p>
              <p className="text-2xl font-bold font-headline">{formatCurrency(summary.totalManual)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Total Esperado (Sistema)</p>
              <p className="text-2xl font-bold font-headline text-muted-foreground">{formatCurrency(summary.totalSistema)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Diferencia Acumulada</p>
              <p className={cn(
                "text-2xl font-bold font-headline",
                summary.totalDiferencia >= 0 ? "text-green-600" : "text-destructive"
              )}>
                {summary.totalDiferencia > 0 ? '+' : ''}{formatCurrency(summary.totalDiferencia)}
              </p>
            </div>
          </div>
        )}

        {/* Detailed View Modal (Nested or separate dialog) */}
        <Dialog open={!!selectedCierre} onOpenChange={(open) => !open && setSelectedCierre(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-headline">Detalle de Cierre #{selectedCierre?.numero_cierre}</DialogTitle>
              <DialogDescription>
                Realizado por {selectedCierre?.cajero_nombre} el {selectedCierre && formatDateTime(selectedCierre.fecha)}.
              </DialogDescription>
            </DialogHeader>
            {selectedCierre && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Método</th>
                        <th className="px-4 py-2 text-right">Contado</th>
                        <th className="px-4 py-2 text-right">Sistema</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.keys(selectedCierre.sistema_esperado).map(m => (
                        <tr key={m}>
                          <td className="px-4 py-2 font-medium">{m}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(selectedCierre.conteo_manual[m] || 0)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(selectedCierre.sistema_esperado[m] || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground uppercase font-bold">
                    <span>Aprobado por:</span>
                    <span>Fecha Aprobación:</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{selectedCierre.aprobado_por_nombre}</span>
                    <span>{selectedCierre.aprobado_at ? formatDateTime(selectedCierre.aprobado_at) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
               <Button variant="outline" className="gap-2">
                 <FileDown className="h-4 w-4" />
                 Exportar PDF
               </Button>
               <Button onClick={() => setSelectedCierre(null)}>Cerrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
