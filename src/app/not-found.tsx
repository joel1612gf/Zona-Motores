import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Frown } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Frown className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-4xl font-bold font-headline">404 - Página No Encontrada</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Lo sentimos, la página que buscas no existe.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Volver a la Página Principal</Link>
      </Button>
    </div>
  );
}
