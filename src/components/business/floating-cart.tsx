'use client';

import { useState } from 'react';
import { ShoppingCart, X, Trash2, Minus, Plus } from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export function FloatingCart() {
  const { items, totalUSD, totalVES, enviarACaja, removeItem, updateQuantity } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-4 bg-background/80 backdrop-blur-xl border border-white/20 dark:border-border/50 shadow-2xl rounded-full px-6 py-3 transition-all cursor-pointer hover:bg-background/90 hover:scale-105 active:scale-95">
            <div className="relative">
              <ShoppingCart className="h-6 w-6 text-primary" />
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {items.reduce((acc, item) => acc + item.cantidad, 0)}
              </span>
            </div>
            
            <div className="flex flex-col text-sm font-bold border-l pl-4 border-border">
              <span>{formatCurrency(totalUSD)}</span>
              <span className="text-[10px] text-muted-foreground">Bs. {totalVES.toFixed(2)}</span>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 mb-4 bg-background/90 backdrop-blur-xl border-white/20 shadow-2xl" align="center" side="top">
          <div className="flex flex-col h-full max-h-[60vh]">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Pre-factura
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-card/50 rounded-lg border border-border/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm leading-tight">{item.nombre}</p>
                        <p className="text-xs text-muted-foreground">{item.codigo}</p>
                      </div>
                      <p className="font-bold text-sm">{formatCurrency(item.precio_usd * item.cantidad)}</p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center bg-background/50 rounded-md border border-border/50">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-none"
                          onClick={() => {
                            if (item.cantidad > 1) updateQuantity(item.id, item.cantidad - 1);
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-medium w-8 text-center">{item.cantidad}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-none"
                          onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t border-border/50 bg-card/50 rounded-b-lg">
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="text-muted-foreground">Total Negociado:</span>
                <div className="text-right">
                  <p className="font-bold text-base">{formatCurrency(totalUSD)}</p>
                  <p className="text-xs text-muted-foreground">Bs. {totalVES.toFixed(2)}</p>
                </div>
              </div>
              <Button 
                className="w-full font-bold shadow-lg shadow-primary/20" 
                onClick={async () => {
                  await enviarACaja();
                  setIsOpen(false);
                }}
              >
                Enviar a Caja
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
