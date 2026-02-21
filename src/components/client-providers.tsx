'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { APIProvider } from '@vis.gl/react-google-maps';
import { FirebaseClientProvider } from '@/firebase';
import { SubscriptionProvider } from '@/context/subscription-context';
import { MakesProvider } from '@/context/makes-context';
import { VehicleProvider } from '@/context/vehicle-context';
import { FavoritesProvider } from '@/context/favorites-context';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <FirebaseClientProvider>
          <SubscriptionProvider>
            <MakesProvider>
              <VehicleProvider>
                <FavoritesProvider>{children}</FavoritesProvider>
              </VehicleProvider>
            </MakesProvider>
          </SubscriptionProvider>
        </FirebaseClientProvider>
      </APIProvider>
    </ThemeProvider>
  );
}
