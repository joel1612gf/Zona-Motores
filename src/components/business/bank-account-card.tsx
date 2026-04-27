'use client';

import { useState } from 'react';
import {
  Landmark, Wallet, Zap, Bitcoin, CreditCard,
  TrendingUp, TrendingDown, MoreVertical, Power, Pencil, SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useToast } from '@/hooks/use-toast';
import type { BankAccount, BankAccountType } from '@/lib/business-types';
import { BANK_ACCOUNT_TYPE_LABELS } from '@/lib/business-types';

// ─── ICON MAP ──────────────────────────────────────────────────────────────

const TYPE_ICON: Record<BankAccountType, React.ComponentType<{ className?: string }>> = {
  banco_nacional: Landmark,
  efectivo_bs:    Wallet,
  efectivo_usd:   Wallet,
  zelle:          Zap,
  crypto:         Bitcoin,
  otro:           CreditCard,
};

const TYPE_GRADIENT: Record<BankAccountType, string> = {
  banco_nacional: 'from-blue-600 to-blue-800',
  efectivo_bs:    'from-emerald-500 to-emerald-700',
  efectivo_usd:   'from-green-500 to-green-700',
  zelle:          'from-violet-500 to-violet-700',
  crypto:         'from-orange-500 to-orange-700',
  otro:           'from-slate-500 to-slate-700',
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

  const Icon = TYPE_ICON[account.tipo] ?? CreditCard;
  const gradient = TYPE_GRADIENT[account.tipo] ?? 'from-slate-500 to-slate-700';

  const enabledEntryCount = Object.values(account.metodos_entrada).filter(Boolean).length;
  const enabledExitCount  = Object.values(account.metodos_salida).filter(Boolean).length;

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

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-[1.5rem] overflow-hidden border transition-all duration-300',
        'bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg hover:shadow-xl hover:-translate-y-1',
        account.activa
          ? 'border-white/40 dark:border-white/10'
          : 'border-slate-200/40 dark:border-slate-700/40 opacity-60'
      )}
    >
      {/* Card Top Gradient */}
      <div className={cn('relative bg-gradient-to-br p-5 pb-8', gradient)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">
                {BANK_ACCOUNT_TYPE_LABELS[account.tipo]}
              </p>
              <p className="text-white font-bold text-base leading-tight truncate max-w-[160px]">
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
                className="h-8 w-8 rounded-lg text-white/70 hover:text-white hover:bg-white/20 shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem onClick={() => onViewDetail(account)} className="rounded-lg gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Ver Detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(account)} className="rounded-lg gap-2">
                <Pencil className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleToggleActive}
                disabled={isToggling}
                className={cn('rounded-lg gap-2', account.activa ? 'text-red-500' : 'text-green-600')}
              >
                <Power className="h-4 w-4" />
                {account.activa ? 'Desactivar' : 'Activar'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Divisa badge */}
        {account.es_divisa && (
          <Badge className="absolute bottom-3 left-5 text-[9px] bg-white/20 border-white/30 text-white backdrop-blur-sm">
            IGTF 3%
          </Badge>
        )}
        {!account.activa && (
          <Badge className="absolute bottom-3 right-5 text-[9px] bg-black/30 border-black/20 text-white backdrop-blur-sm">
            INACTIVA
          </Badge>
        )}
      </div>

      {/* Card Body — overlaps gradient */}
      <div className="relative -mt-4 mx-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/10 p-4 shadow-sm">
        {/* Balance */}
        <div className="mb-3">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest mb-0.5">
            Saldo Actual
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatBalance(account.saldo_actual, account.moneda)}
          </p>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-green-500" />
            <span>{enabledEntryCount} métodos entrada</span>
          </div>
          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-red-400" />
            <span>{enabledExitCount} métodos salida</span>
          </div>
        </div>

        {/* Number if available */}
        {account.numero_cuenta && (
          <p className="mt-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">
            {account.numero_cuenta}
          </p>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-4 pb-4 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 transition-all"
          onClick={() => onViewDetail(account)}
        >
          Ver Cuenta →
        </Button>
      </div>
    </div>
  );
}
