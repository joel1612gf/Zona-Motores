'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentSplit } from '@/lib/finance-schemas';
import type { BankAccount, BankEntryMethod } from '@/lib/business-types';
import { BANK_ENTRY_METHOD_LABELS, BANK_ACCOUNT_TYPE_ICONS, BANK_ACCOUNT_TYPE_LABELS } from '@/lib/business-types';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single row in the payment split table */
interface SplitRow extends PaymentSplit {
  /** Selected entry method (e.g. 'pago_movil') */
  entryMethod: BankEntryMethod | '';
  /** Selected account id — required if multiple accounts support the chosen method */
  accountId: string;
  accountName: string;
}

interface PaymentEngineProps {
  /** Total amount to collect in USD */
  totalUsd: number;
  /** BCV exchange rate — Bs per USD */
  tasaBcv: number;
  /** Active bank accounts from Firestore (already filtered by activa=true) */
  bankAccounts: BankAccount[];
  /** Called whenever validity or split values change */
  onValidChange: (isValid: boolean, splits: PaymentSplit[], totalEquivalentUsd: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the entry methods that have at least one active bank account supporting them.
 * Result is deduplicated and sorted for display.
 */
function getAvailableEntryMethods(accounts: BankAccount[]): BankEntryMethod[] {
  const set = new Set<BankEntryMethod>();
  for (const acc of accounts) {
    if (!acc.activa) continue;
    for (const [method, enabled] of Object.entries(acc.metodos_entrada)) {
      if (enabled) set.add(method as BankEntryMethod);
    }
  }
  // Preferred display order
  const order: BankEntryMethod[] = [
    'pago_movil', 'transferencia', 'punto_de_venta', 'efectivo_fisico', 'zelle', 'crypto'
  ];
  return order.filter(m => set.has(m));
}

/** Returns accounts that accept a given entry method */
function getAccountsForMethod(accounts: BankAccount[], method: BankEntryMethod): BankAccount[] {
  return accounts.filter(acc => acc.activa && acc.metodos_entrada[method]);
}

/** Builds a PaymentSplit from a row's current values */
function buildSplit(
  row: Pick<SplitRow, 'entryMethod' | 'accountId' | 'accountName' | 'amount'>,
  account: BankAccount | undefined,
  tasaBcv: number
): PaymentSplit {
  const isUSD = account?.es_divisa ?? false;
  const currency = isUSD ? 'USD' : 'VES';
  const amount = row.amount || 0;

  return {
    method: account
      ? `${BANK_ENTRY_METHOD_LABELS[row.entryMethod as BankEntryMethod] ?? row.entryMethod} — ${account.nombre}`
      : ((BANK_ENTRY_METHOD_LABELS[row.entryMethod as BankEntryMethod] ?? row.entryMethod) || ''),
    currency,
    amount,
    exchangeRate: tasaBcv,
    igtfAmount: isUSD ? amount * 0.03 : 0,
    equivalentUsd: isUSD ? amount : amount / tasaBcv,
    accountId: row.accountId || undefined,
    accountName: row.accountName || undefined,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PaymentEngine({ totalUsd, tasaBcv, bankAccounts, onValidChange }: PaymentEngineProps) {
  const [rows, setRows] = useState<SplitRow[]>([]);

  const availableMethods = useMemo(() => getAvailableEntryMethods(bankAccounts), [bankAccounts]);

  // Derive splits from rows to expose upward
  const splits = useMemo<PaymentSplit[]>(() => {
    return rows.map(row => {
      const account = bankAccounts.find(a => a.id === row.accountId);
      return buildSplit(row, account, tasaBcv);
    });
  }, [rows, bankAccounts, tasaBcv]);

  const totalPaidUsd = splits.reduce((acc, s) => acc + (s.equivalentUsd || 0), 0);
  const remainingUsd = Math.max(0, totalUsd - totalPaidUsd);
  const changeUsd    = Math.max(0, totalPaidUsd - totalUsd);
  const isValid      = rows.length > 0 &&
                       totalPaidUsd >= (totalUsd - 0.01) &&
                       rows.every(r => r.entryMethod && r.accountId);

  useEffect(() => {
    onValidChange(isValid, splits, totalPaidUsd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, totalPaidUsd, JSON.stringify(splits)]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddRow = () => {
    const defaultMethod = availableMethods[0] ?? '';
    const accountsForDefault = defaultMethod ? getAccountsForMethod(bankAccounts, defaultMethod) : [];
    const defaultAccount = accountsForDefault[0];
    const isUSD = defaultAccount?.es_divisa ?? false;
    const defaultAmount = remainingUsd > 0
      ? (isUSD ? remainingUsd : remainingUsd * tasaBcv)
      : 0;

    setRows(prev => [...prev, {
      entryMethod: defaultMethod,
      accountId: defaultAccount?.id ?? '',
      accountName: defaultAccount?.nombre ?? '',
      method: '',
      currency: isUSD ? 'USD' : 'VES',
      amount: defaultAmount,
      exchangeRate: tasaBcv,
      igtfAmount: 0,
      equivalentUsd: 0,
    }]);
  };

  const handleMethodChange = (index: number, method: BankEntryMethod) => {
    setRows(prev => {
      const newRows = [...prev];
      const row = { ...newRows[index] };
      const accounts = getAccountsForMethod(bankAccounts, method);
      const firstAccount = accounts[0];
      const isUSD = firstAccount?.es_divisa ?? false;

      row.entryMethod = method;
      row.accountId = firstAccount?.id ?? '';
      row.accountName = firstAccount?.nombre ?? '';
      // Recalculate amount for the remaining balance in new currency
      const remaining = Math.max(0, totalUsd - splits.reduce((a, s, i) => i !== index ? a + (s.equivalentUsd || 0) : a, 0));
      row.amount = isUSD ? remaining : remaining * tasaBcv;

      newRows[index] = row;
      return newRows;
    });
  };

  const handleAccountChange = (index: number, accountId: string) => {
    const account = bankAccounts.find(a => a.id === accountId);
    setRows(prev => {
      const newRows = [...prev];
      const row = { ...newRows[index] };
      const wasUSD = row.currency === 'USD';
      const isNowUSD = account?.es_divisa ?? false;

      row.accountId = accountId;
      row.accountName = account?.nombre ?? '';

      // Convert amount when switching currency
      if (wasUSD && !isNowUSD) row.amount = row.amount * tasaBcv;
      else if (!wasUSD && isNowUSD) row.amount = row.amount / tasaBcv;

      row.currency = isNowUSD ? 'USD' : 'VES';
      newRows[index] = row;
      return newRows;
    });
  };

  const handleAmountChange = (index: number, value: number) => {
    setRows(prev => {
      const newRows = [...prev];
      newRows[index] = { ...newRows[index], amount: value };
      return newRows;
    });
  };

  const handleRemoveRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (bankAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 text-center">
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <div>
          <p className="font-semibold text-amber-800 text-sm">No hay cuentas bancarias configuradas</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Ve al módulo <strong>Bancos</strong> y crea al menos una cuenta con métodos de cobro habilitados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Split rows */}
      <div className="space-y-3">
        {rows.map((row, i) => {
          const accountsForMethod = row.entryMethod
            ? getAccountsForMethod(bankAccounts, row.entryMethod)
            : [];
          const needsAccountSelect = accountsForMethod.length > 1;
          const selectedAccount = bankAccounts.find(a => a.id === row.accountId);
          const isUSD = selectedAccount?.es_divisa ?? false;
          const split = splits[i];

          return (
            <div key={i} className="rounded-xl border bg-card/60 backdrop-blur-sm p-3 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2">
                {/* Method selector */}
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Método de Pago</Label>
                  <Select
                    value={row.entryMethod}
                    onValueChange={(v) => handleMethodChange(i, v as BankEntryMethod)}
                  >
                    <SelectTrigger className="h-10 text-sm font-medium">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMethods.map(m => (
                        <SelectItem key={m} value={m}>
                          {BANK_ENTRY_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="w-36 space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Monto ({isUSD ? 'USD' : 'VES'})
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      className="h-10 font-bold pr-8"
                      value={row.amount || ''}
                      onChange={e => handleAmountChange(i, Number(e.target.value))}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                      {isUSD ? '$' : 'Bs'}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-red-400 hover:text-red-600 hover:bg-red-50 mt-5 shrink-0"
                  onClick={() => handleRemoveRow(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Account selector — only shown when method supports multiple accounts */}
              {row.entryMethod && needsAccountSelect && (
                <div className="space-y-1 pl-1">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    ¿A cuál cuenta?
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {accountsForMethod.map(acc => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleAccountChange(i, acc.id)}
                        className={cn(
                          'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left',
                          row.accountId === acc.id
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-muted bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:border-primary/30'
                        )}
                      >
                        <span className="text-base shrink-0">{BANK_ACCOUNT_TYPE_ICONS[acc.tipo]}</span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{acc.nombre}</p>
                          {acc.banco && (
                            <p className="truncate text-[10px] opacity-70">{acc.banco}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Single account — just show a badge */}
              {row.entryMethod && !needsAccountSelect && selectedAccount && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-sm">{BANK_ACCOUNT_TYPE_ICONS[selectedAccount.tipo]}</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedAccount.nombre}
                    {selectedAccount.banco ? ` (${selectedAccount.banco})` : ''}
                  </span>
                  {isUSD && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-bold ml-auto">
                      IGTF 3%
                    </span>
                  )}
                </div>
              )}

              {/* Equivalence line */}
              {split && split.equivalentUsd > 0 && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-1 border-t pt-2">
                  <span>≈ ${split.equivalentUsd.toFixed(2)} USD</span>
                  {split.igtfAmount > 0 && (
                    <span className="text-amber-600 font-bold ml-auto">
                      + IGTF ${split.igtfAmount.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="text-center p-6 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
            Pulsa <strong>Agregar Pago</strong> para registrar un método
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed h-11 gap-2 text-sm"
        onClick={handleAddRow}
      >
        <Plus className="h-4 w-4" /> Agregar Pago
      </Button>

      {/* Totals summary */}
      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Total a Pagar:</span>
          <span className="font-mono">${totalUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Total Abonado:</span>
          <span className="font-mono">${totalPaidUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold border-t border-primary/20 pt-2 text-base">
          <span>{changeUsd > 0.01 ? 'Vuelto:' : 'Restante:'}</span>
          <span className={cn(
            'font-mono',
            changeUsd > 0.01 ? 'text-orange-600' : remainingUsd > 0.01 ? 'text-red-600' : 'text-green-600'
          )}>
            ${(changeUsd > 0.01 ? changeUsd : remainingUsd).toFixed(2)}
          </span>
        </div>
        {splits.some(s => (s.igtfAmount ?? 0) > 0) && (
          <div className="flex justify-between text-xs text-amber-600 pt-1 border-t border-amber-200">
            <span>IGTF Total (3% Divisas):</span>
            <span className="font-bold font-mono">
              ${splits.reduce((a, s) => a + (s.igtfAmount ?? 0), 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
