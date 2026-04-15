'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useCurrency } from '@/context/currency-context';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aggregateFinancialStats } from '@/lib/reports-utils';
import { calculateFiscalBreakdown, formatVes } from '@/lib/fiscal-helpers';
import { formatCurrency } from '@/lib/utils';
import { ReportsFiscalPrint } from '@/components/business/reports-fiscal-print';
import { downloadPdf } from '@/lib/download-pdf';
import {
  BarChart3, Wallet, CarFront, FileText, Download, TrendingUp,
  ArrowUpRight, Calculator, Calendar, Layers, PieChart, ChevronRight,
  Info, DollarSign, Printer, Clock, FilterX
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Venta, StockVehicle, StaffMember, RegistroCaja } from '@/lib/business-types';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays, eachMonthOfInterval, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReportsPage() {
  const { slug } = useParams();
  const firestore = useFirestore();
  const { concesionario, isLoading: authLoading } = useBusinessAuth();
  const { bcvRate: globalBcvRate } = useCurrency();

  // --- PERIOD SELECTION ---
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));

  // --- INVENTORY STATES ---
  const [agingFilter, setAgingFilter] = useState<string | null>(null);
  const [sortByAging, setSortByAging] = useState(false);

  // Available months (last 12)
  const availableMonths = useMemo(() => {
    return eachMonthOfInterval({
      start: subMonths(new Date(), 11),
      end: new Date(),
    }).reverse();
  }, []);

  const monthStart = Timestamp.fromDate(startOfMonth(selectedDate));
  const monthEnd = Timestamp.fromDate(endOfMonth(selectedDate));

  // --- BCV RATE LOGIC ---
  const bcvRate = useMemo(() => {
    if (concesionario?.configuracion?.tasa_cambio_manual && concesionario.configuracion.tasa_cambio_manual > 1) {
      return concesionario.configuracion.tasa_cambio_manual;
    }
    return globalBcvRate || 60.00; // Fallback to context or common rate
  }, [concesionario, globalBcvRate]);

  // --- QUERIES ---
  const salesQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      where('fecha', '>=', monthStart),
      where('fecha', '<=', monthEnd),
      orderBy('fecha', 'desc')
    );
  }, [concesionario, firestore, selectedDate]);

  const cashQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'caja'),
      where('fecha', '>=', monthStart),
      where('fecha', '<=', monthEnd),
      orderBy('fecha', 'desc')
    );
  }, [concesionario, firestore, selectedDate]);

  const vehiclesQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'inventario'),
      where('estado_stock', '!=', 'vendido')
    );
  }, [concesionario, firestore]);

  const staffQuery = useMemoFirebase(() => {
    if (!concesionario) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'staff'),
      where('activo', '==', true)
    );
  }, [concesionario, firestore]);

  const { data: sales, isLoading: salesLoading } = useCollection<Venta>(salesQuery);
  const { data: vehicles, isLoading: vehiclesLoading } = useCollection<StockVehicle>(vehiclesQuery);
  const { data: staffData, isLoading: staffLoading } = useCollection<StaffMember>(staffQuery);
  const { data: cashFlow, isLoading: cashLoading } = useCollection<RegistroCaja>(cashQuery);

  const stats = useMemo(() => {
    if (!sales || !vehicles || !staffData || !cashFlow) return null;
    return aggregateFinancialStats(sales, vehicles, staffData, cashFlow);
  }, [sales, vehicles, staffData, cashFlow]);

  // --- CHART LOGIC (Grouped by Week of selected month) ---
  const chartData = useMemo(() => {
    if (!sales && !cashFlow) return [];

    // Create 4 points representing the month
    const points = [1, 2, 3, 4].map(week => {
      const day = week * 7;
      const pointDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      return {
        name: `Semana ${week}`,
        balance: 0,
        fullDate: pointDate
      };
    });

    sales?.forEach(s => {
      const sDate = s.fecha?.toDate();
      if (!sDate) return;
      const weekIndex = Math.min(Math.floor((sDate.getDate() - 1) / 7), 3);
      points[weekIndex].balance += (s.precio_venta || 0);
    });

    cashFlow?.forEach(c => {
      const cDate = c.fecha?.toDate();
      if (!cDate) return;
      const weekIndex = Math.min(Math.floor((cDate.getDate() - 1) / 7), 3);
      points[weekIndex].balance += (c.tipo === 'ingreso' ? c.monto : -c.monto);
    });

    return points;
  }, [sales, cashFlow, selectedDate]);

  // --- HANDLERS ---
  const handleExportCSV = () => {
    const headers = ['Factura', 'Control', 'Fecha', 'Cliente', 'Monto Base', 'IVA', 'IGTF', 'Total', 'Metodo'];
    const rows = (sales || []).map(s => {
      const fiscal = calculateFiscalBreakdown(s.precio_venta, s.metodo_pago, concesionario?.configuracion?.vehiculos_exentos_iva);
      return [
        s.numero_factura_venta || '-',
        s.numero_control_venta || '-',
        s.fecha?.toDate().toLocaleDateString() || '-',
        s.comprador_nombre,
        fiscal.baseAmount,
        fiscal.taxIVA,
        fiscal.taxIGTF,
        fiscal.totalAmount,
        s.metodo_pago
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `REPORTE_FISCAL_${format(selectedDate, 'MMMM_yyyy').toUpperCase()}.csv`);
    link.click();
  };

  const handlePrintPDF = async () => {
    const filename = `LIBRO_VENTAS_${format(selectedDate, 'MMMM_yyyy').toUpperCase()}.pdf`;
    await downloadPdf({ elementId: 'fiscal-print-root', filename });
  };

  const processedVehicles = useMemo(() => {
    if (!vehicles) return [];
    const now = new Date();
    let filtered = [...vehicles];
    if (agingFilter) {
      filtered = filtered.filter(v => {
        const entryDate = v.created_at?.toDate() || now;
        const days = differenceInDays(now, entryDate);
        if (agingFilter === 'new') return days <= 30;
        if (agingFilter === 'medium') return days > 30 && days <= 60;
        if (agingFilter === 'old') return days > 60 && days <= 90;
        if (agingFilter === 'critical') return days > 90;
        return true;
      });
    }
    if (sortByAging) {
      filtered.sort((a, b) => (a.created_at?.toDate() || now).getTime() - (b.created_at?.toDate() || now).getTime());
    } else {
      filtered.sort((a, b) => {
        const costA = (a.costo_compra || 0) + (a.gastos_adecuacion?.reduce((s, g) => s + g.monto, 0) || 0);
        const costB = (b.costo_compra || 0) + (b.gastos_adecuacion?.reduce((s, g) => s + g.monto, 0) || 0);
        return costB - costA;
      });
    }
    return filtered;
  }, [vehicles, agingFilter, sortByAging]);

  if (authLoading || salesLoading || vehiclesLoading || staffLoading || cashLoading) {
    return (
      <div className="p-20 text-center flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Sincronizando Periodo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
      <ReportsFiscalPrint
        sales={sales || []}
        concesionario={concesionario}
        period={format(selectedDate, 'MMMM yyyy', { locale: es })}
      />

      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-1 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <PieChart className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Reportes y análisis</h1>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            Panel de <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-px rounded-2xl border bg-background shadow-sm overflow-hidden backdrop-blur-sm w-full sm:w-auto">
          <div className="px-5 py-3 bg-muted/50 flex flex-col justify-center border-b sm:border-b-0 sm:border-r min-w-0 sm:min-w-[140px]">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Tasa de Cambio</p>
            <p className="text-sm font-bold font-headline text-primary">{formatCurrency(bcvRate, 'VES')}</p>
          </div>

          <div className="relative group min-w-0 sm:min-w-[220px] flex-1">
            <Select
              value={selectedDate.toISOString()}
              onValueChange={(val) => setSelectedDate(new Date(val))}
            >
              <SelectTrigger className="h-full border-none rounded-none px-5 py-3 bg-card hover:bg-muted/30 transition-colors focus:ring-0 w-full">
                <div className="text-left">
                  <p className="text-[10px] uppercase font-black text-primary tracking-widest mb-1 flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" /> Periodo Seleccionado
                  </p>
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border shadow-2xl">
                {availableMonths.map((month) => (
                  <SelectItem
                    key={month.toISOString()}
                    value={month.toISOString()}
                    className="font-bold text-xs uppercase tracking-tight py-3 cursor-pointer"
                  >
                    {format(month, 'MMMM yyyy', { locale: es })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        <ModernKPICard title="Patrimonio en Patio" value={formatCurrency(stats?.inventoryValue || 0, 'USD')} description="Valor actual de activos" icon={CarFront} variant="primary" trend="Tiempo Real" />
        <ModernKPICard title={`Flujo ${format(selectedDate, 'MMM')}`} value={formatCurrency(stats?.balance.netBalance || 0, 'USD')} description="Utilidad neta periodo" icon={Wallet} variant={(stats?.balance.netBalance || 0) >= 0 ? "success" : "danger"} progress={stats?.balance.coverageRatio} />
        <ModernKPICard title={`Comisiones ${format(selectedDate, 'MMM')}`} value={formatCurrency(stats?.totalCommissions || 0, 'USD')} description="Total incentivos periodo" icon={TrendingUp} variant="warning" trend="Corte Mensual" />
      </div>

      <Tabs defaultValue="finance" className="w-full relative z-10">
        <TabsList className="bg-transparent h-auto p-0 gap-4 sm:gap-8 justify-start border-b w-full rounded-none mb-8 flex-wrap">
          <ModernTabTrigger value="finance" label="Finanzas" icon={Calculator} />
          <ModernTabTrigger value="inventory" label="Inventario" icon={Layers} />
          <ModernTabTrigger value="fiscal" label="Fiscal (SENIAT)" icon={FileText} />
        </TabsList>

        <TabsContent value="finance" className="space-y-6 outline-none mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3 border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden">
              <CardHeader className="bg-muted/30 pb-6 border-b">
                <CardTitle className="text-xl font-headline flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Obligaciones de {format(selectedDate, 'MMMM', { locale: es })}</CardTitle>
              </CardHeader>
              <CardContent className="pt-8 space-y-4">
                <ReportRow label="Nómina Base" amount={stats?.basePayroll || 0} hint="Sueldos fijos mensuales" />
                <ReportRow label="Comisiones Acumuladas" amount={stats?.totalCommissions || 0} hint="Por ventas cerradas en el mes" highlight="amber" />
                <div className="pt-8 mt-4 border-t border-dashed flex flex-col sm:flex-row justify-between items-end gap-4">
                  <div>
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Compromisos</p>
                    <p className="text-4xl font-bold font-headline">{formatCurrency((stats?.basePayroll || 0) + (stats?.totalCommissions || 0), 'USD')}</p>
                  </div>
                  <div className="bg-primary/[0.03] p-4 rounded-2xl border border-primary/10 text-right">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Contravalor BCV</p>
                    <p className="text-xl font-bold font-headline text-primary">{formatVes((stats?.basePayroll || 0) + (stats?.totalCommissions || 0), bcvRate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base font-headline flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Tendencia de Ingresos</CardTitle>
                <CardDescription>Distribución mensual aproximada</CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} dy={10} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      formatter={(val: any) => [formatCurrency(val, 'USD'), 'Ingresos']}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-8 outline-none mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AgingPill label="0-30 Días" count={stats?.aging.new || 0} description="Nivel Óptimo" isActive={agingFilter === 'new'} onClick={() => setAgingFilter(agingFilter === 'new' ? null : 'new')} />
            <AgingPill label="31-60 Días" count={stats?.aging.medium || 0} description="Rotación Normal" isActive={agingFilter === 'medium'} onClick={() => setAgingFilter(agingFilter === 'medium' ? null : 'medium')} />
            <AgingPill label="61-90 Días" count={stats?.aging.old || 0} description="Revisar Precio" isActive={agingFilter === 'old'} onClick={() => setAgingFilter(agingFilter === 'old' ? null : 'old')} />
            <AgingPill label="+90 Días" count={stats?.aging.critical || 0} description="Atención Crítica" isActive={agingFilter === 'critical'} onClick={() => setAgingFilter(agingFilter === 'critical' ? null : 'critical')} />
          </div>
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4 flex-wrap gap-4">
              <div><CardTitle className="text-lg font-headline">{sortByAging ? 'Días en Inventario' : 'Activos de Valor'}</CardTitle><CardDescription>Estado actual del patio (Tiempo Real)</CardDescription></div>
              <div className="flex items-center gap-2">
                {agingFilter && <button onClick={() => setAgingFilter(null)} className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20 flex items-center gap-1.5 transition-all"><FilterX className="h-3.5 w-3.5" /> Limpiar</button>}
                <button onClick={() => setSortByAging(!sortByAging)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 shadow-sm", sortByAging ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted")}><Clock className="h-3.5 w-3.5" /> {sortByAging ? 'Ver por Valor' : 'Ver por Tiempo'}</button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {processedVehicles.slice(0, 10).map((v) => {
                  const cost = v.costo_compra + (v.gastos_adecuacion?.reduce((a, b) => a + b.monto, 0) || 0);
                  const daysInStock = differenceInDays(new Date(), v.created_at?.toDate() || new Date());
                  return (
                    <div key={v.id} className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/5 rounded-2xl flex flex-col items-center justify-center border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <span className="text-[10px] font-black leading-none opacity-60">AÑO</span><span className="text-xs font-bold font-headline">{v.year}</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{v.make} {v.model}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter">{v.placa || 'Stock'}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[10px] text-muted-foreground font-medium">{v.transmission}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">{sortByAging ? <><p className="font-bold text-sm font-headline text-primary">{daysInStock} Días</p><p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">En Patio</p></> : <><p className="font-bold text-sm font-headline text-foreground">{formatCurrency(cost, 'USD')}</p><p className="text-[10px] font-black text-primary uppercase tracking-tighter">Inversión</p></>}</div>
                    </div>
                  );
                })}
                {!processedVehicles.length && <div className="py-20 text-center flex flex-col items-center gap-2 opacity-30"><CarFront className="h-10 w-10" /><p className="text-sm font-bold uppercase tracking-widest italic px-10">Sin unidades en este segmento</p></div>}
              </div>
              <div className="p-4 bg-muted/10 text-center border-t"><Link href={`/business/${slug}/inventory`} className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline flex items-center justify-center mx-auto gap-1">Inventario Completo <ChevronRight className="h-3 w-3" /></Link></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscal" className="space-y-6 outline-none mt-0">
          <div className="flex flex-col md:flex-row justify-between items-stretch gap-6 bg-primary p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-6 relative z-10">
              <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center shadow-2xl rotate-3"><FileText className="h-8 w-8 text-primary" /></div>
              <div className="space-y-1 text-white">
                <h3 className="text-2xl font-bold font-headline">Libro de Ventas Fiscal</h3>
                <p className="opacity-80 text-sm font-medium uppercase tracking-wider">{format(selectedDate, 'MMMM yyyy', { locale: es })}</p>
              </div>
            </div>
            <div className="flex gap-3 relative z-10">
              <button onClick={handleExportCSV} className="flex-1 md:w-32 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/20 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"><Download className="h-4 w-4" /> CSV</button>
              <button onClick={handlePrintPDF} className="flex-1 md:w-48 bg-white text-primary hover:bg-blue-50 shadow-xl rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-tight"><Printer className="h-4 w-4" /> Imprimir Libro</button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border shadow-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead><tr className="bg-muted/50 border-b"><th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Factura / Control</th><th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Base Imponible</th><th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">IVA (16%)</th><th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-primary">IGTF (3%)</th><th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total</th></tr></thead>
                <tbody className="divide-y bg-background/50 backdrop-blur-sm">
                  {sales?.map((sale) => {
                    const fiscal = calculateFiscalBreakdown(sale.precio_venta, sale.metodo_pago, concesionario?.configuracion?.vehiculos_exentos_iva);
                    return (
                      <tr key={sale.id} className="hover:bg-muted/40 transition-colors group">
                        <td className="px-6 py-5"><p className="font-bold text-foreground text-sm leading-none">{sale.numero_factura_venta || '---'}</p><p className="text-[10px] text-muted-foreground/70 font-black mt-1.5 uppercase tracking-tighter">{sale.numero_control_venta || '---'}</p></td>
                        <td className="px-6 py-5 font-medium text-foreground/80">{formatCurrency(fiscal.baseAmount, 'USD')}</td>
                        <td className="px-6 py-5 font-medium text-muted-foreground/60">{formatCurrency(fiscal.taxIVA, 'USD')}</td>
                        <td className="px-6 py-5 font-bold text-amber-600 bg-amber-600/5">{formatCurrency(fiscal.taxIGTF, 'USD')}</td>
                        <td className="px-6 py-5"><p className="font-bold text-foreground group-hover:text-primary transition-colors">{formatCurrency(fiscal.totalAmount, 'USD')}</p><div className="flex items-center gap-1.5 mt-1.5"><span className="w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" /><p className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">{sale.metodo_pago}</p></div></td>
                      </tr>
                    );
                  })}
                  {!sales?.length && <tr><td colSpan={5} className="py-20 text-center"><div className="flex flex-col items-center gap-2 opacity-30"><Info className="h-10 w-10 text-muted-foreground" /><p className="text-sm font-bold uppercase tracking-widest italic text-muted-foreground">Sin registros para {format(selectedDate, 'MMMM', { locale: es })}</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModernKPICard({ title, value, description, icon: Icon, variant, progress, trend }: any) {
  const styles: any = { primary: "bg-primary text-primary-foreground shadow-primary/30", success: "bg-card border-l-4 border-l-emerald-500 shadow-sm", warning: "bg-card border-l-4 border-l-amber-500 shadow-sm", danger: "bg-card border-l-4 border-l-red-500 shadow-sm" };
  const isLight = variant !== 'primary';
  return (
    <Card className={cn("border-none relative overflow-hidden group transition-all hover:-translate-y-1", styles[variant])}>
      <Icon className={cn("absolute -bottom-4 -right-4 h-28 w-28 opacity-[0.08] group-hover:scale-110 transition-transform", !isLight && "opacity-[0.15]")} />
      <CardHeader className="pb-2 space-y-0"><p className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isLight ? "text-muted-foreground" : "text-primary-foreground/60")}>{title}</p></CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-headline tracking-tighter leading-none">{value}</div>
        <p className={cn("text-xs mt-2.5 font-medium", isLight ? "text-muted-foreground" : "text-primary-foreground/80")}>{description}</p>
        {progress !== undefined && (<div className="mt-6 space-y-2"><div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground"><span>Cobertura</span><span>{progress.toFixed(0)}%</span></div><Progress value={progress} className="h-1.5 bg-muted [&>div]:bg-primary" /></div>)}
        {trend && !progress && (<div className={cn("mt-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", isLight ? "text-primary/70" : "text-primary-foreground/60")}><div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isLight ? "bg-primary" : "bg-white")} />{trend}</div>)}
      </CardContent>
    </Card>
  );
}

function ModernTabTrigger({ value, label, icon: Icon }: any) {
  return (
    <TabsTrigger value={value} className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">
      <Icon className="h-4 w-4" />{label}
    </TabsTrigger>
  );
}

function ReportRow({ label, amount, hint, highlight, disabled }: any) {
  return (
    <div className={cn("flex justify-between items-center p-5 rounded-3xl border bg-background/50 hover:bg-background transition-colors", disabled && "opacity-40 grayscale")}>
      <div className="space-y-0.5"><p className="text-sm font-bold text-foreground">{label}</p><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">{hint}</p></div>
      <span className={cn("font-bold font-headline text-lg", highlight === 'amber' ? "text-amber-500" : "text-foreground")}>{amount > 0 ? '-' : ''}{formatCurrency(amount, 'USD')}</span>
    </div>
  );
}

function AgingPill({ label, count, description, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-6 rounded-[2rem] border text-center transition-all duration-300 group overflow-hidden outline-none",
        isActive
          ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20 scale-[1.02]"
          : "bg-primary/[0.03] border-primary/10 text-primary hover:border-primary/40 hover:bg-primary/[0.06] shadow-sm"
      )}
    >
      <div
        className={cn(
          "absolute -right-2 -top-2 w-12 h-12 rounded-full blur-2xl transition-opacity",
          isActive ? "bg-white/20" : "bg-primary/20 opacity-0 group-hover:opacity-100"
        )}
      />
      <div className="relative z-10">
        <p
          className={cn(
            "text-3xl font-bold font-headline tracking-tighter mb-1 leading-none transition-colors",
            isActive ? "text-white" : "text-primary"
          )}
        >
          {count}
        </p>
        <p
          className={cn(
            "text-[10px] font-black uppercase tracking-widest mb-2 transition-colors",
            isActive ? "text-white/80" : "text-primary/70"
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ring-1 transition-colors",
            isActive ? "bg-white/20 ring-white/30 text-white" : "bg-primary/5 ring-primary/20"
          )}
        >
          {description}
        </span>
      </div>
    </button>
  );
}
