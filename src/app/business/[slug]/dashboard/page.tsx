'use client';

import { useBusinessAuth } from '@/context/business-auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_LABELS } from '@/lib/business-types';
import { Package, ShoppingCart, Users, Wallet, TrendingUp, Clock, Loader2, Car } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { startOfMonth, startOfDay } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';

export default function BusinessDashboardPage() {
  const { concesionario, staff, currentRole } = useBusinessAuth();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    stockActivo: 0,
    valorInventario: 0,
    ventasMesCount: 0,
    ventasMesMonto: 0,
    leadsActivos: 0,
    cajaHoyBalance: 0,
  });

  useEffect(() => {
    if (!firestore || !concesionario) return;

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const dbId = concesionario.id;
        const now = new Date();
        const startOfThisMonth = startOfMonth(now);
        const startOfToday = startOfDay(now);

        // 1. Inventario (Stock + Valor)
        const invRef = collection(firestore, `concesionarios/${dbId}/inventario`);
        const invSnapshot = await getDocs(invRef);
        let stockCount = 0;
        let valorTotal = 0;

        invSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.estado_stock !== 'vendido') {
            stockCount++;
            valorTotal += (data.precio_venta || 0);
          }
        });

        // 2. Ventas del Mes
        const ventasRef = collection(firestore, `concesionarios/${dbId}/ventas`);
        const ventasQuery = query(ventasRef, where('fecha', '>=', Timestamp.fromDate(startOfThisMonth)));
        const ventasSnapshot = await getDocs(ventasQuery);

        let ventasCount = 0;
        let ventasMonto = 0;
        ventasSnapshot.forEach(doc => {
          const data = doc.data();
          ventasCount++;
          ventasMonto += (data.precio_venta || 0);
        });

        // 3. Leads Activos (Consignación)
        const leadsRef = collection(firestore, `concesionarios/${dbId}/consignaciones_leads`);
        const leadsQuery = query(leadsRef, where('estado', 'in', ['contacto_inicial', 'cita_agendada']));
        const leadsSnapshot = await getDocs(leadsQuery);
        const leadsCount = leadsSnapshot.size;

        // 4. Caja Hoy
        const cajaRef = collection(firestore, `concesionarios/${dbId}/caja_registro`);
        const cajaQuery = query(cajaRef, where('fecha', '>=', Timestamp.fromDate(startOfToday)));
        const cajaSnapshot = await getDocs(cajaQuery);

        let cajaBalance = 0;
        cajaSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.tipo === 'ingreso') {
            cajaBalance += (data.monto || 0);
          } else if (data.tipo === 'egreso') {
            cajaBalance -= (data.monto || 0);
          }
        });

        setStats({
          stockActivo: stockCount,
          valorInventario: valorTotal,
          ventasMesCount: ventasCount,
          ventasMesMonto: ventasMonto,
          leadsActivos: leadsCount,
          cajaHoyBalance: cajaBalance,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [firestore, concesionario]);

  const isAllowedToSeeStats = currentRole === 'dueno' || currentRole === 'encargado';

  return (
    <div className="space-y-8 min-h-[calc(100vh-140px)] flex flex-col">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold font-headline">
          ¡Hola, {staff?.nombre}!
        </h1>
        <p className="text-muted-foreground mt-1 text-lg">
          {concesionario?.nombre_empresa} <span className="mx-2">•</span> <span className="font-medium text-foreground">{currentRole ? ROLE_LABELS[currentRole] : ''}</span>
        </p>
      </div>

      {!isAllowedToSeeStats ? (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-3xl bg-card border mt-4 h-full min-h-[400px] shadow-sm">
          {/* Custom background image with transparency */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.10]">
            <Image
              src="/assets/dashboard-car-bg.png"
              alt="Background"
              width={600}
              height={600}
              className="object-contain"
            />
          </div>

          <div className="relative z-10 text-center space-y-3 px-6">
            <h2 className="text-3xl font-bold font-headline tracking-tight">Bienvenido al Panel de Control</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-lg leading-relaxed text-balance">
              Utiliza el menú lateral para gestionar las tareas asignadas a tu rol.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Quick stats (KPI Cards) */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto col-span-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Inventario Activo</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline">{stats.stockActivo}</div>
                  <p className="text-xs text-muted-foreground mt-1">Valor Total: <span className="font-semibold text-foreground/80">{formatCurrency(stats.valorInventario)}</span></p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Ventas del Mes</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline">{stats.ventasMesCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">Facturación: <span className="font-semibold text-foreground/80">{formatCurrency(stats.ventasMesMonto)}</span></p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Perspectivas Consignación</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline">{stats.leadsActivos}</div>
                  <p className="text-xs text-muted-foreground mt-1">Leads / citas por atender</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Flujo Caja Diaria</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-headline ${stats.cajaHoyBalance >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                    {stats.cajaHoyBalance >= 0 ? '+' : ''}{formatCurrency(stats.cajaHoyBalance)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Balance total de hoy</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Activity & Performance placeholders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>Rendimiento General</CardTitle>
                </div>
                <CardDescription>Esta sección se actualizará automáticamente con gráficos a medida que ingreses más ventas y gastos de adecuación.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-40 bg-muted/30 border border-dashed rounded-lg text-muted-foreground text-sm flex-col gap-2">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                  Gráficos en construcción
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle>Actividad Reciente</CardTitle>
                </div>
                <CardDescription>Resumen de las últimas transacciones en el concesionario.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-40 bg-muted/30 border border-dashed rounded-lg text-muted-foreground text-sm flex-col gap-2">
                  <Clock className="h-8 w-8 text-muted-foreground/50" />
                  Historial en construcción
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
