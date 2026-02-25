import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Frown, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Frown className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-4xl font-bold font-headline">404 - Página No Encontrada</h1>
      <p className="mt-2 text-lg text-muted-foreground max-w-md">
        La página que buscas no existe o fue movida.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Button asChild>
          <Link href="/">Volver al Inicio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/listings">
            <Search className="mr-2 h-4 w-4" />
            Explorar Vehículos
          </Link>
        </Button>
      </div>
    </div>
  );
}
