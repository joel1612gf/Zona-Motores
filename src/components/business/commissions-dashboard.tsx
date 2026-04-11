'use client';

import { useState, useMemo, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Award, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  ChevronRight, 
  Trophy, 
  Target, 
  Briefcase,
  PieChart
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { StaffMember, Venta } from '@/lib/business-types';
import { StaffCommissionModal } from './staff-commission-modal';

interface CommissionsDashboardProps {
  slug: string;
}

export function CommissionsDashboard({ slug }: CommissionsDashboardProps) {
  const { concesionario, staffList, isLoading: authLoading } = useBusinessAuth();
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [tasaCambio, setTasaCambio] = useState<number>(0);

  // Fetch Exchange Rate logic consistent with Products Page
  useEffect(() => {
    if (!concesionario?.id) return;
    const cfg = concesionario.configuracion as any;
    const manualRate = Number(cfg?.tasa_cambio_manual) || 0;
    const autoEnabled = cfg?.tasa_cambio_auto === true || cfg?.tasa_cambio_auto === 'true';

    if (autoEnabled) {
      fetch('/api/business/exchange-rate')
        .then(r => r.json())
        .then(data => { if (data.tasa) setTasaCambio(Number(data.tasa)); else setTasaCambio(manualRate); })
        .catch(() => setTasaCambio(manualRate));
    } else {
      setTasaCambio(manualRate);
    }
  }, [concesionario]);

  // Real-time Sales Query for the selected month
  const startOfMonth = new Date(selectedYear, selectedMonth, 1);
  const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

  const salesQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      where('fecha', '>=', Timestamp.fromDate(startOfMonth)),
      where('fecha', '<=', Timestamp.fromDate(endOfMonth)),
      orderBy('fecha', 'desc')
    );
  }, [concesionario?.id, selectedMonth, selectedYear, firestore]);

  const { data: sales, isLoading: salesLoading } = useCollection<Venta>(salesQuery);

  // Aggregate Data per Staff
  const staffStats = useMemo(() => {
    if (!staffList || !sales) return [];

    return staffList.map(member => {
      const memberSales = sales.filter(s => s.vendedor_staff_id === member.id);
      
      let totalSalesVolume = 0;
      let totalNetProfit = 0;
      let earnedCommission = 0;

      memberSales.forEach(sale => {
        totalSalesVolume += sale.precio_venta;
        totalNetProfit += sale.ganancia_neta;

        const commType = member.commission_type || 'total_price';
        const commPercentage = member.commission_percentage || concesionario?.configuracion.estructura_comision || 0;

        if (commType === 'total_price') {
          earnedCommission += (sale.precio_venta * commPercentage) / 100;
        } else {
          earnedCommission += (sale.ganancia_neta * commPercentage) / 100;
        }
      });

      return {
        member,
        salesCount: memberSales.length,
        totalSalesVolume,
        totalNetProfit,
        earnedCommission,
        progress: member.monthly_goal ? (totalNetProfit / member.monthly_goal) * 100 : 0
      };
    }).sort((a, b) => b.totalNetProfit - a.totalNetProfit);
  }, [staffList, sales, concesionario]);

  const totalMonthlyProfit = useMemo(() => staffStats.reduce((acc, curr) => acc + curr.totalNetProfit, 0), [staffStats]);
  const totalMonthlyCommissions = useMemo(() => staffStats.reduce((acc, curr) => acc + curr.earnedCommission, 0), [staffStats]);

  const formatBs = (usd: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
    }).format(usd * (tasaCambio || 1));
  };

  if (authLoading || salesLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const topThree = staffStats.slice(0, 3);

  return (
    <div className="p-4 md:p-6 pb-32 md:pb-12 space-y-6 md:space-y-8 animate-in fade-in duration-500 min-h-screen">
      {/* Header & Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight text-slate-900">Panel de Comisiones</h1>
          <p className="text-sm text-muted-foreground font-medium">Gestión de rentabilidad y desempeño del equipo</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-2xl shadow-sm overflow-x-auto">
          <Calendar className="h-4 w-4 text-primary ml-2 shrink-0" />
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-transparent border-none text-xs md:text-sm font-bold focus:ring-0 cursor-pointer text-slate-900 shrink-0"
          >
            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-transparent border-none text-xs md:text-sm font-bold focus:ring-0 cursor-pointer mr-2 text-slate-900 shrink-0"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden relative group">
          <CardHeader className="pb-2 text-left">
            <CardTitle className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-green-500" /> Utilidad Real Mes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-xl md:text-2xl font-black font-headline text-slate-900">{formatCurrency(totalMonthlyProfit)}</div>
            <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground mt-1">≈ {formatBs(totalMonthlyProfit)}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden relative group">
          <CardHeader className="pb-2 text-left">
            <CardTitle className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Total Comisiones
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-xl md:text-2xl font-black font-headline text-slate-900">{formatCurrency(totalMonthlyCommissions)}</div>
            <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground mt-1">≈ {formatBs(totalMonthlyCommissions)}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden relative group">
          <CardHeader className="pb-2 text-left">
            <CardTitle className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Award className="h-3.5 w-3.5 text-amber-500" /> Eficiencia Equipo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <div className="text-xl md:text-2xl font-black font-headline text-slate-900">
              {sales?.length || 0} <span className="text-sm font-bold text-muted-foreground uppercase">Ventas</span>
            </div>
            <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground mt-1">Tasa BCV: Bs. {tasaCambio || '...'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Podium - Ranking Section */}
      <div className="space-y-4">
        <h2 className="text-lg md:text-xl font-black font-headline flex items-center gap-2 text-slate-900">
          <Trophy className="h-5 w-5 text-amber-500" /> Podio de Honor
        </h2>
        
        {/* Mobile Podium: Vertical List */}
        <div className="md:hidden space-y-3">
          {topThree.length > 0 ? topThree.map((stat, i) => (
            <div 
              key={stat.member.id}
              onClick={() => setSelectedStaff(stat.member)}
              className={cn(
                "relative bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-95",
                i === 0 ? "border-amber-200 bg-amber-50/30 shadow-md" : "border-slate-100 shadow-sm"
              )}
            >
              <div className="relative shrink-0">
                <div className={cn(
                  "w-12 h-12 rounded-xl overflow-hidden border-2",
                  i === 0 ? "border-amber-400" : i === 1 ? "border-slate-300" : "border-orange-300"
                )}>
                  {stat.member.foto_url ? (
                    <img src={stat.member.foto_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 bg-slate-50">{stat.member.nombre[0]}</div>
                  )}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm",
                  i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : "bg-orange-400"
                )}>
                  {i + 1}°
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-slate-900 truncate">{stat.member.nombre}</h3>
                <p className="text-[10px] font-bold text-primary uppercase tracking-tight">{formatCurrency(stat.totalNetProfit)} Utilidad</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 rounded-full">
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          )) : (
            <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed text-muted-foreground text-xs italic">
              Sin datos este mes.
            </div>
          )}
        </div>

        {/* Desktop Podium: Traditional Horizontal/Staggered */}
        <div className="hidden md:grid md:grid-cols-3 gap-6 items-end pt-12">
          {topThree.length > 0 ? (
            <>
              {/* 2nd Place */}
              {topThree[1] && (
                <div className="animate-in slide-in-from-bottom-4 duration-700 delay-100">
                  <div className="relative bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedStaff(topThree[1].member)}>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                      <div className="w-20 h-20 rounded-full border-4 border-slate-200 overflow-hidden shadow-md bg-slate-100">
                        {topThree[1].member.foto_url ? (
                          <img src={topThree[1].member.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-400">{topThree[1].member.nombre[0]}</div>
                        )}
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-700 font-bold px-3 py-0.5 rounded-full text-sm">2°</div>
                    </div>
                    <div className="mt-10">
                      <h3 className="font-bold text-lg text-slate-900">{topThree[1].member.nombre}</h3>
                      <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-tighter">Plata en Utilidad</p>
                      <div className="text-xl font-bold text-primary">{formatCurrency(topThree[1].totalNetProfit)}</div>
                      <div className="text-[10px] text-muted-foreground mb-4 font-bold uppercase">Ganancia Real</div>
                      <Button variant="ghost" size="sm" className="w-full border-slate-100 hover:bg-slate-50 font-bold text-[10px] uppercase">Ver Reporte</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {topThree[0] && (
                <div className="animate-in slide-in-from-bottom-8 duration-700">
                  <div className="relative bg-white border-2 border-primary/20 rounded-3xl p-8 text-center shadow-xl hover:border-primary/40 transition-all cursor-pointer group scale-105 z-10" onClick={() => setSelectedStaff(topThree[0].member)}>
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                      <div className="w-24 h-24 rounded-full border-4 border-amber-400 overflow-hidden shadow-lg bg-slate-100">
                        {topThree[0].member.foto_url ? (
                          <img src={topThree[0].member.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-400">{topThree[0].member.nombre[0]}</div>
                        )}
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 font-black px-4 py-1 rounded-full text-sm shadow-md uppercase">Oro</div>
                    </div>
                    <div className="mt-12">
                      <h3 className="font-black text-2xl mb-1 text-slate-900">{topThree[0].member.nombre}</h3>
                      <Badge className="bg-amber-400/10 text-amber-600 border-amber-400/20 mb-4 font-bold">🏆 LÍDER DE RENTABILIDAD</Badge>
                      <div className="text-3xl font-black text-primary mb-1">{formatCurrency(topThree[0].totalNetProfit)}</div>
                      <div className="text-[10px] text-muted-foreground mb-6 uppercase tracking-widest font-black">Utilidad Neta del Mes</div>
                      <Button className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-black text-xs">EXPANDIR HISTORIAL</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {topThree[2] && (
                <div className="animate-in slide-in-from-bottom-4 duration-700 delay-200">
                  <div className="relative bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedStaff(topThree[2].member)}>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                      <div className="w-20 h-20 rounded-full border-4 border-orange-200 overflow-hidden shadow-md bg-slate-100">
                        {topThree[2].member.foto_url ? (
                          <img src={topThree[2].member.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-400">{topThree[2].member.nombre[0]}</div>
                        )}
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-200 text-orange-800 font-bold px-3 py-0.5 rounded-full text-sm">3°</div>
                    </div>
                    <div className="mt-10">
                      <h3 className="font-bold text-lg text-slate-900">{topThree[2].member.nombre}</h3>
                      <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-tighter">Bronce en Utilidad</p>
                      <div className="text-xl font-bold text-primary">{formatCurrency(topThree[2].totalNetProfit)}</div>
                      <div className="text-[10px] text-muted-foreground mb-4 font-bold uppercase">Ganancia Real</div>
                      <Button variant="ghost" size="sm" className="w-full border-slate-100 hover:bg-slate-50 font-bold text-[10px] uppercase">Ver Reporte</Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="col-span-3 text-center p-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-muted-foreground">Aún no hay ventas registradas este mes.</p>
            </div>
          )}
        </div>
      </div>

      {/* Staff Grid */}
      <div className="space-y-4">
        <h2 className="text-lg md:text-xl font-black font-headline flex items-center gap-2 text-slate-900">
          <Target className="h-5 w-5 text-blue-500" /> Desempeño Individual
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {staffStats.map((stat, i) => (
            <Card key={stat.member.id} className="bg-white border-slate-200 hover:border-primary/30 transition-all group overflow-hidden shadow-sm hover:shadow-md rounded-2xl md:rounded-3xl">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-primary/5 border border-primary/10 overflow-hidden flex-shrink-0">
                    {stat.member.foto_url ? (
                      <img src={stat.member.foto_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-primary/40 text-xl">
                        {stat.member.nombre[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base md:text-lg truncate text-slate-900 group-hover:text-primary transition-colors text-left leading-tight">
                      {stat.member.nombre}
                    </h3>
                    {/* Fixed Badge Wrapping for Mobile */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px] md:text-[10px] px-1.5 py-0 h-4 md:h-5 bg-slate-50 text-slate-500 border-slate-200 w-fit whitespace-nowrap">
                        {stat.member.commission_type === 'net_profit' ? 'Por Utilidad' : 'Por Venta'}
                      </Badge>
                      <span className="text-[10px] md:text-[11px] text-muted-foreground font-bold uppercase tracking-tighter">
                        {stat.salesCount} Unidades
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 shrink-0" onClick={() => setSelectedStaff(stat.member)}>
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-primary" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-black">Comisión</span>
                      <div className="text-xl md:text-2xl font-black text-primary leading-none">{formatCurrency(stat.earnedCommission)}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-black">Meta</span>
                      <div className="text-xs md:text-sm font-black text-slate-700 leading-none">{formatCurrency(stat.member.monthly_goal || 0)}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] md:text-xs">
                      <span className="text-muted-foreground font-bold uppercase tracking-tighter">Progreso</span>
                      <span className={cn(
                        "font-black uppercase tracking-tighter",
                        stat.progress >= 100 ? "text-green-600" : stat.progress >= 50 ? "text-blue-600" : "text-amber-600"
                      )}>
                        {Math.round(stat.progress)}%
                      </span>
                    </div>
                    <Progress value={stat.progress} className="h-2 md:h-2.5 bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:gap-3 pt-1">
                    <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 text-left">
                      <span className="block text-[8px] md:text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Utilidad Gen.</span>
                      <span className="text-xs md:text-sm font-bold text-slate-700 truncate block">{formatCurrency(stat.totalNetProfit)}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100 text-left">
                      <span className="block text-[8px] md:text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Vol. Ventas</span>
                      <span className="text-xs md:text-sm font-bold text-slate-700 truncate block">{formatCurrency(stat.totalSalesVolume)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Staff Detail Modal */}
      {selectedStaff && (
        <StaffCommissionModal 
          staffMember={selectedStaff}
          sales={sales?.filter(s => s.vendedor_staff_id === selectedStaff.id) || []}
          open={!!selectedStaff}
          onOpenChange={(open) => !open && setSelectedStaff(null)}
          bcvRate={tasaCambio}
          monthLabel={['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][selectedMonth]}
          year={selectedYear}
          defaultCommissionPercentage={concesionario?.configuracion.estructura_comision}
        />
      )}
    </div>
  );
}
