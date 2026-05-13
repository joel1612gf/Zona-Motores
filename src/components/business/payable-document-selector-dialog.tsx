'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { PayableRow } from '@/lib/payable-schemas';
import { FileText, Layers, ChevronRight } from 'lucide-react';

interface PayableDocumentSelectorDialogProps {
  open: boolean;
  parentRow: PayableRow;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedRows: PayableRow[]) => void;
}

/**
 * Pre-payment selector. When a CXP invoice has linked debit notes,
 * the user picks which documents to pay (invoice, notes, or both)
 * before the PaymentEngine modal opens.
 */
export function PayableDocumentSelectorDialog({
  open, parentRow, onOpenChange, onConfirm,
}: PayableDocumentSelectorDialogProps) {
  const documents = useMemo<PayableRow[]>(() => {
    return [parentRow, ...(parentRow.linkedNotes ?? [])];
  }, [parentRow]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reset to all-selected each time the dialog opens for a different parent
    setSelectedIds(new Set(documents.map(d => d.id)));
  }, [parentRow.id, documents]);

  const totalSelected = documents
    .filter(d => selectedIds.has(d.id))
    .reduce((acc, d) => acc + (d.saldo_pendiente || 0), 0);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const ordered = documents.filter(d => selectedIds.has(d.id));
    if (ordered.length === 0) return;
    onConfirm(ordered);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <div className="bg-primary/5 p-5 border-b">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              ¿Qué deseas pagar?
            </DialogTitle>
            <DialogDescription className="text-xs">
              {parentRow.proveedor_nombre} — Esta factura tiene {parentRow.linkedNotes?.length ?? 0}
              {' '}{(parentRow.linkedNotes?.length ?? 0) === 1 ? 'nota vinculada' : 'notas vinculadas'}.
              Selecciona los documentos a cancelar.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {documents.map(doc => {
            const isInvoice = doc.id === parentRow.id;
            const checked = selectedIds.has(doc.id);
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => toggle(doc.id)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition-all',
                  checked
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-border bg-card/40 hover:bg-card/70'
                )}
              >
                <Checkbox checked={checked} className="mt-1 pointer-events-none" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isInvoice
                      ? <FileText className="h-4 w-4 text-primary shrink-0" />
                      : <Layers className="h-4 w-4 text-amber-500 shrink-0" />}
                    <span className="text-sm font-bold truncate">
                      {isInvoice ? `Factura ${doc.descripcion}` : doc.descripcion}
                    </span>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                    {isInvoice ? (doc.is_fiscal ? 'Factura Fiscal' : 'Documento') : 'Nota de Débito'}
                    {doc.is_fiscal ? ' · Aplica IGTF' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Saldo</p>
                  <p className="text-sm font-bold text-foreground">
                    {formatCurrency(doc.saldo_pendiente, doc.moneda_original === 'bs' ? 'VES' : 'USD')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-5 border-t bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total seleccionado</span>
            <span className="text-base font-bold text-primary">{formatCurrency(totalSelected, 'USD')}</span>
          </div>
          <Button
            className="w-full h-12 rounded-2xl font-bold shadow-xl shadow-primary/20"
            disabled={selectedIds.size === 0}
            onClick={handleConfirm}
          >
            Continuar al Pago
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
