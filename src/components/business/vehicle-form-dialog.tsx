'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Plus, X, Upload, ImagePlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type {
  StockVehicle,
  StockStatus,
  GastoAdecuacion,
  GastoCategoria,
} from '@/lib/business-types';
import { GASTO_CATEGORIA_LABELS } from '@/lib/business-types';
import { formatCurrency } from '@/lib/utils';
import { fallbackData } from '@/lib/makes-fallback-data';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVehicle: StockVehicle | null;
  concesionarioId: string;
  onSave: () => void;
}

const BODY_TYPES = ['Sedán', 'SUV', 'Pickup', 'Hatchback', 'Coupé', 'Van', 'Camioneta', 'Otro'];
const COLORS = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Marrón', 'Dorado', 'Naranja', 'Amarillo', 'Beige', 'Otro'];

export function VehicleFormDialog({ open, onOpenChange, editingVehicle, concesionarioId, onSave }: VehicleFormDialogProps) {
  const { canSeeCosts, staffList } = useBusinessAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

  // Vehicle fields
  const [vehicleType, setVehicleType] = useState<string>('Carro');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [bodyType, setBodyType] = useState('');
  const [transmission, setTransmission] = useState<'Automática' | 'Sincrónica'>('Sincrónica');
  const [engine, setEngine] = useState('');
  const [exteriorColor, setExteriorColor] = useState('');
  const [mileage, setMileage] = useState(0);
  const [description, setDescription] = useState('');
  const [estadoStock, setEstadoStock] = useState<StockStatus>('privado_taller');

  // Costs
  const [costoCompra, setCostoCompra] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [gastos, setGastos] = useState<GastoAdecuacion[]>([]);
  const [newGastoCategoria, setNewGastoCategoria] = useState<GastoCategoria>('mecanica');
  const [newGastoDescripcion, setNewGastoDescripcion] = useState('');
  const [newGastoMonto, setNewGastoMonto] = useState(0);

  // Consignment
  const [esConsignacion, setEsConsignacion] = useState(false);
  const [consignacionVendedorId, setConsignacionVendedorId] = useState('');
  const [consignacionComision, setConsignacionComision] = useState(10);

  // Assignment
  const [asignadoA, setAsignadoA] = useState('');

  // Images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<{ url: string; alt: string }[]>([]);

  // Market price
  const [marketPrice, setMarketPrice] = useState<{ message: string; found: boolean } | null>(null);

  // Makes/Models
  const makes = useMemo(() => {
    if (!vehicleType) return [];
    const typeData = fallbackData[vehicleType as keyof typeof fallbackData];
    if (!typeData) return [];
    return Object.keys(typeData).sort();
  }, [vehicleType]);

  const models = useMemo(() => {
    if (!make || !vehicleType) return [];
    const typeData = fallbackData[vehicleType as keyof typeof fallbackData];
    if (!typeData || !typeData[make]) return [];
    return Array.from(typeData[make]).sort();
  }, [make, vehicleType]);

  // Year options
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear() + 1;
    return Array.from({ length: 50 }, (_, i) => currentYear - i);
  }, []);

  // Sellers from staff
  const vendedores = useMemo(() =>
    staffList.filter(s => s.activo && (s.rol === 'vendedor' || s.rol === 'encargado' || s.rol === 'dueno')),
    [staffList]
  );

  // Total calculations
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
  const totalInvertido = costoCompra + totalGastos;
  const gananciaNeta = precioVenta - totalInvertido;

  // Load editing data
  useEffect(() => {
    if (editingVehicle) {
      setVehicleType(editingVehicle.vehicleType || 'Carro');
      setMake(editingVehicle.make || '');
      setModel(editingVehicle.model || '');
      setYear(editingVehicle.year || new Date().getFullYear());
      setBodyType(editingVehicle.bodyType || '');
      setTransmission(editingVehicle.transmission || 'Sincrónica');
      setEngine(editingVehicle.engine || '');
      setExteriorColor(editingVehicle.exteriorColor || '');
      setMileage(editingVehicle.mileage || 0);
      setDescription(editingVehicle.description || '');
      setEstadoStock(editingVehicle.estado_stock || 'privado_taller');
      setCostoCompra(editingVehicle.costo_compra || 0);
      setPrecioVenta(editingVehicle.precio_venta || 0);
      setGastos(editingVehicle.gastos_adecuacion || []);
      setEsConsignacion(editingVehicle.es_consignacion || false);
      setConsignacionVendedorId(editingVehicle.consignacion_info?.vendedor_particular_id || '');
      setConsignacionComision(editingVehicle.consignacion_info?.comision_acordada || 10);
      setAsignadoA(editingVehicle.asignado_a || '');
      setExistingImages(editingVehicle.images || []);
    } else {
      // Reset all fields
      setVehicleType('Carro');
      setMake('');
      setModel('');
      setYear(new Date().getFullYear());
      setBodyType('');
      setTransmission('Sincrónica');
      setEngine('');
      setExteriorColor('');
      setMileage(0);
      setDescription('');
      setEstadoStock('privado_taller');
      setCostoCompra(0);
      setPrecioVenta(0);
      setGastos([]);
      setEsConsignacion(false);
      setConsignacionVendedorId('');
      setConsignacionComision(10);
      setAsignadoA('');
      setExistingImages([]);
      setImageFiles([]);
      setImagePreviews([]);
      setMarketPrice(null);
    }
  }, [editingVehicle, open]);

  // Fetch market price when make/model/year change
  useEffect(() => {
    if (!make || !model) {
      setMarketPrice(null);
      return;
    }
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/vehicle-market-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ make, model, year }),
        });
        const data = await res.json();
        setMarketPrice(data);
      } catch {
        setMarketPrice(null);
      }
    };
    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [make, model, year]);

  // AI Auto-fill
  const handleAIFill = async () => {
    if (!make || !model || !year) {
      toast({ title: 'Datos incompletos', description: 'Selecciona marca, modelo y año primero.', variant: 'destructive' });
      return;
    }
    setIsAILoading(true);
    try {
      const res = await fetch('/api/vehicle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleType, make, model, year }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (data.engine) setEngine(data.engine);
      if (data.bodyType) setBodyType(data.bodyType);
      if (data.transmission) setTransmission(data.transmission);
      if (data.description) setDescription(data.description);
      if (data.doorCount) {
        // doorCount handled if needed
      }

      toast({ title: '✨ IA completó los datos', description: 'Revisa los campos auto-rellenados.' });
    } catch (error) {
      console.error('[AI Fill] Error:', error);
      toast({ title: 'Error de IA', description: 'No se pudo obtener información del vehículo.', variant: 'destructive' });
    } finally {
      setIsAILoading(false);
    }
  };

  // Add expense
  const addGasto = () => {
    if (newGastoMonto <= 0) return;
    setGastos([...gastos, {
      categoria: newGastoCategoria,
      descripcion: newGastoDescripcion.trim(),
      monto: newGastoMonto,
    }]);
    setNewGastoDescripcion('');
    setNewGastoMonto(0);
  };

  const removeGasto = (index: number) => {
    setGastos(gastos.filter((_, i) => i !== index));
  };

  // Image handling
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImageFiles(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const removeNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  // Save
  const handleSave = async () => {
    if (!make || !model || !year) {
      toast({ title: 'Datos incompletos', description: 'Marca, modelo y año son obligatorios.', variant: 'destructive' });
      return;
    }
    if (!concesionarioId) return;

    setIsSaving(true);
    try {
      // Upload new images
      const uploadedImages: { url: string; alt: string }[] = [...existingImages];

      if (imageFiles.length > 0) {
        const vehicleId = editingVehicle?.id || `temp_${Date.now()}`;
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const imageName = `${Date.now()}_${i}_${file.name}`;
          const imageRef = ref(storage, `business-assets/${concesionarioId}/inventario/${vehicleId}/${imageName}`);
          await uploadBytes(imageRef, file);
          const url = await getDownloadURL(imageRef);
          uploadedImages.push({
            url,
            alt: `${year} ${make} ${model} - Foto ${uploadedImages.length + 1}`,
          });
        }
      }

      const vehicleData: Omit<StockVehicle, 'id' | 'created_at'> & { created_at?: any; updated_at?: any } = {
        vehicleType,
        make,
        model,
        year,
        bodyType,
        transmission,
        engine,
        exteriorColor,
        mileage,
        description,
        images: uploadedImages,
        estado_stock: estadoStock,
        costo_compra: costoCompra,
        gastos_adecuacion: gastos,
        precio_venta: precioVenta,
        ganancia_neta_estimada: gananciaNeta,
        es_consignacion: esConsignacion,
        ...(esConsignacion ? {
          consignacion_info: {
            vendedor_particular_id: consignacionVendedorId,
            comision_acordada: consignacionComision,
          },
        } : {}),
        ...(asignadoA ? { asignado_a: asignadoA } : {}),
        updated_at: serverTimestamp(),
      };

      if (editingVehicle) {
        const docRef = doc(firestore, 'concesionarios', concesionarioId, 'inventario', editingVehicle.id);
        await updateDoc(docRef, vehicleData);
        toast({ title: '¡Actualizado!', description: 'El vehículo fue actualizado correctamente.' });
      } else {
        vehicleData.created_at = serverTimestamp();
        const colRef = collection(firestore, 'concesionarios', concesionarioId, 'inventario');
        await addDoc(colRef, vehicleData);
        toast({ title: '¡Agregado!', description: 'El vehículo fue agregado al inventario.' });
      }

      onOpenChange(false);
      onSave();
    } catch (error) {
      console.error('[VehicleForm] Error saving:', error);
      toast({
        title: 'Error al guardar',
        description: 'Ocurrió un error. Verifica tu conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-headline">
            {editingVehicle ? 'Editar Vehículo' : 'Agregar Vehículo'}
          </DialogTitle>
          <DialogDescription>
            {editingVehicle ? 'Modifica los datos del vehículo.' : 'Registra un nuevo vehículo en el inventario.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="datos" className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="datos">Datos</TabsTrigger>
            <TabsTrigger value="costos">Costos</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
          </TabsList>

          {/* TAB 1: Vehicle Data */}
          <TabsContent value="datos" className="space-y-4 mt-4">
            {/* AI Button */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <Sparkles className="h-5 w-5 text-purple-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Auto-rellenar con IA</p>
                <p className="text-xs text-muted-foreground">Selecciona marca, modelo y año, luego presiona el botón.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAIFill}
                disabled={isAILoading || !make || !model}
                className="shrink-0"
              >
                {isAILoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Cargando...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Rellenar</>
                )}
              </Button>
            </div>

            {/* Market price reference */}
            {marketPrice?.found && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm">
                  📊 <span className="font-medium">{marketPrice.message}</span>
                </p>
              </div>
            )}

            {/* Make + Model + Year */}
            <div className="space-y-3">
              <div className="space-y-1.5 w-1/3 pr-1">
                <Label>Tipo de Vehículo *</Label>
                <Select value={vehicleType} onValueChange={(v) => { setVehicleType(v); setMake(''); setModel(''); }}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(fallbackData).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Marca *</Label>
                  <Select value={make} onValueChange={(v) => { setMake(v); setModel(''); }}>
                  <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {makes.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Modelo *</Label>
                <Select value={model} onValueChange={setModel} disabled={!make}>
                  <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {models.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Año *</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Body type + Transmission */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Carrocería</Label>
                <Select value={bodyType} onValueChange={setBodyType}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {BODY_TYPES.map(bt => (
                      <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Transmisión</Label>
                <Select value={transmission} onValueChange={(v) => setTransmission(v as 'Automática' | 'Sincrónica')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sincrónica">Sincrónica</SelectItem>
                    <SelectItem value="Automática">Automática</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Engine + Color + Mileage */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Motor</Label>
                <Input value={engine} onChange={e => setEngine(e.target.value)} placeholder="Ej: 1.8L 4 cil." />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Select value={exteriorColor} onValueChange={setExteriorColor}>
                  <SelectTrigger><SelectValue placeholder="Color" /></SelectTrigger>
                  <SelectContent>
                    {COLORS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kilometraje</Label>
                <Input type="number" min={0} value={mileage} onChange={e => setMileage(Number(e.target.value))} />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descripción del vehículo..."
                rows={3}
              />
            </div>

            {/* Estado + Asignar a */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={estadoStock} onValueChange={(v) => setEstadoStock(v as StockStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="privado_taller">En Taller</SelectItem>
                    <SelectItem value="publico_web">Publicado</SelectItem>
                    <SelectItem value="reservado">Reservado</SelectItem>
                    <SelectItem value="vendido">Vendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Asignar a Vendedor</Label>
                <Select value={asignadoA || 'none'} onValueChange={(v) => setAsignadoA(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {vendedores.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Consignment toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Es Consignación</Label>
                <p className="text-xs text-muted-foreground">Vehículo de un vendedor particular</p>
              </div>
              <Switch checked={esConsignacion} onCheckedChange={setEsConsignacion} />
            </div>
            {esConsignacion && (
              <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-purple-500/30">
                <div className="space-y-1.5">
                  <Label>ID Vendedor Particular</Label>
                  <Input value={consignacionVendedorId} onChange={e => setConsignacionVendedorId(e.target.value)} placeholder="ID o nombre" />
                </div>
                <div className="space-y-1.5">
                  <Label>Comisión Acordada (%)</Label>
                  <Input type="number" min={0} max={100} value={consignacionComision} onChange={e => setConsignacionComision(Number(e.target.value))} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Costs */}
          <TabsContent value="costos" className="space-y-4 mt-4">
            {!canSeeCosts ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No tienes permisos para ver los costos.
              </div>
            ) : (
              <>
                {/* Purchase cost + Sale price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Costo de Compra ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={costoCompra}
                      onChange={e => setCostoCompra(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Precio de Venta ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={precioVenta}
                      onChange={e => setPrecioVenta(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                </div>

                {/* Market price reference */}
                {marketPrice?.found && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-sm">
                      📊 <span className="font-medium">{marketPrice.message}</span>
                    </p>
                  </div>
                )}

                {/* Expenses list */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Gastos de Adecuación</Label>

                  {gastos.length > 0 && (
                    <div className="space-y-2">
                      {gastos.map((gasto, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {GASTO_CATEGORIA_LABELS[gasto.categoria]}
                          </Badge>
                          <span className="text-sm flex-1 truncate">{gasto.descripcion || '—'}</span>
                          <span className="text-sm font-semibold shrink-0">{formatCurrency(gasto.monto)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive"
                            onClick={() => removeGasto(i)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add expense */}
                  <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Categoría</Label>
                      <Select value={newGastoCategoria} onValueChange={(v) => setNewGastoCategoria(v as GastoCategoria)}>
                        <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(GASTO_CATEGORIA_LABELS) as GastoCategoria[]).map(cat => (
                            <SelectItem key={cat} value={cat}>{GASTO_CATEGORIA_LABELS[cat]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descripción</Label>
                      <Input
                        placeholder="Ej: Cambio de motor..."
                        value={newGastoDescripcion}
                        onChange={e => setNewGastoDescripcion(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Monto ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newGastoMonto}
                        onChange={e => setNewGastoMonto(Number(e.target.value))}
                        className="h-9 text-sm w-24"
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={addGasto} className="h-9">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Summary */}
                <div className="p-4 rounded-lg border bg-card space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Costo de compra</span>
                    <span>{formatCurrency(costoCompra)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gastos de adecuación ({gastos.length})</span>
                    <span>{formatCurrency(totalGastos)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-1 border-t">
                    <span>Total invertido</span>
                    <span>{formatCurrency(totalInvertido)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Precio de venta</span>
                    <span>{formatCurrency(precioVenta)}</span>
                  </div>
                  <div className={`flex justify-between text-base font-bold pt-1 border-t ${gananciaNeta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <span>Ganancia estimada</span>
                    <span>{gananciaNeta >= 0 ? '+' : ''}{formatCurrency(gananciaNeta)}</span>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* TAB 3: Photos */}
          <TabsContent value="fotos" className="space-y-4 mt-4">
            {/* Existing images */}
            {existingImages.length > 0 && (
              <div className="space-y-2">
                <Label>Fotos actuales</Label>
                <div className="grid grid-cols-3 gap-2">
                  {existingImages.map((img, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border group">
                      <Image src={img.url} alt={img.alt} fill className="object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeExistingImage(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New image previews */}
            {imagePreviews.length > 0 && (
              <div className="space-y-2">
                <Label>Nuevas fotos</Label>
                <div className="grid grid-cols-3 gap-2">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border group">
                      <Image src={preview} alt={`Preview ${i + 1}`} fill className="object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeNewImage(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload button */}
            <label className="cursor-pointer">
              <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click para agregar fotos</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          </TabsContent>
        </Tabs>

        {/* Save button */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              editingVehicle ? 'Guardar Cambios' : 'Agregar al Inventario'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
