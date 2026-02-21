import type { Metadata, Viewport } from 'next';
import { Inter, Oswald } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { FirebaseClientProvider } from '@/firebase';
import { VehicleProvider } from '@/context/vehicle-context';
import { ThemeProvider } from '@/components/theme-provider';
import { MakesProvider } from '@/context/makes-context';
import { FavoritesProvider } from '@/context/favorites-context';
import { SubscriptionProvider } from '@/context/subscription-context';
import { APIProvider } from '@vis.gl/react-google-maps';

const fontBody = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const fontHeadline = Oswald({
  subsets: ['latin'],
  variable: '--font-headline',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Zona Motores | Compra y Venta de Carros en Venezuela',
    template: '%s | Zona Motores',
  },
  description: 'El mercado #1 para comprar y vender carros, camionetas y motos en Venezuela. Encuentra tu próximo vehículo de forma segura, rápida y fácil. Anuncios verificados y precios reales.',
};


export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${fontBody.variable} ${fontHeadline.variable}`}>
      <head />
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
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
                    <FavoritesProvider>
                      <div className="relative flex min-h-dvh flex-col">
                        <SiteHeader />
                        <main className="flex-1">{children}</main>
                        <SiteFooter />
                      </div>
                      <Toaster />
                    </FavoritesProvider>
                  </VehicleProvider>
                </MakesProvider>
              </SubscriptionProvider>
            </FirebaseClientProvider>
          </APIProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
