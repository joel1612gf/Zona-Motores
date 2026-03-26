'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Package,
  Eye,
  Loader2,
  Wrench,
  Globe,
  BookmarkCheck,
  CheckCircle2,
  Car,
} from 'lucide-react';
import Image from 'next/image';
import type { StockVehicle, StockStatus } from '@/lib/business-types';
import { VehicleFormDialog } from '@/components/business/vehicle-form-dialog';
import { formatCurrency } from '@/lib/utils';

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  privado_taller: { label: 'En Taller', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', icon: Wrench },
  publico_web: { label: 'Publicado', color: 'bg-green-500/10 text-green-700 border-green-500/30', icon: Globe },
  reservado: { label: 'Reservado', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30', icon: BookmarkCheck },
  vendido: { label: 'Vendido', color: 'bg-gray-500/10 text-gray-500 border-gray-500/30', icon: CheckCircle2 },
};

export default function InventoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { concesionario, hasPermission, canSeeCosts } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<StockVehicle | null>(null);

  const permission = hasPermission('inventory');

  // Load vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      if (!concesionario?.id) return;
      setIsLoading(true);
      try {
        const ref = collection(firestore, 'concesionarios', concesionario.id, 'inventario');
        const q = query(ref, orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockVehicle));
        setVehicles(list);
      } catch (error) {
        console.error('[Inventory] Error loading:', error);
        toast({ title: 'Error', description: 'No se pudo cargar el inventario.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concesionario?.id]);

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    let list = vehicles;

    // Filter by tab
    if (activeTab !== 'todos') {
      list = list.filter(v => v.estado_stock === activeTab);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(q)
      );
    }

    return list;
  }, [vehicles, activeTab, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: vehicles.length };
    vehicles.forEach(v => {
      counts[v.estado_stock] = (counts[v.estado_stock] || 0) + 1;
    });
    return counts;
  }, [vehicles]);

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setDialogOpen(true);
  };

  const handleSave = () => {
    // Reload vehicles
    window.location.reload();
  };

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const isReadOnly = permission === 'read';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Inventario</h1>
          <p className="text-muted-foreground mt-1">
            {vehicles.length} vehículo{vehicles.length !== 1 ? 's' : ''} en stock
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={handleAddVehicle} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Vehículo
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por marca, modelo, año..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs by status */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="todos" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Todos
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{statusCounts.todos || 0}</Badge>
          </TabsTrigger>
          {(Object.keys(STATUS_CONFIG) as StockStatus[]).map(status => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <TabsTrigger key={status} value={status} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {config.label}
                {(statusCounts[status] || 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{statusCounts[status]}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Grid (same content for all tabs, filtered by useMemo) */}
        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <Car className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No hay vehículos</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchQuery ? 'No se encontraron resultados para esta búsqueda.' : 'Agrega tu primer vehículo al inventario.'}
                </p>
                {!isReadOnly && !searchQuery && (
                  <Button onClick={handleAddVehicle} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Vehículo
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredVehicles.map(vehicle => {
                const statusConf = STATUS_CONFIG[vehicle.estado_stock];
                const StatusIcon = statusConf.icon;
                const mainImage = vehicle.images?.[0];
                const totalGastos = vehicle.gastos_adecuacion?.reduce((sum, g) => sum + g.monto, 0) || 0;
                const totalInvertido = (vehicle.costo_compra || 0) + totalGastos;
                const ganancia = (vehicle.precio_venta || 0) - totalInvertido;

                return (
                  <Card key={vehicle.id} className="overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
                    {/* Image */}
                    <div className="relative aspect-video bg-muted">
                      {mainImage ? (
                        <Image
                          src={mainImage.url}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Car className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                      {/* Status badge */}
                      <Badge
                        variant="outline"
                        className={`absolute top-2 right-2 ${statusConf.color} backdrop-blur-sm bg-background/80`}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConf.label}
                      </Badge>
                    </div>

                    {/* Info */}
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-bold font-headline text-base truncate">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h3>

                      {vehicle.precio_venta > 0 && (
                        <p className="text-xl font-bold font-headline text-primary">
                          {formatCurrency(vehicle.precio_venta)}
                        </p>
                      )}

                      {canSeeCosts && vehicle.costo_compra > 0 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Costo: {formatCurrency(totalInvertido)}</span>
                          <span className={ganancia >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                            {ganancia >= 0 ? '+' : ''}{formatCurrency(ganancia)}
                          </span>
                        </div>
                      )}

                      {vehicle.es_consignacion && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30">
                          Consignación
                        </Badge>
                      )}

                      {/* Actions */}
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => router.push(`/business/${slug}/inventory/${vehicle.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Descripción
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit dialog */}
      <VehicleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingVehicle={editingVehicle}
        concesionarioId={concesionario?.id || ''}
        onSave={handleSave}
      />
    </div>
  );
}
