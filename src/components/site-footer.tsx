import { Car } from 'lucide-react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
            <h4 className="font-semibold">Vehículos</h4>
            <ul className="space-y-1">
              <li><Link href="/listings?search=Toyota" className="text-sm text-muted-foreground hover:text-primary">Toyota</Link></li>
              <li><Link href="/listings?search=Jeep" className="text-sm text-muted-foreground hover:text-primary">Jeep</Link></li>
              <li><Link href="/listings?search=Hyundai" className="text-sm text-muted-foreground hover:text-primary">Hyundai</Link></li>
              <li><Link href="/listings" className="text-sm text-muted-foreground hover:text-primary">Ver Todos</Link></li>
            </ul>
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
