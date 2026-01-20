'use client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { vehicles } from '@/lib/data';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Gauge, MapPin, Phone, ShieldCheck, User, Settings2, Palette } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useCurrency } from '@/context/currency-context';

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  const vehicle = vehicles.find(v => v.id === params.id);
  const { bcvRate } = useCurrency();

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2">
          <Carousel className="w-full">
            <CarouselContent>
              {vehicle.images.map((image, index) => (
                <CarouselItem key={index}>
                  <Card className="overflow-hidden">
                    <CardContent className="flex aspect-video items-center justify-center p-0">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        width={1200}
                        height={800}
                        className="object-cover w-full h-full"
                        data-ai-hint={image.hint}
                        priority={index === 0}
                      />
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            {vehicle.images.length > 1 && (
              <>
                <CarouselPrevious className="ml-16" />
                <CarouselNext className="mr-16" />
              </>
            )}
          </Carousel>
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{vehicle.description}</p>
            </CardContent>
          </Card>
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Características</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {vehicle.features.map(feature => (
                <div key={feature} className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-1 space-y-6 sticky top-24">
          <Card>
            <CardHeader>
              <h1 className="font-headline text-3xl font-bold">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h1>
              <div className="flex items-center gap-2 pt-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> <span>{`${vehicle.location.city}, ${vehicle.location.state}`}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-3xl font-bold font-headline text-accent">{formatCurrency(vehicle.priceUSD)}</div>
                <div className="text-lg font-semibold text-muted-foreground">{formatCurrency(vehicle.priceUSD, 'VES', bcvRate)}</div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="font-semibold flex items-center gap-1"><Gauge className="h-4 w-4 text-muted-foreground" /> Kilometraje</div><div className="text-muted-foreground">{vehicle.mileage.toLocaleString()} km</div>
                  <div className="font-semibold flex items-center gap-1"><Palette className="h-4 w-4 text-muted-foreground" /> Color</div><div className="text-muted-foreground">{vehicle.exteriorColor}</div>
                  <div className="font-semibold flex items-center gap-1"><Settings2 className="h-4 w-4 text-muted-foreground" /> Motor</div><div className="text-muted-foreground">{vehicle.engine}</div>
                  <div className="font-semibold flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14v14H5V5z"/><path d="M12 5v14"/><path d="M19 12H5"/><path d="M12 12l5-5"/><path d="m7 12 5 5"/></svg> Transmisión</div><div className="text-muted-foreground">{vehicle.transmission === 'Automatic' ? 'Automática' : 'Manual'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Información del Vendedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {vehicle.seller.name}
                    {vehicle.seller.isVerified && <Badge variant="secondary" className="border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300"><ShieldCheck className="h-3 w-3 mr-1" />Verificado</Badge>}
                  </div>
                  {!vehicle.seller.isVerified && <Badge variant="destructive">No Verificado</Badge>}
                </div>
              </div>
              <Button className="w-full">
                <Phone className="mr-2 h-4 w-4" /> Mostrar Número de Teléfono
              </Button>
               <p className="text-xs text-muted-foreground text-center">
                 Los vendedores verificados han confirmado su identidad vía WhatsApp.
               </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
