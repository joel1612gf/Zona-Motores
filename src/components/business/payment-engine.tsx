'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type { PaymentSplit } from '@/lib/finance-schemas';

interface PaymentEngineProps {
  totalUsd: number;
  metodosPago: string[];
  metodosPagoDivisa: string[];
  tasaBcv: number;
  onValidChange: (isValid: boolean, splits: PaymentSplit[], totalEquivalentUsd: number) => void;
}

export function PaymentEngine({ totalUsd, metodosPago, metodosPagoDivisa, tasaBcv, onValidChange }: PaymentEngineProps) {
  const [splits, setSplits] = useState<PaymentSplit[]>([]);

  const totalPaidUsd = splits.reduce((acc, split) => acc + (split.equivalentUsd || 0), 0);
  const remainingUsd = Math.max(0, totalUsd - totalPaidUsd);
  const changeUsd = Math.max(0, totalPaidUsd - totalUsd);
  
  // Floating point tolerance for "0 remaining"
  const isValid = totalPaidUsd >= (totalUsd - 0.01) && splits.length > 0;

  useEffect(() => {
    onValidChange(isValid, splits, totalPaidUsd);
  }, [isValid, splits, totalPaidUsd, onValidChange]);

  const handleAddSplit = () => {
    const defaultMethod = metodosPago[0] || '';
    const isDivisa = metodosPagoDivisa.includes(defaultMethod);
    const amount = remainingUsd > 0 ? remainingUsd : 0;
    const currency = isDivisa ? 'USD' : 'VES';
    
    setSplits([...splits, { 
      method: defaultMethod, 
      currency, 
      amount: currency === 'VES' ? amount * tasaBcv : amount, 
      exchangeRate: tasaBcv, 
      igtfAmount: isDivisa ? amount * 0.03 : 0, 
      equivalentUsd: amount 
    }]);
  };

  const handleUpdateSplit = (index: number, field: keyof PaymentSplit, value: any) => {
    const newSplits = [...splits];
    const split = { ...newSplits[index], [field]: value };
    
    if (field === 'method') {
      const isDivisa = metodosPagoDivisa.includes(value as string);
      split.currency = isDivisa ? 'USD' : 'VES';
      // Recalculate amount if currency changes? Let's just keep the amount and recalculate equivalent
    }
    
    if (split.currency === 'USD') {
      split.equivalentUsd = split.amount;
      const isDivisa = metodosPagoDivisa.includes(split.method);
      split.igtfAmount = isDivisa ? split.amount * 0.03 : 0;
    } else {
      split.equivalentUsd = split.amount / split.exchangeRate;
      split.igtfAmount = 0;
    }
    
    newSplits[index] = split;
    setSplits(newSplits);
  };

  const handleRemoveSplit = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Desglose de Pagos</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleAddSplit}><Plus className="h-4 w-4 mr-2" /> Agregar Pago</Button>
      </div>

      <div className="space-y-3">
        {splits.map((split, i) => (
          <Card key={i} className="p-3 flex items-end gap-3 bg-muted/20">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Método</Label>
              <Select value={split.method} onValueChange={(v) => handleUpdateSplit(i, 'method', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metodosPago.map(m => (
                    <SelectItem key={m} value={m}>{m} {metodosPagoDivisa.includes(m) ? '(USD)' : '(Bs)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-28 space-y-1.5">
              <Label className="text-xs">Monto ({split.currency})</Label>
              <Input type="number" className="h-9 text-sm" value={split.amount || ''} onChange={(e) => handleUpdateSplit(i, 'amount', Number(e.target.value))} />
            </div>

            {split.currency === 'VES' && (
              <div className="w-20 space-y-1.5 opacity-70">
                <Label className="text-xs">Tasa</Label>
                <Input type="number" className="h-9 text-sm" value={split.exchangeRate} onChange={(e) => handleUpdateSplit(i, 'exchangeRate', Number(e.target.value))} disabled />
              </div>
            )}
            
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveSplit(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
        {splits.length === 0 && (
          <div className="text-center p-4 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
            No hay métodos de pago registrados.
          </div>
        )}
      </div>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground"><span>Total a Pagar:</span> <span>${totalUsd.toFixed(2)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Total Abonado:</span> <span>${totalPaidUsd.toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold border-t border-primary/20 pt-2 text-base">
          <span>{changeUsd > 0 ? 'Vuelto:' : 'Restante:'}</span> 
          <span className={changeUsd > 0.01 ? 'text-orange-600' : remainingUsd > 0.01 ? 'text-red-600' : 'text-green-600'}>
            ${(changeUsd > 0 ? changeUsd : remainingUsd).toFixed(2)}
          </span>
        </div>
        {splits.some(s => s.igtfAmount > 0) && (
          <div className="flex justify-between text-xs text-amber-600 pt-1">
            <span>IGTF Total (3%):</span>
            <span className="font-bold">${splits.reduce((a, b) => a + (b.igtfAmount || 0), 0).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
