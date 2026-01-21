'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthButton } from '@/components/auth-button';
import { Car, PlusCircle } from 'lucide-react';
import { useUser } from '@/firebase';

export function SiteHeader() {
  const { user } = useUser();
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);

  const handleNewListingClick = () => {
    // For now, let's go directly to the new listing page
    router.push('/listings/new');
    /*
    if (user) {
      router.push('/listings/new');
    } else {
      setLoginOpen(true);
    }
    */
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="flex items-center space-x-2">
            <Car className="h-6 w-6 text-primary" />
            <span className="hidden font-headline text-xl font-bold sm:inline-block">
              Zona Motores
            </span>
          </Link>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/listings" className="text-foreground/60 transition-colors hover:text-foreground/80">
            Anuncios
          </Link>
          <Link href="#" className="text-foreground/60 transition-colors hover:text-foreground/80">
            Financiamiento
          </Link>
          <Link href="#" className="text-foreground/60 transition-colors hover:text-foreground/80">
            Seguros
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="outline" onClick={handleNewListingClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Publicar Vehículo
            </Button>
          {/* <AuthButton open={loginOpen} onOpenChange={setLoginOpen} /> */}
        </div>
      </div>
    </header>
  );
}
