import type { Metadata, Viewport } from 'next';
import { Inter, Oswald } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ClientProviders } from '@/components/client-providers';

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
  themeColor: '#3b82f6',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${fontBody.variable} ${fontHeadline.variable}`}>
      <head>
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <ClientProviders>
          <div className="relative flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1 overflow-x-hidden">{children}</main>
            <SiteFooter />
          </div>
          <Toaster />
        </ClientProviders>
      </body>
    </html>
  );
}
