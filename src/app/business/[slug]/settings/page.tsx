'use client';

import { useState, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage } from '@/firebase';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { GeoPoint } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Upload, Plus, X, Building2, MapPin, LocateFixed } from 'lucide-react';
import Image from 'next/image';

export default function SettingsPage() {
  const { concesionario, hasPermission, loadConcesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Form fields
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rif, setRif] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [margenMinimo, setMargenMinimo] = useState(10);
  const [estructuraComision, setEstructuraComision] = useState(5);
  const [margenConsignacion, setMargenConsignacion] = useState(15);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [nuevoMetodo, setNuevoMetodo] = useState('');

  // Location
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 10.4806, lng: -66.9036 }); // Caracas default

  const permission = hasPermission('settings');

  // Load initial values
  useEffect(() => {
    if (!concesionario) return;
    setNombreEmpresa(concesionario.nombre_empresa || '');
    setRif(concesionario.rif || '');
    setDireccion(concesionario.direccion || '');
    setTelefono(concesionario.telefono || '');
    setEmail(concesionario.email || '');
    setLogoPreview(concesionario.logo_url || null);
    setBannerPreview(concesionario.banner_url || null);
    if (concesionario.configuracion) {
      setMargenMinimo(concesionario.configuracion.margen_minimo || 10);
      setEstructuraComision(concesionario.configuracion.estructura_comision || 5);
      setMargenConsignacion(concesionario.configuracion.margen_consignacion_porcentaje || 15);
      const mp = concesionario.configuracion.metodos_pago;
      setMetodosPago(Array.isArray(mp) ? mp : typeof mp === 'string' ? (mp as string).split(',').map(s => s.trim()) : []);
    }
    if (concesionario.geolocalizacion) {
      const pos = { lat: concesionario.geolocalizacion.latitude, lng: concesionario.geolocalizacion.longitude };
      setMarkerPos(pos);
      setMapCenter(pos);
    }
  }, [concesionario]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const addMetodoPago = () => {
    const trimmed = nuevoMetodo.trim();
    if (trimmed && !metodosPago.includes(trimmed)) {
      setMetodosPago([...metodosPago, trimmed]);
      setNuevoMetodo('');
    }
  };

  const removeMetodoPago = (metodo: string) => {
    setMetodosPago(metodosPago.filter(m => m !== metodo));
  };

  const handleSave = async () => {
    if (!concesionario) return;
    setIsSaving(true);

    try {
      let logoUrl = concesionario.logo_url || '';
      let bannerUrl = concesionario.banner_url || '';

      // Upload logo if changed
      if (logoFile) {
        const logoRef = ref(storage, `business-assets/${concesionario.id}/logo.png`);
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
      }

      // Upload banner if changed
      if (bannerFile) {
        const bannerRef = ref(storage, `business-assets/${concesionario.id}/banner.png`);
        await uploadBytes(bannerRef, bannerFile);
        bannerUrl = await getDownloadURL(bannerRef);
      }

      const docRef = doc(firestore, 'concesionarios', concesionario.id);
      await updateDoc(docRef, {
        nombre_empresa: nombreEmpresa,
        rif,
        direccion,
        telefono,
        email,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        geolocalizacion: markerPos ? new GeoPoint(markerPos.lat, markerPos.lng) : null,
        configuracion: {
          margen_minimo: margenMinimo,
          estructura_comision: estructuraComision,
          margen_consignacion_porcentaje: margenConsignacion,
          metodos_pago: metodosPago,
        },
      });

      // Reload concesionario data
      await loadConcesionario(concesionario.slug);

      toast({ title: '¡Guardado!', description: 'La configuración se actualizó correctamente.' });
    } catch (error: any) {
      console.error('[Settings] Error saving:', error);
      toast({
        title: 'Error al guardar',
        description: error.message || 'Ocurrió un error. Verifica tu conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Configuración</h1>
        <p className="text-muted-foreground mt-1">Gestiona la información de tu empresa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Empresa</CardTitle>
            <CardDescription>Datos generales del concesionario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Branding: Logo & Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Logo */}
              <div className="space-y-2">
                <Label>Logo del Concesionario</Label>
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 rounded-xl overflow-hidden bg-muted border-2 border-dashed border-border shrink-0">
                    {logoPreview ? (
                      <Image src={logoPreview} alt="Logo" fill className="object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Building2 className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {!isReadOnly && (
                    <div className="space-y-2">
                      <label className="cursor-pointer block">
                        <Button variant="outline" size="sm" asChild className="w-full">
                          <span>
                            <Upload className="h-3.5 w-3.5 mr-2" />
                            Subir Logo
                          </span>
                        </Button>
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      </label>
                      <p className="text-[10px] text-muted-foreground leading-tight">Usa una imagen cuadrada (1:1) de al menos 400x400px.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Banner */}
              <div className="space-y-2">
                <Label>Banner / Portada</Label>
                <div className="flex flex-col gap-2">
                  <div className="relative h-24 w-full rounded-xl overflow-hidden bg-muted border-2 border-dashed border-border group">
                    {bannerPreview ? (
                      <Image src={bannerPreview} alt="Banner" fill className="object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto mb-1 opacity-50" />
                          <p className="text-[10px]">Sin Portada</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {!isReadOnly && (
                    <div className="flex items-center justify-between gap-4">
                      <label className="cursor-pointer flex-1">
                        <Button variant="outline" size="sm" asChild className="w-full">
                          <span>
                            <Upload className="h-3.5 w-3.5 mr-2" />
                            Subir Banner
                          </span>
                        </Button>
                        <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                      </label>
                      <p className="text-[10px] text-muted-foreground flex-1 leading-tight">Imagen alargada (16:9 o 3:1). Se usará de fondo en tu perfil.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la Empresa</Label>
              <Input id="nombre" value={nombreEmpresa} onChange={e => setNombreEmpresa(e.target.value)} disabled={isReadOnly} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rif">RIF</Label>
              <Input id="rif" value={rif} onChange={e => setRif(e.target.value)} disabled={isReadOnly} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección Fiscal</Label>
              <Input id="direccion" value={direccion} onChange={e => setDireccion(e.target.value)} disabled={isReadOnly} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" value={telefono} onChange={e => setTelefono(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>

             {/* GPS Map */}
             <div className="space-y-3 pt-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Ubicación del Local (GPS)
              </Label>
              <div className="h-64 bg-muted rounded-xl overflow-hidden border relative group">
                <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                  <Map
                    defaultCenter={mapCenter}
                    defaultZoom={15}
                    mapId="business_settings_map"
                    onClick={(e) => !isReadOnly && e.detail.latLng && setMarkerPos({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng })}
                    gestureHandling={'greedy'}
                    disableDefaultUI={isReadOnly}
                  >
                    {markerPos && (
                      <AdvancedMarker position={markerPos}>
                        <Pin background={'#ef4444'} glyphColor={'#fff'} borderColor={'#7f1d1d'} />
                      </AdvancedMarker>
                    )}
                  </Map>
                </APIProvider>
                {!isReadOnly && (
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg text-[10px] text-center font-medium shadow-sm transition-opacity group-hover:opacity-100 pointer-events-none">
                    Haz clic en el mapa para marcar la ubicación exacta de tu negocio
                  </div>
                )}
              </div>
              {markerPos && (
                 <p className="text-[10px] text-muted-foreground">
                   Coordenadas: {markerPos.lat.toFixed(6)}, {markerPos.lng.toFixed(6)}
                 </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Business Config */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Negocio</CardTitle>
            <CardDescription>Parámetros financieros y operativos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="margen">Margen Mínimo de Ganancia (%)</Label>
              <Input
                id="margen"
                type="number"
                min={0}
                max={100}
                value={margenMinimo}
                onChange={e => setMargenMinimo(Number(e.target.value))}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">El sistema alertará si una venta está por debajo de este margen.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comision">Comisión Vendedor por Defecto (%)</Label>
              <Input
                id="comision"
                type="number"
                min={0}
                max={100}
                value={estructuraComision}
                onChange={e => setEstructuraComision(Number(e.target.value))}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">Comisión que se asigna automáticamente a nuevos vendedores.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="margenConsignacion">Porcentaje Ganancia Consignación (%)</Label>
              <Input
                id="margenConsignacion"
                type="number"
                min={0}
                max={500}
                value={margenConsignacion}
                onChange={e => setMargenConsignacion(Number(e.target.value))}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">Este porcentaje se suma al precio original del dueño cuando le muestras el vehículo a un cliente.</p>
            </div>

            {/* Payment Methods */}
            <div className="space-y-2">
              <Label>Métodos de Pago Aceptados</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {metodosPago.map(metodo => (
                  <Badge key={metodo} variant="secondary" className="gap-1 pl-3 pr-1 py-1">
                    {metodo}
                    {!isReadOnly && (
                      <button onClick={() => removeMetodoPago(metodo)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {metodosPago.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay métodos de pago configurados.</p>
                )}
              </div>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nuevo método (ej: Zelle)"
                    value={nuevoMetodo}
                    onChange={e => setNuevoMetodo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMetodoPago())}
                  />
                  <Button variant="outline" size="icon" onClick={addMetodoPago} type="button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save button */}
      {!isReadOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
