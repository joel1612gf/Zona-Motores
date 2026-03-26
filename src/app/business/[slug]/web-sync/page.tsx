'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Globe,
  Search,
  Loader2,
  Upload,
  X,
  CheckCircle2,
  Car,
  Eye,
} from 'lucide-react';
import Image from 'next/image';
import type { StockVehicle } from '@/lib/business-types';
import { formatCurrency } from '@/lib/utils';

export default function WebSyncPage() {
  const { concesionario, hasPermission } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<StockVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const permission = hasPermission('web_sync');

  // Load inventory vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      if (!concesionario?.id) return;
      setIsLoading(true);
      try {
        const ref = collection(firestore, 'concesionarios', concesionario.id, 'inventario');
        const q = query(ref, orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockVehicle));
        // Only show vehicles that are not sold
        setVehicles(list.filter(v => v.estado_stock !== 'vendido'));
      } catch (error) {
        console.error('[WebSync] Error loading:', error);
        toast({ title: 'Error', description: 'No se pudo cargar el inventario.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concesionario?.id]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v =>
      `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(q)
    );
  }, [vehicles, searchQuery]);

  const publishedVehicles = filteredVehicles.filter(v => v.estado_stock === 'publico_web');
  const unpublishedVehicles = filteredVehicles.filter(v => v.estado_stock !== 'publico_web');

  // Publish to web
  const handlePublish = async (vehicle: StockVehicle) => {
    if (!concesionario) return;
    setPublishingId(vehicle.id);
    try {
      // Create public listing document under the concesionario owner's vehicleListings
      const publicDocData = {
        id: `biz_${vehicle.id}`,
        sellerId: concesionario.owner_uid,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        priceUSD: vehicle.precio_venta,
        mileage: vehicle.mileage || 0,
        bodyType: vehicle.bodyType || '',
        transmission: vehicle.transmission || 'Sincrónica',
        engine: vehicle.engine || '',
        exteriorColor: vehicle.exteriorColor || '',
        description: vehicle.description || '',
        images: vehicle.images || [],
        seller: {
          uid: concesionario.owner_uid,
          displayName: concesionario.nombre_empresa,
          isVerified: true,
          accountType: 'dealer',
          logoUrl: concesionario.logo_url || '',
        },
        location: {
          city: concesionario.direccion || '',
          state: '',
          lat: 0,
          lon: 0,
        },
        status: 'active',
        ownerCount: 1,
        tireLife: 80,
        hasAC: true,
        hasSoundSystem: false,
        hadMajorCrash: false,
        isOperational: true,
        isSignatory: false,
        acceptsTradeIn: false,
        createdAt: serverTimestamp(),
      };

      // Add to vehicleListings under owner
      const listingsRef = collection(firestore, 'users', concesionario.owner_uid, 'vehicleListings');
      const newDoc = await addDoc(listingsRef, publicDocData);

      // Update the listing's id field to match the doc id
      await updateDoc(doc(firestore, 'users', concesionario.owner_uid, 'vehicleListings', newDoc.id), {
        id: newDoc.id,
      });

      // Update stock vehicle with public listing ID and status
      const stockRef = doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicle.id);
      await updateDoc(stockRef, {
        estado_stock: 'publico_web',
        publicacion_web_id: newDoc.id,
      });

      // Update local state
      setVehicles(prev => prev.map(v =>
        v.id === vehicle.id
          ? { ...v, estado_stock: 'publico_web' as const, publicacion_web_id: newDoc.id }
          : v
      ));

      toast({
        title: '¡Publicado! 🌐',
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model} ya está visible en la web.`,
      });
    } catch (error) {
      console.error('[WebSync] Error publishing:', error);
      toast({ title: 'Error al publicar', description: 'No se pudo publicar el vehículo.', variant: 'destructive' });
    } finally {
      setPublishingId(null);
    }
  };

  // Unpublish from web
  const handleUnpublish = async (vehicle: StockVehicle) => {
    if (!concesionario || !vehicle.publicacion_web_id) return;
    setPublishingId(vehicle.id);
    try {
      // Delete public listing
      const publicRef = doc(firestore, 'users', concesionario.owner_uid, 'vehicleListings', vehicle.publicacion_web_id);
      await deleteDoc(publicRef);

      // Update stock vehicle
      const stockRef = doc(firestore, 'concesionarios', concesionario.id, 'inventario', vehicle.id);
      await updateDoc(stockRef, {
        estado_stock: 'privado_taller',
        publicacion_web_id: null,
      });

      // Update local state
      setVehicles(prev => prev.map(v =>
        v.id === vehicle.id
          ? { ...v, estado_stock: 'privado_taller' as const, publicacion_web_id: undefined }
          : v
      ));

      toast({
        title: 'Despublicado',
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model} fue removido de la web.`,
      });
    } catch (error) {
      console.error('[WebSync] Error unpublishing:', error);
      toast({ title: 'Error al despublicar', description: 'No se pudo quitar el vehículo.', variant: 'destructive' });
    } finally {
      setPublishingId(null);
    }
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
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
          <Globe className="h-8 w-8 text-primary" />
          Web Pública
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona qué vehículos están visibles en zonamotores.ve
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{publishedVehicles.length}</p>
            <p className="text-sm text-muted-foreground">Publicados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-muted-foreground">{unpublishedVehicles.length}</p>
            <p className="text-sm text-muted-foreground">Sin publicar</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar vehículo..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Published */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Publicados en la Web ({publishedVehicles.length})
            </h2>
            {publishedVehicles.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  No hay vehículos publicados actualmente.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {publishedVehicles.map(vehicle => (
                  <Card key={vehicle.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-4">
                      <div className="relative h-16 w-24 rounded-lg overflow-hidden bg-muted shrink-0">
                        {vehicle.images?.[0] ? (
                          <Image
                            src={vehicle.images[0].url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Car className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                        <p className="text-sm text-primary font-bold">{formatCurrency(vehicle.precio_venta)}</p>
                      </div>
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 shrink-0">
                        ✅ Publicado
                      </Badge>
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnpublish(vehicle)}
                          disabled={publishingId === vehicle.id}
                          className="text-destructive hover:text-destructive shrink-0"
                        >
                          {publishingId === vehicle.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><X className="h-4 w-4 mr-1" /> Despublicar</>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Unpublished */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              Sin Publicar ({unpublishedVehicles.length})
            </h2>
            {unpublishedVehicles.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  Todos los vehículos están publicados.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {unpublishedVehicles.map(vehicle => (
                  <Card key={vehicle.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-4">
                      <div className="relative h-16 w-24 rounded-lg overflow-hidden bg-muted shrink-0">
                        {vehicle.images?.[0] ? (
                          <Image
                            src={vehicle.images[0].url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Car className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                        <p className="text-sm text-primary font-bold">{formatCurrency(vehicle.precio_venta)}</p>
                      </div>
                      <Badge variant="outline" className="bg-muted text-muted-foreground shrink-0">
                        Borrador
                      </Badge>
                      {!isReadOnly && (
                        <Button
                          size="sm"
                          onClick={() => handlePublish(vehicle)}
                          disabled={publishingId === vehicle.id || !vehicle.images?.length}
                          className="shrink-0"
                        >
                          {publishingId === vehicle.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Upload className="h-4 w-4 mr-1" /> Publicar</>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
