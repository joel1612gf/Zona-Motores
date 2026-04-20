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
import { Loader2, DollarSign, Percent, Target, Briefcase, Shield } from 'lucide-react';
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
  
  // Fintech Fields
  const [baseSalaryUsd, setBaseSalaryUsd] = useState<number | ''>('');
  const [commissionType, setCommissionType] = useState<'total_price' | 'net_profit'>('total_price');
  const [commissionPercentage, setCommissionPercentage] = useState<number | ''>('');
  const [monthlyGoal, setMonthlyGoal] = useState<number | ''>('');
  
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!editingStaff;

  // Populate form when editing
  useEffect(() => {
    if (editingStaff) {
      setNombre(editingStaff.nombre);
      setTelefono(editingStaff.telefono || '');
      setRol(editingStaff.rol);
      setBaseSalaryUsd(editingStaff.base_salary_usd ?? '');
      setCommissionType(editingStaff.commission_type || 'total_price');
      setCommissionPercentage(editingStaff.commission_percentage ?? '');
      setMonthlyGoal(editingStaff.monthly_goal ?? '');
      setPin('');
      setPinConfirm('');
    } else {
      setNombre('');
      setTelefono('');
      setRol('vendedor');
      setPin('');
      setPinConfirm('');
      setBaseSalaryUsd('');
      setCommissionType('total_price');
      setCommissionPercentage('');
      setMonthlyGoal('');
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
      const staffData: any = {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        rol,
        activo: true,
        base_salary_usd: baseSalaryUsd !== '' ? Number(baseSalaryUsd) : null,
        commission_type: commissionType,
        commission_percentage: commissionPercentage !== '' ? Number(commissionPercentage) : null,
        monthly_goal: monthlyGoal !== '' ? Number(monthlyGoal) : null,
      };

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
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Configurar Perfil Fintech' : 'Nuevo Perfil Fintech'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Ajusta los parámetros de compensación y metas del personal.' : 'Registra un nuevo miembro del equipo y sus metas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <Briefcase className="h-3 w-3" /> Información Básica
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staff-nombre">Nombre Completo</Label>
                <Input
                  id="staff-nombre"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-telefono">Teléfono</Label>
                <Input
                  id="staff-telefono"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="+58 412..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-rol">Rol en el Negocio</Label>
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
          </div>

          {/* Security */}
          <div className="space-y-4 pt-2 border-t border-dashed">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <Shield className="h-3 w-3" /> Seguridad
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staff-pin">
                  {isEditing ? 'Nuevo PIN' : 'PIN (4-6 dígitos)'}
                </Label>
                <Input
                  id="staff-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder={isEditing ? '••••' : 'PIN de acceso'}
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
                  placeholder="Repetir PIN"
                  className="font-mono tracking-wider"
                />
              </div>
            </div>
          </div>

          {/* Compensation & Fintech */}
          <div className="space-y-4 pt-2 border-t border-dashed">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <DollarSign className="h-3 w-3" /> Configuración Fintech
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staff-salary">Sueldo Base ($)</Label>
                <Input
                  id="staff-salary"
                  type="number"
                  min={0}
                  step="any"
                  value={baseSalaryUsd}
                  onChange={e => setBaseSalaryUsd(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 450"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-goal" className="flex items-center gap-1.5"><Target className="h-3 w-3" /> Meta Mensual ($)</Label>
                <Input
                  id="staff-goal"
                  type="number"
                  min={0}
                  step="any"
                  value={monthlyGoal}
                  onChange={e => setMonthlyGoal(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ganancia objetivo"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staff-comm-type">Base de Comisión</Label>
                <Select value={commissionType} onValueChange={(v) => setCommissionType(v as any)}>
                  <SelectTrigger id="staff-comm-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total_price">Sobre Venta Total</SelectItem>
                    <SelectItem value="net_profit">Sobre Ganancia Real</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-comm-pct" className="flex items-center gap-1.5"><Percent className="h-3 w-3" /> Comisión (%)</Label>
                <Input
                  id="staff-comm-pct"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={commissionPercentage}
                  onChange={e => setCommissionPercentage(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 5"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="flex-1">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                isEditing ? 'Actualizar Perfil' : 'Crear Perfil'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
