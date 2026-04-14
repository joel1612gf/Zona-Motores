'use client';

import { useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid 
} from 'recharts';
import { 
  User, 
  Calendar, 
  TrendingUp, 
  Briefcase, 
  DollarSign, 
  PieChart,
  Car,
  X
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { StaffMember, Venta } from '@/lib/business-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StaffCommissionModalProps {
  staffMember: StaffMember;
  sales: Venta[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bcvRate: number;
  monthLabel: string;
  year: number;
  defaultCommissionPercentage?: number;
}

export function StaffCommissionModal({ 
  staffMember, 
  sales, 
  open, 
  onOpenChange, 
  bcvRate,
  monthLabel,
  year,
  defaultCommissionPercentage = 0
}: StaffCommissionModalProps) {
  
  const stats = useMemo(() => {
    let totalSalesVolume = 0;
    let totalNetProfit = 0;
    let earnedCommission = 0;

    sales.forEach(sale => {
      totalSalesVolume += (sale.precio_venta || 0);
      totalNetProfit += (sale.ganancia_neta || 0);

      const commType = staffMember.commission_type || 'total_price';
      const commPercentage = staffMember.commission_percentage ?? defaultCommissionPercentage;

      if (commType === 'total_price') {
        earnedCommission += ((sale.precio_venta || 0) * commPercentage) / 100;
      } else {
        earnedCommission += ((sale.ganancia_neta || 0) * commPercentage) / 100;
      }
    });

    return {
      totalSalesVolume,
      totalNetProfit,
      earnedCommission,
      salesCount: sales.length
    };
  }, [sales, staffMember, defaultCommissionPercentage]);

  const chartData = useMemo(() => {
    const days: Record<number, number> = {};
    sales.forEach(sale => {
      if (sale.fecha) {
        const day = sale.fecha.toDate().getDate();
        days[day] = (days[day] || 0) + (sale.precio_venta || 0);
      }
    });

    return Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      monto: days[i + 1] || 0
    }));
  }, [sales]);

  const formatBs = (usd: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
    }).format(usd * (bcvRate || 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-4xl h-[85dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden bg-white border-none sm:border-slate-200 shadow-2xl p-0 flex flex-col gap-0 rounded-3xl sm:rounded-3xl">

        {/* Header - Fixed & Premium */}
        <div className="shrink-0 bg-white border-b border-slate-100 p-4 md:p-6 text-slate-900 sticky top-0 z-20">
          <div className="flex items-start justify-between mb-4 md:hidden">
             <button 
               className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 active:scale-95 transition-all" 
               onClick={() => onOpenChange(false)}
               aria-label="Cerrar"
             >
                <X className="h-5 w-5 text-slate-600" />
             </button>
             <Badge className="bg-primary text-white border-none font-black text-[10px] uppercase px-3">
                {staffMember.commission_type === 'net_profit' ? 'Utilidad Neta' : 'Volumen Total'}
             </Badge>
          </div>

          <DialogHeader>
            <div className="flex items-center gap-4 text-left">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {staffMember.foto_url ? (
                  <img src={staffMember.foto_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-7 w-7 md:h-10 md:w-10 text-primary/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl md:text-3xl font-black font-headline text-slate-900 truncate tracking-tight">
                  {staffMember.nombre}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground flex items-center gap-2 text-xs md:text-base font-bold mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> 
                  <span className="uppercase tracking-widest">{monthLabel} {year}</span>
                </DialogDescription>
              </div>
              
              <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
                <Badge className="bg-primary text-white border-none shadow-md shadow-primary/20 px-3 py-1 text-xs">
                  {staffMember.commission_type === 'net_profit' ? 'Esquema: Utilidad Neta' : 'Esquema: Volumen Total'}
                </Badge>
                <span className="text-sm text-slate-500 font-black uppercase tracking-tighter">
                  {staffMember.commission_percentage ?? defaultCommissionPercentage}% Comisión Directa
                </span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-50/50">
          
          {/* Stats Grid - 2x2 on Mobile */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {[
              { label: 'Unidades', val: stats.salesCount, color: 'text-slate-900', icon: Car, iconColor: 'text-blue-500' },
              { label: 'Volumen', val: formatCurrency(stats.totalSalesVolume), color: 'text-slate-900', icon: Briefcase, iconColor: 'text-indigo-500' },
              { label: 'Utilidad', val: formatCurrency(stats.totalNetProfit), color: 'text-slate-900', icon: TrendingUp, iconColor: 'text-emerald-500' },
              { label: 'Comisión', val: formatCurrency(stats.earnedCommission), color: 'text-primary', icon: DollarSign, iconColor: 'text-primary', sub: `≈ ${formatBs(stats.earnedCommission)}`, highlight: true }
            ].map((s, i) => (
              <div key={i} className={cn(
                "p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-center text-left",
                s.highlight && "ring-2 ring-primary/10 bg-primary/5 border-primary/10"
              )}>
                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-1.5 mb-2 leading-none">
                  <s.icon className={cn("h-3 w-3", s.iconColor)} /> {s.label}
                </span>
                <div className={cn("text-lg md:text-2xl font-black leading-tight", s.color)}>{s.val}</div>
                {s.sub && <div className="text-[9px] font-bold text-primary/70 mt-1 truncate">{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Chart Section */}
          <div className="bg-white rounded-2xl p-5 md:p-8 shadow-sm border border-slate-100">
            <h3 className="text-xs md:text-sm font-black text-slate-900 flex items-center gap-2 mb-6 uppercase tracking-widest text-left">
              <PieChart className="h-4 w-4 text-primary" /> Tendencia del Mes
            </h3>
            <div className="h-[220px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2463eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2463eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" hide />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ color: '#2463eb', fontWeight: '900', fontSize: '14px' }}
                    formatter={(val: number) => [formatCurrency(val), '']}
                    labelFormatter={(label) => `Día ${label}`}
                  />
                  <Area type="monotone" dataKey="monto" stroke="#2463eb" strokeWidth={3} fillOpacity={1} fill="url(#colorMonto)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Section */}
          <div className="space-y-4">
            <h3 className="text-xs md:text-sm font-black text-slate-900 flex items-center gap-2 px-1 uppercase tracking-widest text-left">
              <Calendar className="h-4 w-4 text-primary" /> Historial de Operaciones
            </h3>
            
            {/* Desktop Table */}
            <div className="hidden md:block rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm text-left">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="text-slate-400 text-[10px] uppercase font-black tracking-widest px-6 py-4">Fecha</TableHead>
                    <TableHead className="text-slate-400 text-[10px] uppercase font-black tracking-widest px-6 py-4">Vehículo</TableHead>
                    <TableHead className="text-slate-400 text-[10px] uppercase font-black tracking-widest text-right px-6 py-4">Venta</TableHead>
                    <TableHead className="text-slate-400 text-[10px] uppercase font-black tracking-widest text-right px-6 py-4">Comisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length > 0 ? sales.map((sale) => {
                    const commType = staffMember.commission_type || 'total_price';
                    const commPercentage = staffMember.commission_percentage ?? defaultCommissionPercentage;
                    const saleComm = commType === 'total_price' ? ((sale.precio_venta || 0) * commPercentage) / 100 : ((sale.ganancia_neta || 0) * commPercentage) / 100;
                    return (
                      <TableRow key={sale.id} className="border-slate-50 hover:bg-slate-50 transition-colors group">
                        <TableCell className="px-6 py-4 text-sm font-bold text-slate-600">{sale.fecha?.toDate().toLocaleDateString() || '—'}</TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="font-bold text-slate-900 leading-tight">{sale.vehiculo_nombre}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase tracking-tighter">{sale.numero_factura_venta || 'SIN FACTURA'}</div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right text-sm font-bold text-slate-700">{formatCurrency(sale.precio_venta || 0)}</TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <span className="bg-primary/5 text-primary px-3 py-1 rounded-lg text-sm font-black">{formatCurrency(saleComm)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 text-sm italic">Sin registros.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3 pb-8">
              {sales.length > 0 ? sales.map((sale) => {
                const commType = staffMember.commission_type || 'total_price';
                const commPercentage = staffMember.commission_percentage ?? defaultCommissionPercentage;
                const saleComm = commType === 'total_price' ? ((sale.precio_venta || 0) * commPercentage) / 100 : ((sale.ganancia_neta || 0) * commPercentage) / 100;
                return (
                  <div key={sale.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 text-left">
                    <div className="flex justify-between items-start">
                      <div className="text-left space-y-0.5">
                        <div className="text-[10px] text-primary font-black uppercase tracking-tighter">{sale.fecha?.toDate().toLocaleDateString() || 'N/A'}</div>
                        <div className="text-sm font-bold text-slate-900 leading-tight">{sale.vehiculo_nombre}</div>
                      </div>
                      <div className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-[9px] font-mono text-slate-500">#{sale.numero_factura_venta || 'S/F'}</div>
                    </div>
                    <div className="flex justify-between items-end pt-2 border-t border-slate-50">
                      <div className="text-left"><span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5 leading-none">Venta</span><span className="text-sm font-bold text-slate-700">{formatCurrency(sale.precio_venta || 0)}</span></div>
                      <div className="text-right"><span className="text-[9px] text-primary uppercase font-black block mb-0.5 leading-none">Mi Ganancia</span><span className="text-base font-black text-primary">{formatCurrency(saleComm)}</span></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs italic">Sin operaciones este mes.</div>
              )}
            </div>
          </div>
          
          {/* Visual Bottom Safe Area */}
          <div className="h-16 w-full md:hidden flex items-center justify-center">
            <div className="w-12 h-1 bg-slate-200 rounded-full opacity-50" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
