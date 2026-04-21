'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FileText, Package, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurchaseEntrySwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: 'fiscal' | 'delivery') => void;
}

export function PurchaseEntrySwitcher({ open, onOpenChange, onSelectType }: PurchaseEntrySwitcherProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden bg-white/70 backdrop-blur-2xl border-slate-200/60 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] rounded-[2.5rem]">
        <div className="p-8 pb-4 border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-transparent shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
              ¿Qué tipo de entrada deseas cargar?
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Selecciona el documento legal o administrativo que respalda esta entrada de inventario.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option: Fiscal Invoice */}
          <button
            onClick={() => onSelectType('fiscal')}
            className="group relative flex flex-col items-center text-center p-6 rounded-[2rem] bg-white border border-slate-200 hover:border-blue-500/50 hover:bg-blue-50/30 transition-all duration-300 shadow-sm hover:shadow-xl hover:translate-y-[-4px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Factura Fiscal</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Respaldo oficial con validez tributaria. Genera retenciones automáticas.
            </p>
            <div className="mt-4 flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Seleccionar <ChevronRight className="w-3 h-3" />
            </div>
          </button>

          {/* Option: Delivery Note */}
          <button
            onClick={() => onSelectType('delivery')}
            className="group relative flex flex-col items-center text-center p-6 rounded-[2rem] bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all duration-300 shadow-sm hover:shadow-xl hover:translate-y-[-4px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Nota de Entrega</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Control administrativo interno. No constituye factura fiscal inmediata.
            </p>
            <div className="mt-4 flex items-center gap-1 text-[10px] font-black text-slate-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Seleccionar <ChevronRight className="w-3 h-3" />
            </div>
          </button>
        </div>

        <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
            Zona Motores Business • Gestión Integral de Inventario
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
