import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Car, PlusCircle } from 'lucide-react';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <Car className="h-6 w-6 text-accent" />
            <span className="inline-block font-headline text-xl font-bold">
              Motores Zone
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-1">
            <Button asChild>
              <Link href="/listings/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Publicar un Vehículo
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
