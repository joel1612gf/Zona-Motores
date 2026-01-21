import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { vehicles } from '@/lib/data';
import { VehicleCard } from '@/components/vehicle-card';
import { PlusCircle, Search } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const featuredVehicles = vehicles.slice(0, 4);
  const heroImage = PlaceHolderImages.find((p) => p.id === 'hero-car');

  return (
    <div className="flex flex-col">
      <section className="relative w-full h-[60vh] md:h-[70vh] flex items-center justify-center text-center text-white">
        <Image
          src={
            heroImage?.imageUrl ||
            'https://picsum.photos/seed/hero-car/1800/1200'
          }
          fill
          alt={heroImage?.description || 'Auto de portada'}
          data-ai-hint={heroImage?.imageHint || 'modern car'}
          className="object-cover -z-10 brightness-50"
          priority
        />
        <div className="container px-4 md:px-6 space-y-6">
          <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-6xl xl:text-7xl/none">
            Encuentra Tu Próximo Vehículo en Venezuela
          </h1>
          <p className="max-w-[700px] mx-auto text-lg md:text-xl text-neutral-200">
            El mercado más confiable para comprar y vender vehículos. Seguro, rápido y fácil.
          </p>
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <form className="flex space-x-2" action="/listings">
              <Input
                name="search"
                type="search"
                placeholder="Busca por marca, modelo o palabra clave..."
                className="max-w-lg flex-1 bg-white/90 text-foreground placeholder:text-muted-foreground focus:bg-white"
              />
              <Button type="submit" size="lg">
                <Search className="h-5 w-5 mr-2" />
                Buscar
              </Button>
            </form>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link href="/listings">Ver Todos los Anuncios</Link>
              </Button>
              <Button asChild size="lg">
                  <Link href="/listings/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Publicar un Vehículo
                  </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Destacados</div>
                <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
                    Últimas Publicaciones
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Explora los vehículos más recientes añadidos a nuestra plataforma.
                </p>
            </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
          <div className="text-center mt-12">
              <Button asChild size="lg">
                  <Link href="/listings">Ver todos los vehículos</Link>
              </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
