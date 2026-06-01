'use client';

import { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useFirebaseApp } from '@/firebase';
import { deleteConfirmSchema } from '@/lib/admin-schemas';
import type { Concesionario } from '@/lib/business-types';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2 } from 'lucide-react';

type Props = {
  dealership: (Concesionario & { id: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Hard-confirmation flow for tenant deletion. The user must type ELIMINAR, then
 * the secure `deleteTenant` Cloud Function (Admin SDK) performs the recursive
 * delete — never the client SDK.
 */
export function DeleteTenantDialog({ dealership, open, onOpenChange }: Props) {
  const app = useFirebaseApp();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setIsDeleting(false);
    }
  }, [open]);

  const canDelete = deleteConfirmSchema.safeParse({ confirmText }).success;

  const handleDelete = async () => {
    if (!dealership || !canDelete) return;
    setIsDeleting(true);
    try {
      const callable = httpsCallable(getFunctions(app), 'deleteTenant');
      await callable({ concesionarioId: dealership.id });
      toast({
        title: 'Concesionario eliminado',
        description: `${dealership.nombre_empresa} y todos sus datos fueron borrados.`,
      });
      onOpenChange(false);
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Verifique permisos y el deploy de Cloud Functions.';
      toast({ variant: 'destructive', title: 'Error al eliminar', description: message });
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!isDeleting) onOpenChange(o);
      }}
    >
      <AlertDialogContent className="bg-card rounded-[2rem]">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-2xl font-bold font-headline text-center">
            ¿Eliminar concesionario?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Se borrará <strong>{dealership?.nombre_empresa}</strong>, todas sus subcolecciones (inventario,
            ventas, clientes, etc.) y sus publicaciones públicas del Marketplace. Esta acción es{' '}
            <strong>irreversible</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-delete">
            Escriba <span className="font-black tracking-wide">ELIMINAR</span> para confirmar
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ELIMINAR"
            disabled={isDeleting}
            className="rounded-xl h-12"
            autoFocus
          />
        </div>
        <AlertDialogFooter className="gap-3">
          <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            className="rounded-xl px-8 font-bold"
            disabled={!canDelete || isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Sí, Eliminar'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
