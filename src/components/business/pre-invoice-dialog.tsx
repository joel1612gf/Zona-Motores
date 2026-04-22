'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, AlertTriangle, ShieldCheck, ShieldAlert, UserCheck, Car, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { verifySHA256 } from '@/lib/business-types';
import type { StockVehicle } from '@/lib/business-types';

interface PreInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: StockVehicle | null;
  concesionarioId: string;
  onSave: () => void;
}

export function PreInvoiceDialog({ open, onOpenChange, vehicle, concesionarioId, onSave }: PreInvoiceDialogProps) {
  const { staff, concesionario, staffList, currentRole } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [precio, setPrecio] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Authorization State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authUserId, setAuthUserId] = useState('');
  const [authPin, setAuthPin] = useState(['', '', '', '']);
  const [authGranted, setAuthGranted] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Negotiation Logic
  const negotiationInfo = useMemo(() => {
    if (!vehicle || !concesionario) return null;
    
    const totalCost = (vehicle.costo_compra || 0) + (vehicle.gastos_adecuacion || []).reduce((a, g) => a + (g.monto || 0), 0);
    const currentPrice = Number(precio) || 0;
    const minMargin = (concesionario.configuracion?.margen_minimo || 0) / 100;
    
    // Find vendor in staff list for commission
    const v = staff?.id ? staffList.find(s => s.id === staff.id) : null;
    const commPercentage = v?.commission_percentage ?? concesionario.configuracion?.estructura_comision ?? 0;
    const sellerComRate = commPercentage / 100;

    // We assume commission is on total price as default for this calculation
    const minPriceForMargin = totalCost === 0 ? 0 : (totalCost * (1 + minMargin)) / (1 - sellerComRate);
    const breakEvenPrice = totalCost;
    
    let status: 'ok' | 'low' | 'very_low' | 'critical' = 'ok';
    let message = '';
    
    if (currentPrice > 0) {
      if (currentPrice < breakEvenPrice) {
        status = 'critical';
        message = '¡PÉRDIDA!: El precio es inferior al costo total.';
      } else if (currentPrice < minPriceForMargin) {
        const diffPercent = (minPriceForMargin - currentPrice) / minPriceForMargin;
        status = diffPercent > 0.05 ? 'very_low' : 'low';
        message = diffPercent > 0.05 
          ? 'Margen insuficiente: Requiere autorización de superior.' 
          : 'Precio por debajo del margen ideal.';
      } else {
        message = 'Precio dentro del margen operativo.';
      }
    }
    
    return { totalCost, minPriceForMargin, breakEvenPrice, status, message };
  }, [vehicle, precio, concesionario, staff, staffList]);

  const needsAuth = useMemo(() => {
    if (!negotiationInfo) return false;
    const isSuperior = currentRole === 'dueno' || currentRole === 'encargado';
    return (negotiationInfo.status === 'critical' || negotiationInfo.status === 'very_low') && !isSuperior;
  }, [negotiationInfo, currentRole]);

  useEffect(() => {
    if (open && vehicle) {
      setPrecio(vehicle.precio_venta?.toString() || '');
      setAuthGranted(false);
      setAuthUserId('');
      setAuthPin(['', '', '', '']);
    }
  }, [open, vehicle]);

  const handleVerifyPin = async () => {
    const pin = authPin.join('');
    if (pin.length !== 4) return;
    
    const s = staffList.find(x => x.id === authUserId);
    if (!s) return;
    
    setIsVerifyingPin(true);
    try {
      const ok = await verifySHA256(pin, s.pin_hash);
      if (ok) {
        setAuthGranted(true);
        setAuthModalOpen(false);
        toast({ title: '✓ Autorización concedida', description: `Autorizado por ${s.nombre}.` });
      } else {
        toast({ title: 'PIN incorrecto', variant: 'destructive' });
        setAuthPin(['', '', '', '']);
        pinRefs[0].current?.focus();
      }
    } catch (e) {
      toast({ title: 'Error de verificación', variant: 'destructive' });
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handlePinInput = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const p = [...authPin];
    p[i] = val;
    setAuthPin(p);
    if (val && i < 3) pinRefs[i + 1].current?.focus();
  };

  const handleSubmit = async () => {
    if (!vehicle || !staff || !precio || !concesionarioId) return;
    
    if (needsAuth && !authGranted) {
      setAuthModalOpen(true);
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'pre_invoices'), {
        vendedor_id: staff.id,
        vendedor_nombre: staff.nombre,
        item_id: vehicle.id,
        item_tipo: 'vehiculo',
        item_nombre: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        precio_negociado: Number(precio),
        estado: 'pendiente',
        created_at: serverTimestamp(),
        authorized_by: authGranted ? staffList.find(s => s.id === authUserId)?.nombre : null,
      });

      await updateDoc(doc(firestore, 'concesionarios', concesionarioId, 'inventario', vehicle.id), {
        estado_stock: 'reservado',
        updated_at: serverTimestamp(),
      });

      toast({ title: 'Prefactura enviada a caja' });
      onSave();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error al enviar prefactura', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-background">
          <div className="bg-muted/30 p-6 space-y-6">
            <DialogHeader className="space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-headline font-bold">Enviar a Caja</DialogTitle>
              <DialogDescription className="text-sm">
                Genera una intención de venta para el cajero.
              </DialogDescription>
            </DialogHeader>
            
            {vehicle && (
              <div className="space-y-5">
                {/* Vehicle Card */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/20 shadow-sm">
                  <div className="w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                    <Car className="h-8 w-8 text-primary/60" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary/60 uppercase tracking-tighter">Vehículo en negociación</p>
                    <p className="font-headline font-bold text-lg truncate leading-tight">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">{vehicle.placa || 'SIN PLACA'}</p>
                  </div>
                </div>
                
                {/* Price Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label className="text-sm font-semibold ml-1">Precio Final Acordado</Label>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dólares (USD)</span>
                  </div>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary/40 group-focus-within:text-primary transition-colors">$</span>
                    <Input 
                      type="number" 
                      value={precio} 
                      onChange={e => setPrecio(e.target.value)} 
                      placeholder="0.00"
                      className="text-3xl font-bold h-20 pl-10 rounded-2xl border-2 focus-visible:ring-primary/20 bg-background/50 group-hover:bg-background transition-all"
                    />
                  </div>
                </div>

                {/* Negotiation Info */}
                {precio && negotiationInfo && (
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all animate-in fade-in slide-in-from-top-2",
                    negotiationInfo.status === 'ok' ? "bg-green-500/5 border-green-500/20 text-green-700" :
                    negotiationInfo.status === 'low' ? "bg-blue-500/5 border-blue-500/20 text-blue-700" :
                    negotiationInfo.status === 'very_low' ? "bg-orange-500/5 border-orange-500/20 text-orange-700" :
                    "bg-red-500/5 border-red-500/20 text-red-700"
                  )}>
                    <div className="flex gap-3">
                      {negotiationInfo.status === 'ok' ? <ShieldCheck className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-tight">{negotiationInfo.status === 'ok' ? 'Precio Óptimo' : 'Alerta de Margen'}</p>
                        <p className="text-sm font-medium leading-tight">{negotiationInfo.message}</p>
                        <div className="flex gap-4 mt-2 pt-2 border-t border-current/10 text-[10px] font-bold uppercase">
                          <span>Costo: {formatCurrency(negotiationInfo.totalCost)}</span>
                          <span>Mínimo: {formatCurrency(negotiationInfo.minPriceForMargin)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Authorization Status */}
                {authGranted && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary animate-pulse">
                    <UserCheck className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase">Venta Autorizada</span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2 gap-3 sm:gap-0">
              <Button variant="ghost" className="rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSaving || !precio || Number(precio) <= 0}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base shadow-lg transition-all active:scale-95",
                  needsAuth && !authGranted ? "bg-orange-600 hover:bg-orange-700" : "bg-primary hover:bg-primary/90"
                )}
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : needsAuth && !authGranted ? <ShieldAlert className="h-5 w-5 mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                {needsAuth && !authGranted ? 'Solicitar Aprobación' : 'Enviar a Caja'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Authorization Dialog */}
      <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
        <DialogContent className="max-w-sm p-6 rounded-[2rem] border-none shadow-2xl bg-background/95 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-headline font-bold">Autorización Requerida</h3>
              <p className="text-sm text-muted-foreground px-4">
                El precio negociado está por debajo del margen mínimo. Un superior debe autorizar esta prefactura.
              </p>
            </div>

            <div className="w-full space-y-4">
              <div className="space-y-1.5 text-left">
                <Label className="text-xs font-bold ml-1 uppercase text-muted-foreground">Superior</Label>
                <Select value={authUserId} onValueChange={setAuthUserId}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {staffList.filter(s => s.rol === 'dueno' || s.rol === 'encargado').map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold ml-1 uppercase text-muted-foreground">PIN de Seguridad</Label>
                <div className="flex justify-center gap-3">
                  {authPin.map((digit, i) => (
                    <Input
                      key={i}
                      ref={pinRefs[i]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 focus:border-primary focus:ring-0"
                      value={digit}
                      onChange={e => handlePinInput(i, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !digit && i > 0) pinRefs[i - 1].current?.focus();
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Button 
              className="w-full h-12 rounded-xl font-bold bg-orange-600 hover:bg-orange-700" 
              onClick={handleVerifyPin} 
              disabled={isVerifyingPin || !authUserId || authPin.some(p => !p)}
            >
              {isVerifyingPin ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar Autorización'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
