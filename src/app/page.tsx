import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { vehicles } from '@/lib/data';
import { VehicleCard } from '@/components/vehicle-card';
import { Search } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const featuredVehicles = vehicles.slice(0, 3);
  const heroImage = PlaceHolderImages.find((p) => p.id === 'hero-car');

  return (
    <div className="flex flex-col">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-card">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  Find Your Next Ride in Venezuela
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  The most trusted marketplace to buy and sell vehicles. Safe,
                  fast, and easy.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <form className="flex space-x-2" action="/listings">
                  <Input
                    name="search"
                    type="search"
                    placeholder="Search by make or model..."
                    className="max-w-lg flex-1"
                  />
                  <Button type="submit">
                    <Search className="h-4 w-4" />
                    <span className="sr-only">Search</span>
                  </Button>
                </form>
                <Button asChild className="w-full" size="lg">
                  <Link href="/listings">Browse All Listings</Link>
                </Button>
              </div>
            </div>
            <Image
              src={
                heroImage?.imageUrl ||
                'https://picsum.photos/seed/hero-car/1200/800'
              }
              width={1200}
              height={800}
              alt={heroImage?.description || 'Hero Car'}
              data-ai-hint={heroImage?.imageHint || 'modern car'}
              className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square"
              priority
            />
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">
            Featured Listings
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
