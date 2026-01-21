import { Car } from 'lucide-react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
              <Link href="/" className="flex items-center space-x-2">
                <Car className="h-6 w-6 text-primary" />
                <span className="font-headline text-xl font-bold">
                  Zona Motores
                </span>
              </Link>
            <p className="text-sm text-muted-foreground">
              El mercado más confiable para comprar y vender vehículos en Venezuela.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Nosotros</h4>
            <ul className="space-y-1">
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-primary">Sobre nosotros</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-primary">Contacto</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-primary">Términos de Servicio</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-primary">Política de Privacidad</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Zona Motores. Todos los Derechos Reservados.
        </div>
      </div>
    </footer>
  );
}
