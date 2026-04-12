'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase';
import { SubscriptionProvider } from '@/context/subscription-context';
import { MakesProvider } from '@/context/makes-context';
import { FavoritesProvider } from '@/context/favorites-context';
import { NotificationProvider } from '@/context/notification-context';
import { CurrencyProvider } from '@/context/currency-context';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <FirebaseClientProvider>
        <CurrencyProvider>
          <SubscriptionProvider>
            <NotificationProvider>
              <MakesProvider>
                <FavoritesProvider>{children}</FavoritesProvider>
              </MakesProvider>
            </NotificationProvider>
          </SubscriptionProvider>
        </CurrencyProvider>
      </FirebaseClientProvider>
    </ThemeProvider>
  );
}

