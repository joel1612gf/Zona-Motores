'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';

type CurrencyContextType = {
  bcvRate: number;
  setBcvRate: (rate: number) => void;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [bcvRate, setBcvRate] = useState(60.00); // Updated base fallback for 2026

  const value = useMemo(() => ({ bcvRate, setBcvRate }), [bcvRate]);

  // Fetch the rate on mount
  useEffect(() => {
    fetch('/api/business/exchange-rate')
      .then(res => res.json())
      .then(data => {
        if (data.tasa) {
          setBcvRate(Number(data.tasa));
        }
      })
      .catch(err => console.error('Error fetching BCV rate in context:', err));
  }, []);

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
