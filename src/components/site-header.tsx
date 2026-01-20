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
    if (user) {
      router.push('/listings/new');
    } else {
      setLoginOpen(true);
    }
  };

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
          <nav className="flex items-center space-x-2">
            <Button onClick={handleNewListingClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Publicar un Vehículo
            </Button>
            <AuthButton open={loginOpen} onOpenChange={setLoginOpen} />
          </nav>
        </div>
      </div>
    </header>
  );
}
