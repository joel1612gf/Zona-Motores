'use client';

import { useState, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { BankAccount } from '@/lib/business-types';
import { BANK_ENTRY_METHOD_LABELS } from '@/lib/business-types';

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concesionarioId: string;
  onSave: () => void;
}

export function TransactionFormDialog({ open, onOpenChange, concesionarioId, onSave }: TransactionFormDialogProps) {
  const { concesionario, staff } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [monto, setMonto] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic payment methods from bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (open) {
      setTipo('ingreso');
      setMonto('');
      setDescripcion('');
      setMetodoPago('');
      setReferenciaPago('');

      // Load bank accounts for dynamic payment method selection
      const loadAccounts = async () => {
        try {
          const snap = await getDocs(
            query(
              collection(firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias'),
              orderBy('orden', 'asc')
            )
          );
          const active = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as BankAccount))
            .filter(a => a.activa);
          setBankAccounts(active);
        } catch {
          setBankAccounts([]);
        }
      };
      loadAccounts();
    }
  }, [open, concesionarioId, firestore]);

  // Build dynamic payment options from bank accounts
  // Each option = "Método — NombreCuenta"
  const paymentOptions: { value: string; label: string }[] = bankAccounts.length > 0
    ? bankAccounts.flatMap(acc => {
        const methods = tipo === 'ingreso'
          ? Object.entries(acc.metodos_entrada || {}).filter(([, v]) => v).map(([k]) => k)
          : Object.entries(acc.metodos_salida || {}).filter(([, v]) => v).map(([k]) => k);
        return methods.map((method) => ({
          value: `${method}__${acc.id}`,
          label: `${BANK_ENTRY_METHOD_LABELS[method as keyof typeof BANK_ENTRY_METHOD_LABELS] ?? method} — ${acc.nombre}`,
        }));
      })
    // Backward-compat fallback if no bank accounts configured
    : (concesionario?.configuracion?.metodos_pago ?? ['Efectivo', 'Zelle', 'Pago Móvil', 'Transferencia'])
        .map((m: string) => ({ value: m, label: m }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!monto || !descripcion || !metodoPago) {
      toast({ title: 'Faltan datos', description: 'Monto, descripción y método de pago son obligatorios.', variant: 'destructive' });
      return;
    }

    if (!staff) {
      toast({ title: 'Error', description: 'No se detectó un usuario activo.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const txData = {
        tipo,
        monto: Number(monto),
        descripcion,
        metodo_pago: metodoPago,
        referencia_pago: referenciaPago || null,
        cajero_staff_id: staff.id,
        cajero_nombre: staff.nombre,
        fecha: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'caja'), txData);

      toast({ title: 'Movimiento registrado' });
      onOpenChange(false);
      onSave();

    } catch (error: any) {
      console.error('[CashRegister] Error saving transaction:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
          <DialogDescription>
            Agrega un nuevo ingreso o egreso manual a la caja.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          
          <div className="space-y-3">
            <Label>Tipo de Movimiento</Label>
          <RadioGroup
              value={tipo}
              onValueChange={(val) => {
                setTipo(val as 'ingreso' | 'egreso');
                setMetodoPago(''); // Reset method selection when direction changes
              }}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ingreso" id="ingreso" />
                <Label htmlFor="ingreso" className="text-green-600 dark:text-green-400 font-medium">Ingreso</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="egreso" id="egreso" />
                <Label htmlFor="egreso" className="text-destructive font-medium">Egreso</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto">Monto ($) *</Label>
            <Input
              id="monto"
              type="number"
              min={0}
              step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value ? Number(e.target.value) : '')}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción / Concepto *</Label>
            <Input
              id="descripcion"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Pago servicio eléctrico"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodo_pago">Método de Pago *</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger id="metodo_pago">
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                {paymentOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referencia">Referencia (opcional)</Label>
            <Input
              id="referencia"
              value={referenciaPago}
              onChange={e => setReferenciaPago(e.target.value)}
              placeholder="Ej: Zelle - Juan Perez"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
