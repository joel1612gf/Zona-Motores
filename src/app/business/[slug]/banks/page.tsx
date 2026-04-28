'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore } from '@/firebase';
import {
  collection, query, orderBy, onSnapshot, getDocs
} from 'firebase/firestore';
import {
  Landmark, Plus, RefreshCw, TrendingUp, TrendingDown, Wallet, AlertCircle, Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
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

  // ── UI FREEZE FIX ──────────────────────────────────────────────────────

  useEffect(() => {
    // If no main modals are open, force body pointer-events back to auto
    // This fixes the issue where closing a dialog leaves the UI stuck
    if (!formOpen && !detailOpen) {
      const timeout = setTimeout(() => {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
      }, 300); // Wait for animations to finish
      return () => clearTimeout(timeout);
    }
  }, [formOpen, detailOpen]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleEditAccount = (account: BankAccount) => {
    setDetailOpen(false);
    // Force a small delay to ensure cleanup of previous modal
    setTimeout(() => {
      setEditingAccount(account);
      setFormOpen(true);
    }, 150);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Landmark className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Bancos</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Gestión de cuentas bancarias y tesorería
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl h-12 w-12 border-primary/20 hover:bg-primary/5"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-5 w-5 text-primary" />
          </Button>
          {canManage && (
            <Button
              onClick={() => { setEditingAccount(null); setFormOpen(true); }}
              className="flex-1 md:flex-none rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold"
            >
              <Plus className="h-5 w-5" />
              Nueva Cuenta
            </Button>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ──────────────────────────────────────────────── */}
      {!isLoading && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Total USD */}
          <Card className="border-none shadow-2xl bg-gradient-to-br from-blue-600/90 to-blue-800/90 backdrop-blur-md ring-1 ring-white/20 rounded-[2rem] overflow-hidden group">
            <CardContent className="p-6 relative">
              {/* Background Icon Watermark */}
              <Banknote className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10 -rotate-12 group-hover:scale-110 group-hover:rotate-0 transition-all duration-700" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100/70">Total USD</p>
                </div>
                <p className="text-3xl font-black tracking-tight text-white mb-1">
                  {formatBalance(totalUSD, 'USD')}
                </p>
                <div className="flex items-center gap-2 text-blue-100/80 text-xs font-medium">
                  <div className="h-1 w-1 rounded-full bg-blue-300 animate-pulse" />
                  {activeAccounts.filter(a => a.moneda === 'USD').length} cuentas activas
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total VES */}
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[2rem] overflow-hidden group">
            <CardContent className="p-6 relative">
              {/* Background Icon Watermark */}
              <Landmark className="absolute -right-4 -bottom-4 h-32 w-32 text-primary/5 -rotate-12 group-hover:scale-110 group-hover:rotate-0 transition-all duration-700" />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <TrendingDown className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Bolívares</p>
                </div>
                <p className="text-3xl font-black tracking-tight text-primary mb-1">
                  {formatBalance(totalVES, 'VES')}
                </p>
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                  <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  {activeAccounts.filter(a => a.moneda === 'VES').length} cuentas activas
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total accounts */}
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[2rem] overflow-hidden group">
            <CardContent className="p-6 relative">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cuentas Totales</p>
              </div>
              <p className="text-3xl font-black tracking-tight text-foreground mb-1">
                {accounts.length}
              </p>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="text-emerald-500 flex items-center gap-1">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                   {activeAccounts.length} activas
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-slate-400">
                  {accounts.length - activeAccounts.length} inactivas
                </span>
              </div>
            </CardContent>
          </Card>
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
                'group flex flex-col items-center justify-center gap-4 rounded-[2.5rem] border-2 border-dashed',
                'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500',
                'hover:border-primary hover:bg-primary/5 transition-all duration-500 min-h-[300px]',
                'relative overflow-hidden'
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-900 group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-500 shadow-inner">
                <Plus className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
              </div>
              <div className="relative text-center space-y-1">
                <p className="text-sm font-black text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors uppercase tracking-widest">
                  Nueva Cuenta
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Click para registrar</p>
              </div>
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
        onEdit={handleEditAccount}
      />
    </div>
  );
}
