'use client';

import { createContext, useContext, useState, ReactNode, useMemo } from 'react';

type CurrencyContextType = {
  bcvRate: number;
  setBcvRate: (rate: number) => void;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [bcvRate, setBcvRate] = useState(36.50);

  const value = useMemo(() => ({ bcvRate, setBcvRate }), [bcvRate]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
