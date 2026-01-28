import type { Metadata, Viewport } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { FirebaseClientProvider } from '@/firebase';
import { VehicleProvider } from '@/context/vehicle-context';
import { ThemeProvider } from '@/components/theme-provider';
import { MakesProvider } from '@/context/makes-context';

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
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FirebaseClientProvider>
            <MakesProvider>
              <VehicleProvider>
                <div className="relative flex min-h-dvh flex-col">
                  <SiteHeader />
                  <main className="flex-1">{children}</main>
                  <SiteFooter />
                </div>
                <Toaster />
              </VehicleProvider>
            </MakesProvider>
          </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
