'use client';

import { useState, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { hashSHA256, ROLE_LABELS, type StaffMember, type BusinessRole } from '@/lib/business-types';

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStaff: StaffMember | null; // null = creating new
  concesionarioId: string;
  onSave: () => void;
}

const AVAILABLE_ROLES: BusinessRole[] = ['dueno', 'encargado', 'secretario', 'vendedor', 'cajero'];

export function StaffFormDialog({ open, onOpenChange, editingStaff, concesionarioId, onSave }: StaffFormDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState<BusinessRole>('vendedor');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [comision, setComision] = useState<number | ''>('');
  const [sueldo, setSueldo] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!editingStaff;

  // Populate form when editing
  useEffect(() => {
    if (editingStaff) {
      setNombre(editingStaff.nombre);
      setTelefono(editingStaff.telefono || '');
      setRol(editingStaff.rol);
      setComision(editingStaff.comision_porcentaje ?? '');
      setSueldo(editingStaff.sueldo ?? '');
      setPin('');
      setPinConfirm('');
    } else {
      setNombre('');
      setTelefono('');
      setRol('vendedor');
      setPin('');
      setPinConfirm('');
      setComision('');
      setSueldo('');
    }
  }, [editingStaff, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' });
      return;
    }

    // PIN validation
    if (!isEditing && !pin) {
      toast({ title: 'PIN requerido', description: 'Debes asignar un PIN al nuevo empleado.', variant: 'destructive' });
      return;
    }

    if (pin && (pin.length < 4 || pin.length > 6)) {
      toast({ title: 'PIN inválido', description: 'El PIN debe tener entre 4 y 6 dígitos.', variant: 'destructive' });
      return;
    }

    if (pin && pin !== pinConfirm) {
      toast({ title: 'PINs no coinciden', description: 'Los PINs ingresados no coinciden.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const staffData: Record<string, unknown> = {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        rol,
        activo: true,
      };

      if (comision !== '') staffData.comision_porcentaje = Number(comision);
      if (sueldo !== '') staffData.sueldo = Number(sueldo);

      // Hash PIN if provided
      if (pin) {
        staffData.pin_hash = await hashSHA256(pin);
      }

      if (isEditing) {
        // Update existing
        const docRef = doc(firestore, 'concesionarios', concesionarioId, 'staff', editingStaff.id);
        await updateDoc(docRef, staffData);
        toast({ title: '¡Empleado actualizado!', description: `${nombre} fue actualizado correctamente.` });
      } else {
        // Create new
        staffData.created_at = serverTimestamp();
        await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'staff'), staffData);
        toast({ title: '¡Empleado agregado!', description: `${nombre} fue registrado como ${ROLE_LABELS[rol]}.` });
      }

      onOpenChange(false);
      onSave();
    } catch (error) {
      console.error('[StaffForm] Error:', error);
      toast({ title: 'Error', description: 'No se pudo guardar. Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del empleado.' : 'Completa los datos para agregar un nuevo empleado.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-nombre">Nombre</Label>
              <Input
                id="staff-nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-telefono">Teléfono</Label>
              <Input
                id="staff-telefono"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="+58412..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-rol">Rol</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as BusinessRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-pin">
                {isEditing ? 'Nuevo PIN (dejar vacío para no cambiar)' : 'PIN (4-6 dígitos)'}
              </Label>
              <Input
                id="staff-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="font-mono tracking-wider"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-pin-confirm">Confirmar PIN</Label>
              <Input
                id="staff-pin-confirm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinConfirm}
                onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="font-mono tracking-wider"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-comision">Comisión (%)</Label>
              <Input
                id="staff-comision"
                type="number"
                min={0}
                max={100}
                step="any"
                value={comision}
                onChange={e => setComision(e.target.value ? Number(e.target.value) : '')}
                placeholder="0.5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-sueldo">Sueldo ($)</Label>
              <Input
                id="staff-sueldo"
                type="number"
                min={0}
                step="any"
                value={sueldo}
                onChange={e => setSueldo(e.target.value ? Number(e.target.value) : '')}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
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
                isEditing ? 'Guardar Cambios' : 'Agregar Empleado'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
