'use client';

import { useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, BarChart3 } from 'lucide-react';
import { startOfDay, subDays, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { Venta, RegistroCaja } from '@/lib/business-types';

export function PulseChart() {
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();

  const sevenDaysAgo = useMemo(() => startOfDay(subDays(new Date(), 6)), []);

  const ventasQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
      where('fecha', '>=', Timestamp.fromDate(sevenDaysAgo))
    );
  }, [concesionario?.id, firestore, sevenDaysAgo]);

  const cajaQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'caja'),
      where('fecha', '>=', Timestamp.fromDate(sevenDaysAgo))
    );
  }, [concesionario?.id, firestore, sevenDaysAgo]);

  const { data: ventas, isLoading: ventasLoading } = useCollection<Venta>(ventasQuery);
  const { data: caja, isLoading: cajaLoading } = useCollection<RegistroCaja>(cajaQuery);

  const isLoading = ventasLoading || cajaLoading;

  const data = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      return {
        date,
        name: format(date, 'EEE', { locale: es }).toUpperCase(),
        ventas: 0,
        caja: 0,
      };
    });

    ventas?.forEach((v) => {
      const d = v.fecha?.toDate?.();
      if (!d) return;
      const idx = days.findIndex((p) => isSameDay(p.date, d));
      if (idx >= 0) days[idx].ventas += v.precio_venta || 0;
    });

    caja?.forEach((c) => {
      const d = c.fecha?.toDate?.();
      if (!d) return;
      const idx = days.findIndex((p) => isSameDay(p.date, d));
      if (idx >= 0) {
        days[idx].caja += c.tipo === 'ingreso' ? c.monto || 0 : -(c.monto || 0);
      }
    });

    return days;
  }, [ventas, caja]);

  const totalActivity = data.reduce((s, d) => s + Math.abs(d.ventas) + Math.abs(d.caja), 0);

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[1.5rem]">
      <CardHeader className="bg-muted/30 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-headline tracking-tight">Pulso de la semana</CardTitle>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest mt-0.5">
              Últimos 7 días · Ventas vs Flujo de Caja
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 min-h-[280px]">
        {isLoading ? (
          <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
        ) : totalActivity === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 opacity-40">
            <BarChart3 className="h-10 w-10" />
            <p className="text-sm font-bold uppercase tracking-widest italic text-muted-foreground">
              Aún sin actividad esta semana
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pulseVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pulseCaja" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
                dy={8}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                  fontSize: '12px',
                }}
                formatter={(val: any, name: string) => [
                  formatCurrency(Number(val), 'USD'),
                  name === 'ventas' ? 'Ventas' : 'Flujo Caja',
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="ventas"
                name="Ventas"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#pulseVentas)"
              />
              <Area
                type="monotone"
                dataKey="caja"
                name="Flujo Caja"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#pulseCaja)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
