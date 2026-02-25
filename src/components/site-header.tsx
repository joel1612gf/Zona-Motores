'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Car, PlusCircle, Menu } from 'lucide-react';
import { useUser } from '@/firebase';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/notification-bell';

const AuthButton = dynamic(() => import('@/components/auth-button').then(mod => ({ default: mod.AuthButton })), {
  ssr: false,
  loading: () => <div className="h-9 w-[120px] animate-pulse bg-secondary/50 rounded-md" />,
});


export function SiteHeader() {
  const { user } = useUser();
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);

  const handleNewListingClick = () => {
    if (user) {
      router.push('/listings/new');
    } else {
      setLoginOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-primary text-primary-foreground">
      <div className="container flex h-16 items-center">
        {/* Desktop Logo & Nav */}
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="flex items-center space-x-2">
            <Car className="h-6 w-6" />
            <span className="hidden font-headline text-xl font-bold sm:inline-block">
              Zona Motores
            </span>
          </Link>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/listings" className="text-primary-foreground/80 transition-colors hover:text-primary-foreground">
            Anuncios
          </Link>
          <Link href="/dealerships" className="text-primary-foreground/80 transition-colors hover:text-primary-foreground">
            Concesionarios
          </Link>
        </nav>

        {/* Mobile Menu & Logo */}
        <div className="flex w-full items-center md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-4 hover:bg-primary-foreground/10">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] bg-primary text-primary-foreground">
              <SheetHeader>
                <SheetTitle className="sr-only">Menú Principal</SheetTitle>
              </SheetHeader>
              <Link href="/" className="flex items-center space-x-2 mb-8">
                <Car className="h-6 w-6 text-primary-foreground" />
                <span className="font-headline text-xl font-bold">
                  Zona Motores
                </span>
              </Link>
              <nav className="grid gap-6 text-lg font-medium">
                <SheetClose asChild>
                  <Link href="/listings" className="text-primary-foreground/80 transition-colors hover:text-primary-foreground">
                    Anuncios
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/dealerships" className="text-primary-foreground/80 transition-colors hover:text-primary-foreground">
                    Concesionarios
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
          <div className="flex-1 text-center">
            <Link href="/" className="inline-flex items-center space-x-2" tabIndex={-1}>
              <Car className="h-6 w-6" />
              <span className="font-headline text-xl font-bold">
                Zona Motores
              </span>
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-1 sm:space-x-2">
          <Button variant="secondary" size="sm" className="h-9 px-2 sm:px-3" onClick={handleNewListingClick}>
            <PlusCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Publicar</span>
          </Button>
          <AuthButton open={loginOpen} onOpenChange={setLoginOpen} />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
