'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore } from '@/firebase';
import { collection, collectionGroup, query, where, getDocs, addDoc, updateDoc, serverTimestamp, orderBy, limit, doc, Timestamp, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Search, Calendar, Phone, ArrowRight, MessageCircle, Filter, Coins, Info, Snowflake, Speaker, Shield, DoorOpen, CircleCheck, ShieldCheck, PenSquare, LifeBuoy, GitCompareArrows, ArrowDownToLine, ArrowUpFromLine, Gauge, Palette, Settings2, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';
import type { Vehicle } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Filters, type FilterState } from '@/components/filters';
import { SearchWithHistory } from '@/components/search-with-history';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ImageLightbox } from '@/components/ui/image-lightbox';

// Distance calculation using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export default function ConsignmentPage() {
  const { concesionario, staff, isLoading: isAuthLoading } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('radar');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  const [leadToIngresar, setLeadToIngresar] = useState<any>(null);
  const [ingresoData, setIngresoData] = useState({ costoCompra: 0, comisionPorcentaje: 15 });
  const [isIngresando, setIsIngresando] = useState(false);

  // Detail view state
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [showPrice, setShowPrice] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    make: 'all',
    model: 'all',
    minPrice: '',
    maxPrice: '',
    minYear: '',
    maxYear: '',
    bodyType: 'all',
    transmission: 'all',
    location: null,
  });

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentLightboxIndex, setCurrentLightboxIndex] = useState(0);
  const calculatedPrice = useMemo(() => {
    if (!detailVehicle || !concesionario) return 0;
    const basePrice = detailVehicle.priceUSD;
    const markupPct = concesionario.configuracion?.margen_consignacion_porcentaje || 15;
    return basePrice + (basePrice * markupPct / 100);
  }, [detailVehicle, concesionario]);

  useEffect(() => {
    if (isAuthLoading || !concesionario) return;

    const fetchRadarVehicles = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collectionGroup(firestore, 'vehicleListings'),
          limit(100)
        );
        const snapshot = await getDocs(q);
        const fetchedVehicles = snapshot.docs.map(d => d.data() as Vehicle);
        
        // Filter in client: must accept consignment and be active
        const consignmentVehicles = fetchedVehicles.filter(v => 
           v.acceptsConsignment === true && 
           (v.status === 'active' || !v.status)
        );
        
        setVehicles(consignmentVehicles);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        toast({ title: 'Error', description: 'No se pudieron cargar los vehículos.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRadarVehicles();
  }, [firestore, concesionario, isAuthLoading, toast]);

  // Fetch Leads
  useEffect(() => {
    if (isAuthLoading || !concesionario) return;

    const fetchLeads = async () => {
      try {
        const q = query(
          collection(firestore, `concesionarios/${concesionario.id}/consignaciones_leads`),
          limit(50)
        );
        const snapshot = await getDocs(q);
        setLeads(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching leads:", error);
      }
    };

    fetchLeads();
  }, [firestore, concesionario, isAuthLoading, activeTab]);

  // Client-side distance filtering
  const visibleVehicles = useMemo(() => {
    if (!concesionario) return [];
    
    let distanceFiltered = vehicles;
    if (concesionario.geolocalizacion) {
      const { latitude: dealerLat, longitude: dealerLon } = concesionario.geolocalizacion as any;

      distanceFiltered = vehicles.filter(v => {
        if (!v.location || typeof v.location.lat !== 'number' || typeof v.location.lon !== 'number') return false;
        
        const distance = getDistanceFromLatLonInKm(dealerLat, dealerLon, v.location.lat, v.location.lon);
        const maxRadius = v.consignmentRadiusKm || 0;
        
        return distance <= maxRadius;
      });
    }

    return distanceFiltered.filter(vehicle => {
      const { searchTerm, minYear, maxYear, minPrice, maxPrice, make, model, bodyType, transmission } = filters;

      // search
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const searchMatch = normalizedSearch === '' || [
        vehicle.make, vehicle.model, vehicle.year.toString(),
        vehicle.bodyType, vehicle.transmission,
        vehicle.is4x4 ? '4x4' : '', vehicle.hasAC ? 'aire' : ''
      ].join(' ').toLowerCase().includes(normalizedSearch);

      const makeMatch = make === 'all' || vehicle.make === make;
      const modelMatch = model === 'all' || vehicle.model === model;
      const bodyMatch = bodyType === 'all' || vehicle.bodyType === bodyType;
      const transMatch = transmission === 'all' || vehicle.transmission === transmission;

      const minYearNum = minYear ? parseInt(minYear, 10) : 0;
      const maxYearNum = maxYear ? parseInt(maxYear, 10) : Infinity;
      const yearMatch = vehicle.year >= minYearNum && vehicle.year <= maxYearNum;

      const minPriceNum = minPrice ? parseInt(minPrice, 10) : 0;
      const maxPriceNum = maxPrice ? parseInt(maxPrice, 10) : Infinity;
      const priceMatch = vehicle.priceUSD >= minPriceNum && vehicle.priceUSD <= maxPriceNum;
      
      return searchMatch && makeMatch && modelMatch && bodyMatch && transMatch && yearMatch && priceMatch;
    });
  }, [vehicles, concesionario, filters]);

  const handleContactClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsContactModalOpen(true);
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      if (!concesionario) return;
      const refDoc = doc(firestore, `concesionarios/${concesionario.id}/consignaciones_leads`, leadId);
      await updateDoc(refDoc, { estado: newStatus });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, estado: newStatus } : l));
      toast({ title: 'Estado actualizado' });
    } catch(e) {
      toast({ title: 'Error al actualizar', variant: 'destructive' });
    }
  };

  const handleIngresarInventario = (lead: any) => {
    setLeadToIngresar(lead);
    setIngresoData({
      costoCompra: 0,
      comisionPorcentaje: concesionario?.configuracion?.margen_consignacion_porcentaje || 15
    });
  };

  const confirmIngresoInventario = async () => {
    if (!leadToIngresar || !concesionario || !staff) return;
    setIsIngresando(true);
    try {
      const sellerId = leadToIngresar.datos_cliente?.id;
      if (!sellerId) throw new Error('No seller ID');
      
      const vehicleRef = doc(firestore, `users/${sellerId}/vehicleListings/${leadToIngresar.vehicle_id}`);
      const snap = await getDoc(vehicleRef);
      if (!snap.exists()) throw new Error('Vehículo original no encontrado');
      
      const vehicleData = snap.data();
      const precioVenta = Number(ingresoData.costoCompra) + (Number(ingresoData.costoCompra) * Number(ingresoData.comisionPorcentaje) / 100);
      const comisionExacta = precioVenta - Number(ingresoData.costoCompra);

      const invRef = collection(firestore, `concesionarios/${concesionario.id}/inventario`);
      await addDoc(invRef, {
        ...vehicleData,
        estado_stock: 'publico_web',
        costo_compra: Number(ingresoData.costoCompra),
        gastos_adecuacion: [],
        precio_venta: precioVenta,
        ganancia_neta_estimada: comisionExacta,
        es_consignacion: true,
        consignacion_info: {
          vendedor_particular_id: sellerId,
          comision_acordada: comisionExacta
        },
        asignado_a: staff.id,
        created_at: serverTimestamp(),
      });

      await updateLeadStatus(leadToIngresar.id, 'en_inventario');
      toast({ title: '¡Vehículo ingresado al inventario!' });
      setLeadToIngresar(null);
      await updateDoc(vehicleRef, { status: 'paused' });
    } catch(e) {
      console.error(e);
      toast({ title: 'Error', description: 'No se pudo traspasar el vehículo.', variant: 'destructive' });
    } finally {
      setIsIngresando(false);
    }
  };

  const handleCreateAppointment = async () => {
    if (!selectedVehicle || !appointmentDate || !appointmentTime || !staff || !concesionario) {
      toast({ title: 'Datos incompletos', description: 'Por favor selecciona fecha y hora.', variant: 'destructive' });
      return;
    }

    setIsScheduling(true);
    try {
      // 1. Guardar la cita en la base de datos (concesionarios/{id}/citas_consignacion)
      const citaRef = collection(firestore, `concesionarios/${concesionario.id}/citas_consignacion`);
      
      const dateStr = `${appointmentDate}T${appointmentTime}:00`;
      const dateObj = new Date(dateStr);

      await addDoc(citaRef, {
        vehicle_id: selectedVehicle.id,
        vehicle_nombre: `${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.year}`,
        publicador_nombre: selectedVehicle.seller?.displayName || 'Cliente',
        publicador_telefono: selectedVehicle.seller?.phone || '',
        fecha_cita: Timestamp.fromDate(dateObj),
        estado: 'agendada',
        vendedor_id: staff.id,
        vendedor_nombre: staff.nombre,
        created_at: serverTimestamp()
      });

      // 2. También guardar como lead general
      const leadRef = collection(firestore, `concesionarios/${concesionario.id}/consignaciones_leads`);
      await addDoc(leadRef, {
        vehicle_id: selectedVehicle.id,
        vehicle_nombre: `${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.year}`,
        estado: 'cita_agendada',
        vendedor_id: staff.id,
        fecha_contacto: serverTimestamp(),
        datos_cliente: selectedVehicle.seller || {}
      });

      // 3. Generar mensaje de WhatsApp
      let phone = selectedVehicle.seller?.phone || '';
      // Limpiar el teléfono para la URL
      if (phone.startsWith('+')) phone = phone.substring(1);
      phone = phone.replace(/\D/g, ''); // Remover todo lo que no sea dígito

      const formattedDate = format(dateObj, "EEEE d 'de' MMMM", { locale: es });
      const timeStr = format(dateObj, "h:mm a");

      const msg = `Hola, te escribe ${staff.nombre} de ${concesionario.nombre_empresa}. Tenemos un cliente muy interesado en tu ${selectedVehicle.make} ${selectedVehicle.model} publicado en Zona Motores. Nuestro cliente tiene disponibilidad para verlo el ${formattedDate} a las ${timeStr}. Avísame si puedes para agendar la reunión.`;
      
      const encodedMsg = encodeURIComponent(msg);
      const waUrl = `https://wa.me/${phone}?text=${encodedMsg}`;

      setIsContactModalOpen(false);
      
      toast({ title: '¡Cita Guardada!', description: 'Redirigiendo a WhatsApp...' });

      // Simulate a small delay for UI then open WhatsApp
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 500);

    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Hubo un error al registrar la cita.', variant: 'destructive' });
    } finally {
      setIsScheduling(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consignaciones</h1>
          <p className="text-muted-foreground">
            Encuentra vehículos cercanos, capta clientes y agenda citas para sumar autos a tu inventario.
          </p>
        </div>
      </div>

      {!concesionario?.geolocalizacion && (
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-4 rounded-lg flex items-start gap-3">
          <MapPin className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>Configura la ubicación de tu concesionario:</strong> Actualmente no tienes una ubicación (coordenadas) grabada en tu perfil. Esto impide calcular la distancia exacta con los vehículos. De momento, estás viendo todos los prospectos disponibles.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="radar" className="gap-2"><Search className="h-4 w-4" /> Radar de Captación</TabsTrigger>
          <TabsTrigger value="prospectos" className="gap-2"><Calendar className="h-4 w-4" /> Mis Prospectos</TabsTrigger>
        </TabsList>

        <TabsContent value="radar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-20">
                <Filters filters={filters} onFilterChange={setFilters} />
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <SearchWithHistory 
                    initialValue={filters.searchTerm}
                    onSearch={(term) => setFilters(prev => ({ ...prev, searchTerm: term }))}
                  />
                </div>
                <div className="lg:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filtros
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] sm:w-[340px]">
                      <SheetHeader>
                        <SheetTitle className="sr-only">Filtros</SheetTitle>
                      </SheetHeader>
                      <div className="py-6 h-full overflow-y-auto w-full">
                        <Filters filters={filters} onFilterChange={setFilters} />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-muted rounded-t-lg" />
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : visibleVehicles.length === 0 ? (
            <div className="text-center py-20 border rounded-lg bg-card text-muted-foreground flex flex-col items-center">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground">No hay prospectos en tu radar</h3>
              <p>No se encontraron vehículos que acepten consignación en tu área de alcance.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleVehicles.map((vehicle) => (
                <Card key={vehicle.id} className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                  <div className="relative h-48 bg-muted">
                    {vehicle.images && vehicle.images[0] ? (
                      <Image 
                        src={vehicle.images[0].url} 
                        alt="Vehicle" 
                        fill 
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">Sin foto</div>
                    )}
                    <Badge className="absolute top-2 right-2 flex items-center gap-1 shadow-sm">
                      <MapPin className="h-3 w-3" />
                      Disp. a moverse {vehicle.consignmentRadiusKm}km
                    </Badge>
                  </div>
                  <CardContent className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg leading-tight">
                        {vehicle.make} {vehicle.model}
                      </h3>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mb-3">
                      <span>{vehicle.year}</span>
                      <span>•</span>
                      <span>{vehicle.mileage.toLocaleString()} km</span>
                    </div>
                    {vehicle.location?.city && (
                      <div className="text-sm flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        Ubicado en {vehicle.location.city}, {vehicle.location.state}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 border-t mt-auto gap-2 flex flex-col">
                    <div className="w-full flex items-center gap-2 mb-2 pt-3">
                       <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                         <span className="text-[10px] font-bold text-primary">{vehicle.seller?.displayName?.charAt(0)}</span>
                       </div>
                       <span className="text-xs font-medium truncate">{vehicle.seller?.displayName || 'Vendedor particular'}</span>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button variant="outline" className="flex-1 text-xs px-2" onClick={() => setDetailVehicle(vehicle)}>
                        Detalles
                      </Button>
                      <Button className="flex-1 text-xs px-2" onClick={() => handleContactClick(vehicle)}>
                        Contactar <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prospectos">
          {leads.length === 0 ? (
            <Card>
               <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
                <Calendar className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">No tienes prospectos activos</h3>
                <p>Usa el Radar para encontrar y contactar vehículos para consignación.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leads.map(lead => (
                <Card key={lead.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                       <div>
                         <CardTitle className="text-lg">{lead.vehicle_nombre}</CardTitle>
                         <CardDescription>Contactado por: {lead.vendedor_nombre || 'Desconocido'}</CardDescription>
                       </div>
                       <Badge variant={lead.estado === 'aceptado' ? 'default' : lead.estado === 'rechazado' ? 'destructive' : 'secondary'}>
                         {String(lead.estado).replace('_', ' ').toUpperCase()}
                       </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm flex-1">
                    <p><strong>Cliente:</strong> {lead.datos_cliente?.displayName || 'N/A'}</p>
                    <p><strong>Teléfono:</strong> {lead.datos_cliente?.phone || 'N/A'}</p>
                  </CardContent>
                  <CardFooter className="flex gap-2 border-t pt-4 bg-muted/20">
                    {lead.estado === 'cita_agendada' && (
                      <>
                        <Button variant="outline" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => updateLeadStatus(lead.id, 'rechazado')}>
                           Rechazar
                        </Button>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateLeadStatus(lead.id, 'aceptado')}>
                           Aceptar Vehículo
                        </Button>
                      </>
                    )}
                    {lead.estado === 'aceptado' && (
                      <Button className="w-full" onClick={() => handleIngresarInventario(lead)}>
                         Ingresar a Inventario
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Appointment Creation Modal */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Cita de Captación</DialogTitle>
            <DialogDescription>
              Programa una fecha para que el dueño traiga su {selectedVehicle?.make} al local, o para que tu equipo lo vaya a inspeccionar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vehículo de interés</Label>
              <div className="font-medium p-3 bg-muted rounded-md border flex items-center gap-3">
                <div className="relative h-10 w-16 bg-muted rounded overflow-hidden">
                   {selectedVehicle?.images?.[0] && <Image src={selectedVehicle.images[0].url} alt="Car" fill className="object-cover" />}
                </div>
                {selectedVehicle?.make} {selectedVehicle?.model} ({selectedVehicle?.year})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input type="date" id="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora</Label>
                <Input type="time" id="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-2 flex gap-2 items-start">
               <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
               Al agendar, serás redirigido a WhatsApp con un mensaje pre-inscrito invitando a {selectedVehicle?.seller?.displayName || 'el dueño'} a traer el carro el día estipulado.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAppointment} disabled={isScheduling}>
              {isScheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar y Avisar por WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailVehicle} onOpenChange={(val) => { if (!val) { setDetailVehicle(null); setShowPrice(false); setIsLightboxOpen(false); } }}>
        <DialogContent className="max-w-[1000px] w-[95vw] h-[95vh] md:h-[90vh] p-0 flex flex-col bg-background">
          {detailVehicle && (() => {
            const mainFeatures: { icon: any; label: string }[] = [];
            if (detailVehicle.hasAC) mainFeatures.push({ icon: Snowflake, label: 'Aire Acondicionado' });
            if (detailVehicle.hasSoundSystem) mainFeatures.push({ icon: Speaker, label: 'Sistema de Sonido' });
            if (detailVehicle.is4x4) {
              const FourByFourIcon = (props: any) => (
               <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15V9l-3 3"/><path d="M4 12h3"/><path d="M11 9l4 6"/><path d="M15 9l-4 6"/><path d="M20 15V9l-3 3"/><path d="M17 12h3"/></svg>
              );
              mainFeatures.push({ icon: FourByFourIcon, label: 'Es 4x4' });
            }
            if (detailVehicle.isArmored) mainFeatures.push({ icon: Shield, label: `Blindado Nivel ${detailVehicle.armorLevel || 'N/A'}` });
            if (detailVehicle.doorCount) mainFeatures.push({ icon: DoorOpen, label: `${detailVehicle.doorCount} puertas` });
            if (detailVehicle.isOperational) mainFeatures.push({ icon: CircleCheck, label: 'Rueda actualmente' });
            if (!detailVehicle.hadMajorCrash) mainFeatures.push({ icon: ShieldCheck, label: 'Sin choques fuertes' });
            if (detailVehicle.isSignatory) mainFeatures.push({ icon: PenSquare, label: 'Dueño es firmante' });
            if (detailVehicle.tireLife > 80) mainFeatures.push({ icon: LifeBuoy, label: 'Cauchos > 80% vida' });
            if (detailVehicle.acceptsTradeIn) {
              mainFeatures.push({ icon: GitCompareArrows, label: 'Acepta cambios' });
              if (detailVehicle.tradeInForLowerValue) mainFeatures.push({ icon: ArrowDownToLine, label: 'Recibe menor valor' });
              if (detailVehicle.tradeInForHigherValue) mainFeatures.push({ icon: ArrowUpFromLine, label: 'Da como parte de pago' });
            }

            return (
              <>
                <DialogHeader className="p-4 bg-background border-b sr-only">
                   <DialogTitle>Detalle del Prospecto</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto">
                  <div className="p-4 md:p-6 lg:p-8 w-full mx-auto">
                    <div className="grid md:grid-cols-3 gap-8 items-start min-w-0">
                      
                      {/* Left Column (Main Content) */}
                      <div className="md:col-span-2 space-y-6 flex flex-col min-w-0">
                        <Carousel className="w-full">
                          <CarouselContent>
                            {detailVehicle.images.map((img, i) => (
                              <CarouselItem key={i}>
                                <div 
                                  className="overflow-hidden rounded-xl border bg-muted flex items-center justify-center p-0 relative aspect-video shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => {
                                    setCurrentLightboxIndex(i);
                                    setIsLightboxOpen(true);
                                  }}
                                >
                                  <Image src={img.url} alt="Vehículo" fill className="object-cover pointer-events-none" />
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          {detailVehicle.images.length > 1 && (
                            <>
                              <CarouselPrevious className="ml-2 md:ml-16 border-2" />
                              <CarouselNext className="mr-2 md:mr-16 border-2" />
                            </>
                          )}
                        </Carousel>

                        {/* Hidden Price Card (Mobile) */}
                        <div className="md:hidden space-y-6">
                           <Card className="shadow-sm">
                             <CardHeader className="pb-3">
                               <h1 className="font-headline text-2xl sm:text-3xl font-bold">{detailVehicle.year} {detailVehicle.make} {detailVehicle.model}</h1>
                               <div className="flex items-center gap-2 pt-1 text-muted-foreground text-sm"><MapPin className="h-4 w-4"/> {detailVehicle.location.city}, {detailVehicle.location.state}</div>
                             </CardHeader>
                             <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-muted/50 border rounded-lg p-4 transition-colors hover:bg-muted">
                                   <div>
                                     <div className="text-sm font-medium text-muted-foreground mb-1">Precio Sugerido</div>
                                     <div className="flex items-center gap-3">
                                       {showPrice ? (
                                         <span className="text-3xl font-bold text-foreground font-headline tracking-tighter">{formatCurrency(calculatedPrice)}</span>
                                       ) : (
                                         <span className="text-3xl font-bold text-muted-foreground/30 font-mono tracking-tighter">****</span>
                                       )}
                                     </div>
                                   </div>
                                   <Button variant="secondary" size="icon" onClick={() => setShowPrice(!showPrice)} className="h-12 w-12 rounded-full shadow-sm" aria-label="Revelar/Ocultar Precio">
                                     <Coins className="h-5 w-5"/>
                                   </Button>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><Gauge className="h-4 w-4 text-muted-foreground shrink-0" /> Kilometraje</span><div className="text-muted-foreground pl-5">{detailVehicle.mileage.toLocaleString()} km</div></div>
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><Palette className="h-4 w-4 text-muted-foreground shrink-0" /> Color</span><div className="text-muted-foreground pl-5">{detailVehicle.exteriorColor}</div></div>
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><Settings2 className="h-4 w-4 text-muted-foreground shrink-0" /> Motor</span><div className="text-muted-foreground pl-5">{detailVehicle.engine}</div></div>
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><svg className="h-4 w-4 text-muted-foreground shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14v14H5V5z" /><path d="M12 5v14" /><path d="M19 12H5" /><path d="M12 12l5-5" /><path d="m7 12 5 5" /></svg> Transmisión</span><div className="text-muted-foreground pl-5">{detailVehicle.transmission}</div></div>
                                </div>
                             </CardContent>
                           </Card>
                        </div>

                        {/* Características */}
                        <Card className="shadow-sm">
                          <CardHeader><CardTitle>Características</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-2">
                             <div className="flex items-center gap-3"><FileText className="h-6 w-6 text-primary shrink-0"/><span className="text-sm">Título {detailVehicle.ownerCount}-1</span></div>
                             {mainFeatures.map(({icon: Icon, label}) => (
                               <div key={label} className="flex items-center gap-3"><Icon className="h-6 w-6 text-primary shrink-0"/><span className="text-sm">{label}</span></div>
                             ))}
                          </CardContent>
                        </Card>
                        
                        <Card className="shadow-sm">
                          <CardHeader><CardTitle>Descripción del Vendedor</CardTitle></CardHeader>
                          <CardContent><p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{detailVehicle.description}</p></CardContent>
                        </Card>
                      </div>

                      {/* Right bar for Desktop */}
                      <div className="hidden md:block md:col-span-1 space-y-6">
                        <div className="sticky top-0 space-y-6">
                           <Card className="shadow-sm">
                             <CardHeader className="pb-3">
                               <h1 className="font-headline text-2xl xl:text-3xl font-bold">{detailVehicle.year} {detailVehicle.make} {detailVehicle.model}</h1>
                               <div className="flex items-center gap-2 pt-1 text-muted-foreground text-sm"><MapPin className="h-4 w-4 shrink-0"/> {detailVehicle.location.city}, {detailVehicle.location.state}</div>
                             </CardHeader>
                             <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-muted/50 border rounded-lg p-4 transition-colors hover:bg-muted">
                                   <div>
                                     <div className="text-sm font-medium text-muted-foreground mb-1">Precio Sugerido</div>
                                     <div className="flex items-center gap-3">
                                       {showPrice ? (
                                         <span className="text-2xl xl:text-3xl font-bold text-foreground font-headline tracking-tighter">{formatCurrency(calculatedPrice)}</span>
                                       ) : (
                                         <span className="text-2xl xl:text-3xl font-bold text-muted-foreground/30 font-mono tracking-tighter">****</span>
                                       )}
                                      </div>
                                   </div>
                                   <Button variant="secondary" size="icon" onClick={() => setShowPrice(!showPrice)} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full shadow-sm shrink-0" aria-label="Revelar/Ocultar Precio">
                                     <Coins className="h-4 w-4 sm:h-5 sm:w-5"/>
                                   </Button>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-sm">
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><Gauge className="h-4 w-4 text-muted-foreground shrink-0" /> Kilometraje</span><div className="text-muted-foreground pl-5 break-words">{detailVehicle.mileage.toLocaleString()} km</div></div>
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><Palette className="h-4 w-4 text-muted-foreground shrink-0" /> Color</span><div className="text-muted-foreground pl-5 break-words">{detailVehicle.exteriorColor}</div></div>
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><Settings2 className="h-4 w-4 text-muted-foreground shrink-0" /> Motor</span><div className="text-muted-foreground pl-5 break-words">{detailVehicle.engine}</div></div>
                                  <div><span className="font-semibold flex items-center gap-1 mb-0.5"><svg className="h-4 w-4 text-muted-foreground shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14v14H5V5z" /><path d="M12 5v14" /><path d="M19 12H5" /><path d="M12 12l5-5" /><path d="m7 12 5 5" /></svg> Transmisión</span><div className="text-muted-foreground pl-5 break-words">{detailVehicle.transmission}</div></div>
                                </div>
                             </CardContent>
                           </Card>

                           <Button className="w-full shadow-sm" size="lg" onClick={() => {
                             setDetailVehicle(null);
                             setShowPrice(false);
                             handleContactClick(detailVehicle);
                           }}>
                             <Calendar className="mr-2 h-4 w-4"/>
                             Agendar Cita de Captación
                           </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Fixed bottom bar for Mobile only */}
                <div className="md:hidden border-t p-4 bg-background z-10 sticky bottom-0">
                   <Button className="w-full shadow-sm" size="lg" onClick={() => {
                     setDetailVehicle(null);
                     setShowPrice(false);
                     handleContactClick(detailVehicle);
                   }}>
                     <Calendar className="mr-2 h-4 w-4"/>
                     Agendar Cita de Captación
                   </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Ingresar a Inventario Modal */}
      <Dialog open={!!leadToIngresar} onOpenChange={(val) => { if (!val) setLeadToIngresar(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ingresar a Inventario</DialogTitle>
            <DialogDescription>
              Configura los montos acordados con el dueño antes de publicar {leadToIngresar?.vehicle_nombre} en tu inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Precio Acordado a Pagar al Dueño ($)</Label>
              <Input 
                type="number" 
                value={ingresoData.costoCompra || ''} 
                onChange={e => setIngresoData({...ingresoData, costoCompra: Number(e.target.value)})}
                placeholder="Ej. 12000"
              />
            </div>
            <div className="space-y-2">
              <Label>Tu Margen de Consignación (%)</Label>
              <Input 
                type="number" 
                value={ingresoData.comisionPorcentaje || ''} 
                onChange={e => setIngresoData({...ingresoData, comisionPorcentaje: Number(e.target.value)})}
              />
              <p className="text-xs text-muted-foreground">Tu margen configurado por defecto es {concesionario?.configuracion?.margen_consignacion_porcentaje || 15}%</p>
            </div>
            
            <div className="bg-muted p-4 rounded-lg flex justify-between items-center mt-4 border border-primary/20">
               <span className="font-medium text-sm">Precio Público Sugerido:</span>
               <span className="text-2xl font-bold font-headline text-primary">
                 {formatCurrency(Number(ingresoData.costoCompra) + (Number(ingresoData.costoCompra) * Number(ingresoData.comisionPorcentaje) / 100))}
               </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadToIngresar(null)} disabled={isIngresando}>
              Cancelar
            </Button>
            <Button onClick={confirmIngresoInventario} disabled={isIngresando || !ingresoData.costoCompra}>
              {isIngresando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Ingreso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ImageLightbox
        images={detailVehicle?.images || []}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        initialIndex={currentLightboxIndex}
      />
    </div>
  );
}
