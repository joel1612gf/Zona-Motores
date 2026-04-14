'use client';

import React from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { FiscalNoteForm } from './fiscal-note-form';
import { ArrowUpDown, Receipt } from 'lucide-react';

interface FiscalNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'DEBIT' | 'CREDIT';
}

export function FiscalNoteDialog({ open, onOpenChange, type }: FiscalNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-card/95 backdrop-blur-xl ring-1 ring-border">
        <DialogHeader className="p-6 md:p-8 bg-muted/30 border-b relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className={`p-3 rounded-2xl shadow-lg ${type === 'DEBIT' ? 'bg-primary shadow-primary/20' : 'bg-emerald-600 shadow-emerald-600/20'}`}>
              {type === 'DEBIT' ? <ArrowUpDown className="h-6 w-6 text-primary-foreground" /> : <Receipt className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold font-headline">
                Nota de {type === 'DEBIT' ? 'Débito' : 'Crédito'} Fiscal
              </DialogTitle>
              <DialogDescription className="text-sm font-medium">
                Ajuste de saldo para facturas de compra (Cuentas por Pagar)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <FiscalNoteForm type={type} onSuccess={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
