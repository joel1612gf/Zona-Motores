import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { vehicles } from '@/lib/data';
import { VehicleCard } from '@/components/vehicle-card';
import { PlusCircle, Search } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export default function Home() {
  const featuredVehicles = vehicles.slice(0, 5);
  const latestVehicles = vehicles.slice(5, 13);
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
                <Search className="mr-2 h-5 w-5" />
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
            <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Promocionados</div>
            <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
              Publicaciones Destacadas
            </h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Descubre nuestras mejores ofertas y vehículos promocionados.
            </p>
          </div>
          <Carousel
            opts={{ align: "start" }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {featuredVehicles.map((vehicle) => (
                <CarouselItem key={vehicle.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                  <div className="p-1 h-full">
                     <VehicleCard vehicle={vehicle} isFeatured={true} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex left-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
            <CarouselNext className="hidden sm:flex right-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
          </Carousel>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-secondary/50">
        <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Nuevos</div>
                <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
                    Últimas Publicaciones
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Explora los vehículos más recientes añadidos a nuestra plataforma.
                </p>
            </div>
          <Carousel
              opts={{ align: "start" }}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {latestVehicles.map((vehicle) => (
                  <CarouselItem key={vehicle.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                    <div className="p-1 h-full">
                      <VehicleCard vehicle={vehicle} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex left-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
              <CarouselNext className="hidden sm:flex right-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50" />
            </Carousel>
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
