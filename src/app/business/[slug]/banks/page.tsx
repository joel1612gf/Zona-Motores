'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore } from '@/firebase';
import {
  collection, query, orderBy, onSnapshot, getDocs
} from 'firebase/firestore';
import {
  Landmark, Plus, RefreshCw, TrendingUp, TrendingDown, Wallet, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { BankAccount } from '@/lib/business-types';
import { BankAccountCard } from '@/components/business/bank-account-card';
import { BankAccountFormDialog } from '@/components/business/bank-account-form-dialog';
import { BankAccountDetailDialog } from '@/components/business/bank-account-detail-dialog';

// ─── HELPERS ───────────────────────────────────────────────────────────────

function formatBalance(amount: number, moneda: 'USD' | 'VES'): string {
  if (moneda === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(amount) + ' Bs';
}

// ─── PAGE ─────────────────────────────────────────────────────────────────

export default function BanksPage() {
  const { concesionario, hasPermission } = useBusinessAuth();
  const firestore = useFirestore();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [detailAccount, setDetailAccount] = useState<BankAccount | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = hasPermission('banks') === 'full';
  const canView   = !!hasPermission('banks');

  // ── REAL-TIME LISTENER ─────────────────────────────────────────────────

  useEffect(() => {
    if (!concesionario?.id) { setIsLoading(false); return; }

    const col = collection(firestore, 'concesionarios', concesionario.id, 'cuentas_bancarias');
    const q = query(col, orderBy('orden', 'asc'));

    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
      setIsLoading(false);
    }, (err) => {
      console.error('[BanksPage] Listener error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [concesionario?.id, firestore, refreshKey]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleEditAccount = (account: BankAccount) => {
    setEditingAccount(account);
    setFormOpen(true);
  };

  const handleViewDetail = (account: BankAccount) => {
    setDetailAccount(account);
    setDetailOpen(true);
  };

  const handleFormSaved = () => {
    setEditingAccount(null);
    handleRefresh();
  };

  // ── TOTALS ─────────────────────────────────────────────────────────────

  const activeAccounts = accounts.filter(a => a.activa);
  const totalUSD = activeAccounts
    .filter(a => a.moneda === 'USD')
    .reduce((s, a) => s + a.saldo_actual, 0);
  const totalVES = activeAccounts
    .filter(a => a.moneda === 'VES')
    .reduce((s, a) => s + a.saldo_actual, 0);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-400">
        <AlertCircle className="h-12 w-12" />
        <p className="text-lg font-semibold">Sin acceso al módulo de Bancos</p>
        <p className="text-sm text-center max-w-sm">
          Tu rol no tiene permisos para ver esta sección. Contacta al administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl">
            <Landmark className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Bancos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gestión de cuentas bancarias y tesorería
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canManage && (
            <Button
              onClick={() => { setEditingAccount(null); setFormOpen(true); }}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-500/25"
            >
              <Plus className="h-4 w-4" />
              Nueva Cuenta
            </Button>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ──────────────────────────────────────────────── */}
      {!isLoading && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total USD */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/20">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1">Total USD</p>
            <p className="text-3xl font-black tracking-tight">
              {formatBalance(totalUSD, 'USD')}
            </p>
            <div className="flex items-center gap-1 mt-2 text-blue-200 text-xs">
              <Wallet className="h-3.5 w-3.5" />
              <span>{activeAccounts.filter(a => a.moneda === 'USD').length} cuentas activas</span>
            </div>
          </div>

          {/* Total VES */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-lg shadow-emerald-500/20">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200 mb-1">Total Bolívares</p>
            <p className="text-3xl font-black tracking-tight">
              {formatBalance(totalVES, 'VES')}
            </p>
            <div className="flex items-center gap-1 mt-2 text-emerald-200 text-xs">
              <Wallet className="h-3.5 w-3.5" />
              <span>{activeAccounts.filter(a => a.moneda === 'VES').length} cuentas activas</span>
            </div>
          </div>

          {/* Total accounts */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Cuentas Totales</p>
            <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {accounts.length}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span className="text-green-600 font-semibold">{activeAccounts.length} activas</span>
              <span>·</span>
              <span className="text-slate-400">{accounts.length - activeAccounts.length} inactivas</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNTS GRID ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-60 rounded-[1.5rem]" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        /* EMPTY STATE */
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
            <div className="relative p-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-[2rem] shadow-xl">
              <Landmark className="h-14 w-14 text-blue-400 mx-auto" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Sin cuentas registradas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              Registra tus cuentas bancarias, efectivo y métodos de pago para gestionar
              la tesorería del negocio.
            </p>
          </div>
          {canManage && (
            <Button
              onClick={() => setFormOpen(true)}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6 shadow-lg shadow-blue-500/25"
            >
              <Plus className="h-4 w-4" />
              Registrar Primera Cuenta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((account) => (
            <BankAccountCard
              key={account.id}
              account={account}
              concesionarioId={concesionario!.id}
              onEdit={handleEditAccount}
              onViewDetail={handleViewDetail}
              onRefresh={handleRefresh}
            />
          ))}

          {/* ADD NEW CARD */}
          {canManage && (
            <button
              onClick={() => { setEditingAccount(null); setFormOpen(true); }}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed',
                'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500',
                'hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400',
                'transition-all duration-300 min-h-[240px] hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
              )}
            >
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100">
                <Plus className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold">Agregar Cuenta</p>
            </button>
          )}
        </div>
      )}

      {/* ── DIALOGS ─────────────────────────────────────────────────────── */}
      <BankAccountFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingAccount(null); }}
        editAccount={editingAccount}
        onSaved={handleFormSaved}
      />

      <BankAccountDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        account={detailAccount}
        concesionarioId={concesionario?.id ?? ''}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
