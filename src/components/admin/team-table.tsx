'use client';

import { useState } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { SuperAdmin, AdminRole } from '@/lib/admin-types';
import { ADMIN_ROLE_LABELS } from '@/lib/admin-types';
import { toYearMonth } from '@/lib/analytics-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Trash2, Users } from 'lucide-react';

type AdminRow = SuperAdmin & { id: string };

type Props = {
  admins: AdminRow[];
  /** Lowercased email of the currently logged-in owner (cannot self-remove). */
  currentEmail: string;
};

const ROLE_BADGE: Record<AdminRole, 'default' | 'secondary'> = {
  owner: 'default',
  moderator: 'secondary',
};

export function TeamTable({ admins, currentEmail }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<AdminRow | null>(null);

  const activeOwners = admins.filter((a) => a.role === 'owner' && a.activo === true).length;
  const isLastActiveOwner = (a: AdminRow) => a.role === 'owner' && a.activo === true && activeOwners <= 1;
  const isSelf = (a: AdminRow) => a.email.toLowerCase() === currentEmail.toLowerCase();

  const blockReason = (a: AdminRow, action: 'desactivar' | 'eliminar'): string | null => {
    if (isSelf(a)) return `No puedes ${action} tu propia cuenta.`;
    if (isLastActiveOwner(a)) return `No puedes ${action} al último propietario activo.`;
    return null;
  };

  const toggleActive = (a: AdminRow) => {
    const turningOff = a.activo === true;
    if (turningOff) {
      const reason = blockReason(a, 'desactivar');
      if (reason) {
        toast({ variant: 'destructive', title: 'Acción bloqueada', description: reason });
        return;
      }
    }
    updateDocumentNonBlocking(doc(firestore, 'super_admins', a.id), { activo: !a.activo });
    toast({
      title: !a.activo ? 'Administrador activado' : 'Administrador desactivado',
      description: a.email,
    });
  };

  const requestDelete = (a: AdminRow) => {
    const reason = blockReason(a, 'eliminar');
    if (reason) {
      toast({ variant: 'destructive', title: 'Acción bloqueada', description: reason });
      return;
    }
    setPendingDelete(a);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'super_admins', pendingDelete.id));
    toast({ title: 'Administrador eliminado', description: pendingDelete.email });
    setPendingDelete(null);
  };

  if (admins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-[1.5rem] bg-card/40">
        <Users className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
        <p className="font-headline text-lg font-semibold">Sin administradores</p>
        <p className="text-sm text-muted-foreground mt-1">Invita al primer miembro del equipo.</p>
      </div>
    );
  }

  const renderActions = (a: AdminRow) => (
    <div className="flex items-center justify-end gap-3">
      <div className="flex items-center gap-2">
        <Switch checked={a.activo === true} onCheckedChange={() => toggleActive(a)} />
        <Badge variant={a.activo ? 'default' : 'secondary'}>{a.activo ? 'Activo' : 'Inactivo'}</Badge>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => requestDelete(a)}
        disabled={isSelf(a) || isLastActiveOwner(a)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-[1.5rem] border shadow-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{a.email}</span>
                    {isSelf(a) && <span className="text-[10px] text-muted-foreground">(tú)</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_BADGE[a.role]}>{ADMIN_ROLE_LABELS[a.role]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{toYearMonth(a.created_at) ?? '—'}</TableCell>
                <TableCell>{renderActions(a)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {admins.map((a) => (
          <div key={a.id} className="rounded-[1.5rem] border shadow-sm bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium truncate flex-1">{a.email}</span>
              <Badge variant={ROLE_BADGE[a.role]}>{ADMIN_ROLE_LABELS[a.role]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Desde {toYearMonth(a.created_at) ?? '—'}</span>
              {renderActions(a)}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="bg-card rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-xl">¿Eliminar administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se revocará el acceso de <strong>{pendingDelete?.email}</strong> al panel de administración.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 px-8 font-bold"
              onClick={confirmDelete}
            >
              Sí, Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
