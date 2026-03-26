'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Car, User, DollarSign, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Search, Info } from 'lucide-react';
import type { StockVehicle, StaffMember } from '@/lib/business-types';
import { ROLE_LABELS } from '@/lib/business-types';
import { cn } from '@/lib/utils';

interface SaleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concesionarioId: string;
  onSave: () => void;
}

type Step = 'select' | 'negotiate' | 'client';

export function SaleFormDialog({ open, onOpenChange, concesionarioId, onSave }: SaleFormDialogProps) {
  const { concesionario, staff, currentRole, staffList } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('select');
  const [availableVehicles, setAvailableVehicles] = useState<StockVehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [precioVenta, setPrecioVenta] = useState<number | ''>('');
  
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorCedula, setCompradorCedula] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [registrarCaja, setRegistrarCaja] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const selectedVehicle = useMemo(() => 
    availableVehicles.find(v => v.id === selectedVehicleId),
    [availableVehicles, selectedVehicleId]
  );

  // Load available vehicles (excluding SOLD)
  useEffect(() => {
    if (!open || !concesionarioId) return;

    const fetchVehicles = async () => {
      setIsLoadingVehicles(true);
      try {
        // Query vehicles that are NOT sold (includes talleres, reservado, etc)
        const q = query(
          collection(firestore, 'concesionarios', concesionarioId, 'inventario'),
          where('estado_stock', '!=', 'vendido')
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockVehicle));
        setAvailableVehicles(data);
      } catch (error) {
        console.error('[SaleForm] Error fetching vehicles:', error);
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    fetchVehicles();
    
    // Reset process
    setStep('select');
    setSelectedVehicleId('');
    setPrecioVenta('');
    setCompradorNombre('');
    setCompradorCedula('');
    setCompradorTelefono('');
    setMetodoPago('');
    setRegistrarCaja(true);
    
    if (currentRole === 'vendedor' && staff) {
      setVendedorId(staff.id);
    } else {
      setVendedorId('');
    }
  }, [open, concesionarioId, currentRole, staff, firestore]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return availableVehicles;
    return availableVehicles.filter(v => 
      `${v.make} ${v.model} ${v.placa || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableVehicles, searchQuery]);

  // Margin logic
  const negotiationInfo = useMemo(() => {
    if (!selectedVehicle) return null;
    
    const costoCompra = selectedVehicle.costo_compra || 0;
    const gastosSuma = (selectedVehicle.gastos_adecuacion || []).reduce((acc, g) => acc + (g.monto || 0), 0);
    const totalCost = costoCompra + gastosSuma;
    
    const currentPrice = Number(precioVenta) || 0;
    const minMargin = (concesionario?.configuracion.margen_minimo || 0) / 100;
    
    // Find selected seller commission
    let sellerComPercent = (concesionario?.configuracion.estructura_comision || 0) / 100;
    if (vendedorId) {
      const v = staffList.find(s => s.id === vendedorId);
      if (v && v.comision_porcentaje != null) sellerComPercent = v.comision_porcentaje / 100;
    }

    const targetNetProfit = totalCost * (1 + minMargin);
    const minPriceForMargin = targetNetProfit / (1 - sellerComPercent);
    const breakEvenPrice = totalCost / (1 - sellerComPercent);
    
    let status: 'ok' | 'low' | 'very_low' | 'critical' = 'ok';
    let message = '';
    
    if (currentPrice > 0) {
      if (currentPrice < breakEvenPrice) {
        status = 'critical';
        message = '¡ALERTA!: Precio genera pérdida total (incluyendo comisión)';
      } else if (currentPrice < minPriceForMargin) {
        const diffPercent = (minPriceForMargin - currentPrice) / minPriceForMargin;
        if (diffPercent > 0.05) {
          status = 'very_low';
          message = 'Precio muy bajo (supera límite de margen configurado)';
        } else {
          status = 'low';
          message = 'Precio bajo (cerca del límite de margen)';
        }
      }
    }

    return { totalCost, minPriceForMargin, breakEvenPrice, status, message };
  }, [selectedVehicle, precioVenta, concesionario, vendedorId, staffList]);

  const handleNext = () => {
    if (step === 'select' && selectedVehicleId) {
      setStep('negotiate');
      if (selectedVehicle?.precio_venta) {
        setPrecioVenta(selectedVehicle.precio_venta);
      }
    } else if (step === 'negotiate' && precioVenta && vendedorId) {
      // Restriction: Only owner/encargado can sell at loss
      if (negotiationInfo?.status === 'critical') {
        const canOverride = currentRole === 'dueno' || currentRole === 'encargado';
        if (!canOverride) {
          toast({
            title: 'Venta Bloqueada',
            description: 'No tienes autorización para registrar una venta con pérdida total. Solo el Dueño o Encargado pueden autorizar este precio.',
            variant: 'destructive'
          });
          return;
        }
      }
      setStep('client');
    } else if (step === 'negotiate' && !vendedorId) {
      toast({ title: 'Vendedor requerido', description: 'Selecciona al vendedor que realiza la operación.', variant: 'destructive' });
    }
  };

  const handleBack = () => {
    if (step === 'negotiate') setStep('select');
    if (step === 'client') setStep('negotiate');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVehicleId || !compradorNombre || !precioVenta || !metodoPago || !vendedorId) {
      toast({ title: 'Faltan datos', description: 'Completa todos los campos obligatorios.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const vehicle = selectedVehicle!;

      // Determine seller commission rate
      let sellerCommissionRate = concesionario?.configuracion.estructura_comision || 0;
      let vendedorNombre = 'Desconocido';
      const vStaff = staffList.find(s => s.id === vendedorId);
      if (vStaff) {
        vendedorNombre = vStaff.nombre;
        if (vStaff.comision_porcentaje != null) sellerCommissionRate = vStaff.comision_porcentaje;
      }

      const salePrice = Number(precioVenta);
      const comisionCalculada = (salePrice * sellerCommissionRate) / 100;
      
      // Calculate final profit
      let gananciaNeta = 0;
      if (vehicle.es_consignacion) {
        const businessComm = (vehicle.consignacion_info?.comision_acordada || 0) / 100 * salePrice;
        gananciaNeta = businessComm - comisionCalculada;
      } else {
        const totalBasis = (vehicle.costo_compra || 0) + (vehicle.gastos_adecuacion || []).reduce((acc, g) => acc + (g.monto || 0), 0);
        gananciaNeta = salePrice - totalBasis - comisionCalculada;
      }

      const ventaData = {
        vehiculo_id: vehicle.id,
        vehiculo_nombre: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.placa ? `(${vehicle.placa})` : ''}`,
        comprador_nombre: compradorNombre,
        comprador_telefono: compradorTelefono,
        comprador_cedula: compradorCedula,
        vendedor_staff_id: vendedorId,
        vendedor_nombre: vendedorNombre,
        precio_venta: salePrice,
        metodo_pago: metodoPago,
        comision_vendedor: comisionCalculada,
        ganancia_neta: gananciaNeta,
        fecha: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'ventas'), ventaData);
      // 1. Update vehicle status
      const vehicleRef = doc(firestore, 'concesionarios', concesionarioId, 'inventario', selectedVehicle.id);
      await updateDoc(vehicleRef, {
        estado_stock: 'vendido',
        updated_at: serverTimestamp()
      });

      if (registrarCaja && staff) {
        await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'caja'), {
          tipo: 'ingreso',
          monto: salePrice,
          descripcion: `Venta: ${ventaData.vehiculo_nombre}`,
          metodo_pago: metodoPago,
          cajero_staff_id: staff.id,
          cajero_nombre: staff.nombre,
          fecha: serverTimestamp(),
        });
      }

      toast({ title: '¡Negocio Cerrado!', description: `Venta de ${ventaData.vehiculo_nombre} registrada.` });
      onOpenChange(false);
      onSave();

    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo guardar la venta.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const metodosPago = concesionario?.configuracion?.metodos_pago || ['Efectivo', 'Zelle'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        {/* Header with Visual Steps */}
        <div className="bg-primary/5 p-6 border-b">
          <div className="flex items-center justify-between mb-6">
            <div>
              <DialogTitle className="text-2xl font-headline flex items-center gap-2">
                <ReceiptIcon className="h-6 w-6 text-primary" />
                Registrar Venta
              </DialogTitle>
              <DialogDescription>
                Flujo de negociación y cierre de negocio
              </DialogDescription>
            </div>
            <div className="flex gap-1">
              <div className={cn("w-2 h-2 rounded-full", step === 'select' ? "bg-primary" : "bg-primary/20")} />
              <div className={cn("w-2 h-2 rounded-full", step === 'negotiate' ? "bg-primary" : "bg-primary/20")} />
              <div className={cn("w-2 h-2 rounded-full", step === 'client' ? "bg-primary" : "bg-primary/20")} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: SELECT VEHICLE */}
          {step === 'select' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por marca, modelo o placa..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                {isLoadingVehicles ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredVehicles.length === 0 ? (
                  <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/50">
                    <Car className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-30" />
                    <p className="text-muted-foreground">No se encontraron vehículos disponibles.</p>
                  </div>
                ) : (
                  filteredVehicles.map(v => (
                    <div 
                      key={v.id}
                      onClick={() => setSelectedVehicleId(v.id)}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01]",
                        selectedVehicleId === v.id 
                          ? "border-primary bg-primary/5 shadow-md" 
                          : "border-transparent bg-muted/40 hover:bg-muted/60"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-16 bg-muted rounded overflow-hidden flex-shrink-0 border shadow-sm">
                          {v.images?.[0]?.url ? (
                            <img src={v.images[0].url} alt={v.make} className="w-full h-full object-cover" />
                          ) : (
                            <Car className="h-full w-full p-2 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold">{v.year} {v.make} {v.model}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="uppercase font-mono bg-muted-foreground/10 px-1.5 py-0.5 rounded text-[10px] tracking-wider">
                              {v.placa || 'SIN PLACA'}
                            </span>
                            <span>•</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-full text-[10px]",
                              v.estado_stock === 'publico_web' ? "bg-green-100 text-green-700" :
                              v.estado_stock === 'privado_taller' ? "bg-orange-100 text-orange-700 font-medium" :
                              "bg-blue-100 text-blue-700"
                            )}>
                              {v.estado_stock === 'privado_taller' ? 'EN TALLER' : v.estado_stock.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-headline text-lg text-primary">${(v.precio_venta || 0).toLocaleString()}</p>
                        {selectedVehicleId === v.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary ml-auto mt-1" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 2: NEGOTIATION */}
          {step === 'negotiate' && selectedVehicle && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
               <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-2xl border">
                  <div className="h-24 w-32 bg-muted rounded-xl overflow-hidden border shadow-sm">
                     {selectedVehicle.images?.[0]?.url ? (
                       <img src={selectedVehicle.images[0].url} alt={selectedVehicle.make} className="w-full h-full object-cover" />
                     ) : (
                       <Car className="h-full w-full p-4 text-muted-foreground" />
                     )}
                  </div>
                  <div className="space-y-1">
                     <h3 className="text-2xl font-bold font-headline">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</h3>
                     <div className="flex gap-4">
                       <div className="flex flex-col">
                         <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Placa</span>
                         <span className="font-mono text-sm">{selectedVehicle.placa || '---'}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">P. Público</span>
                         <span className="font-medium text-sm">${selectedVehicle.precio_venta?.toLocaleString()}</span>
                       </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-6">
                 {/* Seller Selection */}
                 <div className="space-y-4 p-4 rounded-xl border-2 bg-muted/5">
                   <div className="flex items-center gap-2 mb-2">
                     <User className="h-5 w-5 text-primary" />
                     <h3 className="font-semibold">Vendedor Responsable</h3>
                   </div>
                   <Select value={vendedorId} onValueChange={setVendedorId}>
                     <SelectTrigger className="bg-background h-12 text-lg">
                       <SelectValue placeholder="Seleccionar vendedor..." />
                     </SelectTrigger>
                     <SelectContent>
                       {staffList.filter(s => s.activo).map(s => (
                         <SelectItem key={s.id} value={s.id}>
                           {s.nombre} ({ROLE_LABELS[s.rol]})
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>

                 <div className="flex flex-col items-center justify-center space-y-2 py-4">
                   <Label className="text-muted-foreground uppercase tracking-widest text-xs font-bold font-headline">Precio Final de Venta ($)</Label>
                   <div className="relative w-full max-w-sm">
                     <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-8 w-8 text-primary/40" />
                     <Input
                       type="number"
                       value={precioVenta}
                       onChange={(e) => setPrecioVenta(e.target.value ? Number(e.target.value) : '')}
                       className="h-20 text-4xl text-center font-bold pl-12 rounded-2xl border-2 border-primary/20 focus-visible:ring-primary shadow-inner"
                       placeholder="0"
                     />
                   </div>
                 </div>

                 {negotiationInfo?.message && (
                   <div className={cn(
                     "p-4 rounded-xl flex items-start gap-3 border shadow-sm transition-all duration-300",
                     negotiationInfo.status === 'ok' && "bg-emerald-50 text-emerald-800 border-emerald-200",
                     negotiationInfo.status === 'low' && "bg-yellow-50 text-yellow-800 border-yellow-200",
                     negotiationInfo.status === 'very_low' && "bg-orange-50 text-orange-800 border-orange-200",
                     negotiationInfo.status === 'critical' && "bg-red-50 text-red-800 border-red-200 animate-pulse"
                   )}>
                     {negotiationInfo.status === 'critical' ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
                     <div className="flex-1">
                       <p className="font-bold text-lg">{negotiationInfo.message}</p>
                       {(currentRole === 'dueno' || currentRole === 'encargado') && (
                         <div className="mt-2 grid grid-cols-2 gap-2 text-xs opacity-80 pt-2 border-t border-current/20 font-mono">
                           <div>Costo Total: ${negotiationInfo.totalCost.toLocaleString()}</div>
                           <div>Punto Equilibrio: ${Math.round(negotiationInfo.breakEvenPrice).toLocaleString()}</div>
                           <div className="col-span-2 font-bold">Min p/ Margen ({concesionario?.configuracion.margen_minimo}%): ${Math.round(negotiationInfo.minPriceForMargin).toLocaleString()}</div>
                         </div>
                       )}
                     </div>
                   </div>
                 )}
               </div>
            </div>
          )}

          {/* STEP 3: CLIENT DETAILS */}
          {step === 'client' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 font-bold text-sm uppercase tracking-tighter text-muted-foreground font-headline">
                      <User className="h-4 w-4" /> Datos del Cliente
                    </h4>
                    <div className="space-y-4 p-4 rounded-2xl bg-muted/30 border">
                      <div className="space-y-2">
                        <Label>Nombre y Apellido *</Label>
                        <Input value={compradorNombre} onChange={e => setCompradorNombre(e.target.value)} placeholder="Ej: Maria Lopez" />
                      </div>
                      <div className="space-y-2">
                        <Label>Cédula / RIF</Label>
                        <Input value={compradorCedula} onChange={e => setCompradorCedula(e.target.value)} placeholder="V-00.000.000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <Input value={compradorTelefono} onChange={e => setCompradorTelefono(e.target.value)} placeholder="0424..." />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <h4 className="flex items-center gap-2 font-bold text-sm uppercase tracking-tighter text-muted-foreground font-headline">
                        <DollarSign className="h-4 w-4" /> Pago y Registro
                     </h4>
                     <div className="space-y-4 p-4 rounded-2xl bg-muted/30 border">
                        <div className="space-y-2">
                          <Label>Método de Pago *</Label>
                          <Select value={metodoPago} onValueChange={setMetodoPago}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {metodosPago.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center space-x-2 pt-2">
                           <Checkbox 
                             id="caja" 
                             checked={registrarCaja} 
                             onCheckedChange={(c) => setRegistrarCaja(c as boolean)} 
                           />
                           <Label htmlFor="caja" className="text-[11px] leading-tight text-muted-foreground cursor-pointer">
                             Registrar ingreso automático en el histórico de Caja Chica
                           </Label>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Summary Mini-Card */}
               <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase">Transacción final por</p>
                    <p className="text-2xl font-headline text-primary">${Number(precioVenta).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}</p>
                    <p className="text-xs text-muted-foreground font-mono uppercase">{selectedVehicle?.placa}</p>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <DialogFooter className="p-6 bg-muted/10 border-t flex items-center !justify-between">
           <div className="flex-1">
              <Button type="button" variant="ghost" onClick={handleBack} disabled={step === 'select' || isSaving}>
                 <ArrowLeft className="h-4 w-4 mr-2" />
                 Atrás
              </Button>
           </div>
           
           <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                 Cancelar
              </Button>
              
              {step !== 'client' ? (
                <Button 
                  type="button" 
                  onClick={handleNext} 
                  disabled={step === 'select' ? !selectedVehicleId : !precioVenta}
                  className="px-8 shadow-lg shadow-primary/20"
                >
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="button" 
                  onClick={handleSubmit} 
                  disabled={isSaving || !metodoPago || !compradorNombre}
                  className="px-10 bg-primary shadow-lg shadow-primary/25"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Cerrar Negocio
                </Button>
              )}
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  )
}
