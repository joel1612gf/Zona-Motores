'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, orderBy, limit } from 'firebase/firestore';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { StaffMember, RegistroCaja, CierreCaja } from '@/lib/business-types';
import { verifySHA256 } from '@/lib/business-types';
import { Loader2, CheckCircle2, AlertCircle, Wallet, ArrowRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { startOfDay } from 'date-fns';

interface CashClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concesionarioId: string;
  onSave?: () => void;
}

type Step = 'counting' | 'waiting' | 'auth' | 'comparison' | 'success';

export function CashClosureDialog({ open, onOpenChange, concesionarioId, onSave }: CashClosureDialogProps) {
  const { concesionario, staff: currentStaff } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('counting');
  const [isLoading, setIsLoading] = useState(false);
  const [conteoManual, setConteoManual] = useState<Record<string, number>>({});
  const [adminStaff, setAdminStaff] = useState<StaffMember[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [sistemaEsperado, setSistemaEsperado] = useState<Record<string, number>>({});

  const metodos = concesionario?.configuracion.metodos_pago || ['Efectivo', 'Zelle', 'Pago Móvil', 'Transferencia'];

  useEffect(() => {
    if (open) {
      setStep('counting');
      setConteoManual(metodos.reduce((acc, m) => ({ ...acc, [m]: 0 }), {}));
      setPin('');
      setSelectedAdminId('');
      fetchAdmins();
    }
  }, [open, concesionario]);

  const fetchAdmins = async () => {
    try {
      const q = query(
        collection(firestore, 'concesionarios', concesionarioId, 'staff'),
        where('activo', '==', true),
        where('rol', 'in', ['dueno', 'encargado'])
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));
      setAdminStaff(data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const calculateExpected = async () => {
    setIsLoading(true);
    try {
      const today = startOfDay(new Date());
      const q = query(
        collection(firestore, 'concesionarios', concesionarioId, 'caja'),
        where('fecha', '>=', Timestamp.fromDate(today)),
        orderBy('fecha', 'asc')
      );
      const snap = await getDocs(q);
      const txs = snap.docs.map(doc => doc.data() as RegistroCaja);

      const expected: Record<string, number> = metodos.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
      txs.forEach(t => {
        const met = metodos.find(m => m.toLowerCase() === t.metodo_pago.toLowerCase()) || 'Otros';
        if (!expected[met]) expected[met] = 0;
        expected[met] += (t.tipo === 'ingreso' ? t.monto : -t.monto);
      });
      setSistemaEsperado(expected);
    } catch (error) {
      console.error('Error calculating expected:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextToWait = () => {
    setStep('waiting');
  };

  const handleStartAuth = () => {
    setStep('auth');
  };

  const handleVerifyPin = async () => {
    const admin = adminStaff.find(s => s.id === selectedAdminId);
    if (!admin) return;

    setIsLoading(true);
    const isValid = await verifySHA256(pin, admin.pin_hash);
    
    if (isValid) {
      await calculateExpected();
      setStep('comparison');
    } else {
      toast({
        title: 'PIN Incorrecto',
        description: 'La clave ingresada no es válida.',
        variant: 'destructive'
      });
    }
    setIsLoading(false);
  };

  const handleConfirmClosure = async () => {
    setIsLoading(true);
    try {
      const today = startOfDay(new Date());
      const closuresRef = collection(firestore, 'concesionarios', concesionarioId, 'cierres_caja');
      
      const q = query(
        closuresRef,
        where('fecha', '>=', Timestamp.fromDate(today)),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      const lastClosure = snap.docs[0]?.data() as CierreCaja | undefined;
      const nextNum = (lastClosure?.numero_cierre || 0) + 1;

      const totalManual = Object.values(conteoManual).reduce((a, b) => a + b, 0);
      const totalSistema = Object.values(sistemaEsperado).reduce((a, b) => a + b, 0);
      
      const diferencias: Record<string, number> = {};
      metodos.forEach(m => {
        diferencias[m] = (conteoManual[m] || 0) - (sistemaEsperado[m] || 0);
      });

      const finalData: Omit<CierreCaja, 'id'> = {
        fecha: Timestamp.now(),
        cajero_staff_id: currentStaff?.id || '',
        cajero_nombre: currentStaff?.nombre || '',
        numero_cierre: nextNum,
        conteo_manual: conteoManual,
        sistema_esperado: sistemaEsperado,
        diferencias,
        total_manual: totalManual,
        total_sistema: totalSistema,
        total_diferencia: totalManual - totalSistema,
        estado: 'aprobado',
        aprobado_por_id: selectedAdminId,
        aprobado_por_nombre: adminStaff.find(s => s.id === selectedAdminId)?.nombre || '',
        aprobado_at: Timestamp.now(),
      };

      await addDoc(closuresRef, finalData);
      
      setStep('success');
      onSave?.();
    } catch (error) {
      console.error('Error saving closure:', error);
      toast({ title: 'Error', description: 'No se pudo guardar el cierre de caja.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-[500px] transition-all duration-300", step === 'comparison' && "sm:max-w-[700px]")}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline font-bold">
            {step === 'counting' && 'Cierre de Caja - Conteo'}
            {step === 'waiting' && 'Esperando Aprobación'}
            {step === 'auth' && 'Autenticación de Superior'}
            {step === 'comparison' && 'Comparativa de Cuadre'}
            {step === 'success' && 'Cierre Exitoso'}
          </DialogTitle>
          <DialogDescription>
            {step === 'counting' && 'Ingresa los montos físicos que tienes en caja por cada método.'}
            {step === 'waiting' && 'Por favor, llama a un superior para validar el conteo.'}
            {step === 'auth' && 'El administrador debe ingresar su PIN para continuar.'}
            {step === 'comparison' && 'Verifica las diferencias entre el sistema y lo contado.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'counting' && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {metodos.map(m => (
                <div key={m} className="space-y-2">
                  <Label>{m}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-7"
                      value={conteoManual[m] || ''}
                      onChange={(e) => setConteoManual({ ...conteoManual, [m]: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-muted/30 p-4 rounded-lg flex justify-between items-center">
              <span className="font-medium">Total Contado:</span>
              <span className="text-xl font-bold font-headline text-primary">
                {formatCurrency(Object.values(conteoManual).reduce((a, b) => a + b, 0))}
              </span>
            </div>
          </div>
        )}

        {step === 'waiting' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
              <AlertCircle className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Cierre en pausa</h3>
              <p className="text-muted-foreground max-w-[300px]">
                El cajero ha declarado un total de <span className="font-bold text-foreground">{formatCurrency(Object.values(conteoManual).reduce((a, b) => a + b, 0))}</span>.
              </p>
            </div>
            <Button onClick={handleStartAuth} className="w-full max-w-[240px]">
              Soy Superior - Continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'auth' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Superior Responsable</Label>
              <Select onValueChange={setSelectedAdminId} value={selectedAdminId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona quién aprueba" />
                </SelectTrigger>
                <SelectContent>
                  {adminStaff.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre} ({s.rol})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PIN de Seguridad</Label>
              <Input
                type="password"
                placeholder="****"
                className="text-center text-2xl tracking-[0.5em]"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
              />
            </div>
          </div>
        )}

        {step === 'comparison' && (
          <div className="space-y-6 py-4">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left">Método</th>
                    <th className="px-4 py-2 text-right">Sistema</th>
                    <th className="px-4 py-2 text-right">Declarado</th>
                    <th className="px-4 py-2 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {metodos.map(m => {
                    const diff = (conteoManual[m] || 0) - (sistemaEsperado[m] || 0);
                    return (
                      <tr key={m}>
                        <td className="px-4 py-3 font-medium">{m}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(sistemaEsperado[m] || 0)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(conteoManual[m] || 0)}</td>
                        <td className={cn(
                          "px-4 py-3 text-right font-bold",
                          Math.abs(diff) < 0.01 ? "text-muted-foreground" : diff > 0 ? "text-green-600" : "text-destructive"
                        )}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30 font-bold border-t">
                  <tr>
                    <td className="px-4 py-3">TOTALES</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Object.values(sistemaEsperado).reduce((a, b) => a + b, 0))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Object.values(conteoManual).reduce((a, b) => a + b, 0))}</td>
                    <td className="px-4 py-3 text-right">
                       {formatCurrency(Object.values(conteoManual).reduce((a, b) => a + b, 0) - Object.values(sistemaEsperado).reduce((a, b) => a + b, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {(Object.values(conteoManual).reduce((a, b) => a + b, 0) - Object.values(sistemaEsperado).reduce((a, b) => a + b, 0)) !== 0 && (
              <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg flex gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">El cierre presenta discrepancias. Asegúrate de verificar el dinero físico antes de confirmar.</p>
              </div>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
            <CheckCircle2 className="h-16 w-16 text-green-500 animate-bounce" />
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">¡Cierre Realizado!</h3>
              <p className="text-muted-foreground">El registro ha sido guardado exitosamente.</p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full max-w-[200px]">
              Finalizar
            </Button>
          </div>
        )}

        <DialogFooter className={cn(step === 'waiting' || step === 'success' ? "hidden" : "flex")}>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          
          {step === 'counting' && (
            <Button onClick={handleNextToWait}>
              Siguiente: Esperar Superior
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 'auth' && (
            <Button onClick={handleVerifyPin} disabled={!selectedAdminId || pin.length < 4 || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Validar PIN
            </Button>
          )}

          {step === 'comparison' && (
            <Button onClick={handleConfirmClosure} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar y Cerrar Caja
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
