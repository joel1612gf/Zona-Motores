'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';
import { useToast } from '@/hooks/use-toast';

export type CartItem = { 
  id: string; 
  codigo: string; 
  nombre: string; 
  cantidad: number; 
  precio_usd: number; 
  aplica_iva: boolean; 
  stock_actual: number; 
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: any, qty: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  totalUSD: number;
  totalVES: number;
  enviarACaja: () => Promise<void>;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { concesionario, staff } = useBusinessAuth();
  const firestore = useFirestore();
  const { bcvRate } = useCurrency();
  const { toast } = useToast();

  const addItem = (product: any, qty: number) => {
    if (qty > product.stock_actual) {
      toast({ title: 'Stock insuficiente', variant: 'destructive' });
      return;
    }
    
    setItems(prev => {
      const exists = prev.find(i => i.id === product.id);
      if (exists) {
        if (exists.cantidad + qty > product.stock_actual) {
          toast({ title: 'Supera el stock disponible', variant: 'destructive' });
          return prev;
        }
        return prev.map(i => i.id === product.id ? { ...i, cantidad: i.cantidad + qty } : i);
      }
      return [...prev, { 
        id: product.id, 
        codigo: product.codigo, 
        nombre: product.nombre, 
        cantidad: qty, 
        precio_usd: product.precio_venta_usd, 
        aplica_iva: product.aplica_iva, 
        stock_actual: product.stock_actual 
      }];
    });
    
    toast({ title: 'Producto añadido al carrito' });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.id !== productId));
  };

  const updateQuantity = (productId: string, qty: number) => {
    setItems(prev => prev.map(i => {
      if (i.id === productId) {
        if (qty > i.stock_actual) {
          toast({ title: 'Stock insuficiente', variant: 'destructive' });
          return i;
        }
        return { ...i, cantidad: qty };
      }
      return i;
    }));
  };

  const clearCart = () => setItems([]);

  const totalUSD = useMemo(() => items.reduce((acc, item) => acc + (item.precio_usd * item.cantidad), 0), [items]);
  const totalVES = useMemo(() => totalUSD * (concesionario?.configuracion?.tasa_cambio_manual || bcvRate || 60), [totalUSD, bcvRate, concesionario]);

  const enviarACaja = async () => {
    if (!concesionario || items.length === 0) return;
    
    try {
      await addDoc(collection(firestore, 'concesionarios', concesionario.id, 'pre_invoices'), {
        item_tipo: 'producto',
        item_nombre: `Paquete de ${items.length} producto${items.length > 1 ? 's' : ''}`,
        items: items.map(i => ({
          id: i.id,
          producto_id: i.id,
          codigo: i.codigo,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio_usd: i.precio_usd,
          precio_unitario: i.precio_usd,
          descuento: 0,
          precio_final: i.precio_usd,
          subtotal_usd: i.precio_usd * i.cantidad,
          aplica_iva: i.aplica_iva
        })),
        precio_negociado: totalUSD,
        vendedor_id: staff?.id || 'admin', // fallback just in case
        vendedor_nombre: staff?.nombre || 'Administrador',
        estado: 'pendiente',
        created_at: serverTimestamp()
      });
      
      setItems([]);
      toast({ title: 'Enviado a Caja exitosamente', description: 'El cajero ya puede procesar esta pre-factura.' });
    } catch (e) {
      console.error("Error enviando a caja:", e);
      toast({ title: 'Error al enviar a caja', variant: 'destructive' });
    }
  };

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, totalUSD, totalVES, enviarACaja, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
