'use client';

import { useState } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, UserRound, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { ROLE_LABELS, type StaffMember, type BusinessRole } from '@/lib/business-types';
import { StaffFormDialog } from '@/components/business/staff-form-dialog';
import { cn } from '@/lib/utils';

const ROLE_COLORS: Record<BusinessRole, string> = {
  dueno: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  encargado: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  secretario: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  vendedor: 'bg-green-500/10 text-green-700 border-green-500/30',
  cajero: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
};

const ROLE_ICONS: Record<BusinessRole, React.ComponentType<{ className?: string }>> = {
  dueno: ShieldAlert,
  encargado: ShieldCheck,
  secretario: Shield,
  vendedor: UserRound,
  cajero: UserRound,
};

export default function StaffPage() {
  const { concesionario, staffList, hasPermission } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const permission = hasPermission('staff');

  const handleCreate = () => {
    setEditingStaff(null);
    setDialogOpen(true);
  };

  const handleEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setDialogOpen(true);
  };

  const handleToggleActive = async (member: StaffMember) => {
    if (!concesionario) return;
    setIsToggling(member.id);
    try {
      const docRef = doc(firestore, 'concesionarios', concesionario.id, 'staff', member.id);
      await updateDoc(docRef, { activo: !member.activo });
      toast({
        title: member.activo ? 'Empleado desactivado' : 'Empleado activado',
        description: `${member.nombre} fue ${member.activo ? 'desactivado' : 'activado'} exitosamente.`,
      });
      // Force page reload to refresh staff list
      window.location.reload();
    } catch (error) {
      console.error('[Staff] Error toggling:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar el estado.', variant: 'destructive' });
    } finally {
      setIsToggling(null);
    }
  };

  const handleSaveStaff = async () => {
    // Refresh to pick up changes
    window.location.reload();
  };

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const isReadOnly = permission === 'read';

  // Separate active and inactive staff
  const activeStaff = staffList.filter(s => s.activo);
  const inactiveStaff = staffList.filter(s => !s.activo);
  // Also show inactive from Firestore (staffList only has active ones from the query)
  // We need to load all staff, not just active ones for this page

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Personal</h1>
          <p className="text-muted-foreground mt-1">Gestiona los empleados del concesionario</p>
        </div>
        {!isReadOnly && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Empleado
          </Button>
        )}
      </div>

      {/* Active Staff */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Empleados Activos ({activeStaff.length})
        </h2>
        {activeStaff.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32 text-muted-foreground">
              No hay empleados activos registrados.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeStaff.map(member => {
              const RoleIcon = ROLE_ICONS[member.rol];
              return (
                <Card key={member.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative h-14 w-14 rounded-full overflow-hidden bg-muted shrink-0">
                        {member.foto_url ? (
                          <Image src={member.foto_url} alt="" fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-primary/10">
                            <UserRound className="h-7 w-7 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{member.nombre}</p>
                        <Badge variant="outline" className={cn('mt-1', ROLE_COLORS[member.rol])}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {ROLE_LABELS[member.rol]}
                        </Badge>
                        {member.comision_porcentaje != null && (
                          <p className="text-xs text-muted-foreground mt-1">Comisión: {member.comision_porcentaje}%</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!isReadOnly && (
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(member)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleToggleActive(member)}
                          disabled={isToggling === member.id}
                        >
                          {isToggling === member.id ? 'Procesando...' : 'Desactivar'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Inactive Staff */}
      {inactiveStaff.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
            Empleados Inactivos ({inactiveStaff.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {inactiveStaff.map(member => (
              <Card key={member.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                      <div className="h-full w-full flex items-center justify-center">
                        <UserRound className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.nombre}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.rol]} • Inactivo</p>
                    </div>
                    {!isReadOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(member)}
                        disabled={isToggling === member.id}
                      >
                        Activar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <StaffFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingStaff={editingStaff}
        concesionarioId={concesionario?.id || ''}
        onSave={handleSaveStaff}
      />
    </div>
  );
}
