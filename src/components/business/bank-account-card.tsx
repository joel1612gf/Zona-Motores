'use client';

import { useState } from 'react';
import {
  Landmark, Wallet, Zap, Bitcoin, CreditCard,
  TrendingUp, TrendingDown, MoreVertical, Power, Pencil, SlidersHorizontal, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useToast } from '@/hooks/use-toast';
import type { BankAccount, BankAccountType } from '@/lib/business-types';
import { BANK_ACCOUNT_TYPE_LABELS } from '@/lib/business-types';

// ─── ICON MAP ──────────────────────────────────────────────────────────────

const TYPE_ICON: Record<BankAccountType, React.ComponentType<{ className?: string }>> = {
  banco:    Landmark,
  efectivo: Wallet,
  otro:     CreditCard,
};

const TYPE_GRADIENT: Record<BankAccountType, string> = {
  banco:    'from-blue-600 to-blue-700',
  efectivo: 'from-sky-400 to-sky-600',
  otro:     'from-slate-600 to-slate-800',
};

// ─── FORMAT HELPERS ────────────────────────────────────────────────────────

function formatBalance(amount: number, moneda: 'USD' | 'VES'): string {
  if (moneda === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' Bs';
}

// ─── PROPS ─────────────────────────────────────────────────────────────────

interface BankAccountCardProps {
  account: BankAccount;
  concesionarioId: string;
  onEdit: (account: BankAccount) => void;
  onViewDetail: (account: BankAccount) => void;
  onRefresh: () => void;
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────

export function BankAccountCard({
  account, concesionarioId, onEdit, onViewDetail, onRefresh
}: BankAccountCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const Icon = TYPE_ICON[account.tipo] ?? CreditCard;
  const gradient = TYPE_GRADIENT[account.tipo] ?? 'from-slate-500 to-slate-700';

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      await updateDoc(
        doc(firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', account.id),
        { activa: !account.activa, updated_at: serverTimestamp() }
      );
      toast({
        title: account.activa ? 'Cuenta desactivada' : 'Cuenta activada',
        description: account.nombre,
      });
      onRefresh();
    } catch {
      toast({ variant: 'destructive', title: 'Error al cambiar estado de la cuenta.' });
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'concesionarios', concesionarioId, 'cuentas_bancarias', account.id));
      toast({
        title: 'Cuenta eliminada',
        description: `Se ha eliminado la cuenta ${account.nombre} permanentemente.`,
      });
      onRefresh();
    } catch (err) {
      console.error('[BankAccountCard] Delete error:', err);
      toast({ variant: 'destructive', title: 'Error al eliminar la cuenta.' });
    } finally {
      setIsDeleting(false);
      setShowDeleteAlert(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'group relative flex flex-col rounded-[2.5rem] overflow-hidden border transition-all duration-500',
          'bg-card/40 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:-translate-y-2',
          account.activa
            ? 'border-white/20 dark:border-white/10'
            : 'border-slate-200/40 dark:border-slate-700/40 opacity-60'
        )}
      >
        {/* Card Top Gradient */}
        <div className={cn('relative bg-gradient-to-br p-6 pb-12', gradient)}>
          <div className="absolute inset-0 bg-black/5" />
          <div className="relative flex items-start justify-between z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-white/80 text-[10px] font-bold uppercase tracking-[0.2em]">
                  {BANK_ACCOUNT_TYPE_LABELS[account.tipo]}
                </p>
                <p className="text-white font-black text-lg leading-tight truncate max-w-[180px]">
                  {account.nombre}
                </p>
              </div>
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-white/20 shrink-0 backdrop-blur-sm transition-colors"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-[1.5rem] p-2 bg-popover/80 backdrop-blur-xl border-white/20 shadow-2xl">
                <DropdownMenuItem 
                  onSelect={(e) => { e.preventDefault(); onViewDetail(account); }} 
                  className="rounded-xl gap-3 p-3 cursor-pointer"
                >
                  <SlidersHorizontal className="h-4 w-4 text-primary" /> 
                  <span className="font-semibold">Ver Detalle</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={(e) => { e.preventDefault(); onEdit(account); }} 
                  className="rounded-xl gap-3 p-3 cursor-pointer"
                >
                  <Pencil className="h-4 w-4 text-amber-500" /> 
                  <span className="font-semibold">Editar</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={handleToggleActive}
                  disabled={isToggling}
                  className={cn('rounded-xl gap-3 p-3 cursor-pointer', account.activa ? 'text-red-500' : 'text-emerald-500')}
                >
                  <Power className="h-4 w-4" />
                  <span className="font-semibold">{account.activa ? 'Desactivar' : 'Activar'}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); setShowDeleteAlert(true); }}
                  className="rounded-xl gap-3 p-3 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="font-semibold">Eliminar Permanentemente</span>
                </DropdownMenuItem>
              </DropdownMenuContent>            </DropdownMenu>
          </div>

          {/* Status badges */}
          <div className="absolute bottom-4 left-6 flex items-center gap-2 z-10">
            {!account.activa && (
              <Badge className="text-[9px] font-bold bg-red-500/20 border-red-500/30 text-red-200 backdrop-blur-md px-2 py-0.5 rounded-full">
                INACTIVA
              </Badge>
            )}
          </div>
        </div>

        {/* Card Body — overlaps gradient */}
        <div className="relative -mt-6 mx-5 bg-card/80 dark:bg-slate-900/90 backdrop-blur-md rounded-[2rem] border border-white/40 dark:border-white/10 p-5 shadow-2xl z-20">
          {/* Balance */}
          <div className="mb-4">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">
              Saldo Actual
            </p>
            <p className="text-3xl font-black text-foreground tracking-tighter">
              {formatBalance(account.saldo_actual, account.moneda)}
            </p>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Moneda</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-black h-5 px-2 bg-primary/5 border-primary/10">
                  {account.moneda}
                </Badge>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-100 dark:border-white/5" />
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Categoría</span>
              <div className="flex items-center gap-1.5">
                 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                   {BANK_ACCOUNT_TYPE_LABELS[account.tipo]}
                 </span>
              </div>
            </div>
          </div>

          {/* Number if available */}
          {account.numero_cuenta && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
              <p className="text-[10px] font-mono text-muted-foreground/60 truncate bg-muted/50 p-2 rounded-lg">
                {account.numero_cuenta}
              </p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 pb-6 pt-4 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-2xl text-xs font-bold text-primary hover:bg-primary/5 hover:text-primary transition-all h-10 border border-primary/10"
            onClick={() => onViewDetail(account)}
          >
            Gestionar Cuenta →
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="rounded-[2rem] bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black tracking-tight">¿Eliminar esta cuenta?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              Esta acción eliminará permanentemente la cuenta <strong>{account.nombre}</strong> y su historial de transacciones asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isDeleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20 border-none"
            >
              {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
