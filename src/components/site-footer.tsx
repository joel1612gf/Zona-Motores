import { Car } from 'lucide-react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <Link href="/" className="flex items-center justify-center md:justify-start space-x-2">
              <Car className="h-6 w-6" />
              <span className="font-headline text-xl font-bold">
                Zona Motores
              </span>
            </Link>
            <p className="text-sm text-primary-foreground/80 mt-2">
              El mercado más confiable para comprar y vender vehículos en Venezuela.
            </p>
          </div>
          <div className="flex gap-6 items-center flex-wrap justify-center">
            <Link href="/about" className="text-sm font-medium hover:underline">Sobre nosotros</Link>
            <Link href="/pricing" className="text-sm font-medium hover:underline">Planes</Link>
            <Link href="/terms" className="text-sm font-medium hover:underline">Términos y Condiciones</Link>
            <Link href="#" className="text-sm font-medium hover:underline">Contacto</Link>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-primary-foreground/20 text-center text-sm text-primary-foreground/80">
          © {new Date().getFullYear()} Zona Motores. Todos los Derechos Reservados.
        </div>
      </div>
    </footer>
  );
}
