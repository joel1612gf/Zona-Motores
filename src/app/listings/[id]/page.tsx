
'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useVehicles } from '@/context/vehicle-context';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Gauge, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  User, 
  Settings2, 
  Palette,
  Snowflake,
  Speaker,
  DoorOpen,
  CircleCheck,
  FileText,
  PenSquare,
  GitCompareArrows,
  ArrowDownToLine,
  ArrowUpFromLine,
  LifeBuoy,
  Shield
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { notFound } from 'next/navigation';

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const { vehicles } = useVehicles();
  const vehicle = vehicles.find(v => v.id === params.id);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxStartIndex, setLightboxStartIndex] = useState(0);

  if (!vehicle) {
    notFound();
  }

  const handleImageClick = (index: number) => {
    setLightboxStartIndex(index);
    setIsLightboxOpen(true);
  };

  const mainFeatures: { icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string }[] = [];

  if (vehicle.hasAC) mainFeatures.push({ icon: Snowflake, label: 'Aire Acondicionado' });
  if (vehicle.hasSoundSystem) mainFeatures.push({ icon: Speaker, label: 'Sistema de Sonido' });
  if (vehicle.is4x4) {
    const FourByFourIcon = (props: React.SVGProps<SVGSVGElement>) => (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 15V9l-3 3" />
        <path d="M4 12h3" />
        <path d="M11 9l4 6" />
        <path d="M15 9l-4 6" />
        <path d="M20 15V9l-3 3" />
        <path d="M17 12h3" />
      </svg>
    );
    mainFeatures.push({ icon: FourByFourIcon, label: 'Es 4x4' });
  }
  if (vehicle.isArmored) {
    mainFeatures.push({ icon: Shield, label: `Blindado Nivel ${vehicle.armorLevel || 'N/A'}` });
  }
  if (vehicle.doorCount) mainFeatures.push({ icon: DoorOpen, label: `${vehicle.doorCount} puertas` });
  if (vehicle.isOperational) mainFeatures.push({ icon: CircleCheck, label: 'Rueda actualmente' });
  if (!vehicle.hadMajorCrash) mainFeatures.push({ icon: ShieldCheck, label: 'Sin choques fuertes' });
  if (vehicle.isSignatory) mainFeatures.push({ icon: PenSquare, label: 'Dueño es firmante' });
  if (vehicle.tireLife > 80) mainFeatures.push({ icon: LifeBuoy, label: 'Cauchos > 80% vida' });
  if (vehicle.acceptsTradeIn) {
    mainFeatures.push({ icon: GitCompareArrows, label: 'Acepta cambios' });
    if (vehicle.tradeInForLowerValue) mainFeatures.push({ icon: ArrowDownToLine, label: 'Recibe menor valor' });
    if (vehicle.tradeInForHigherValue) mainFeatures.push({ icon: ArrowUpFromLine, label: 'Da como parte de pago' });
  }


  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2">
          <Carousel className="w-full">
            <CarouselContent>
              {vehicle.images.map((image, index) => (
                <CarouselItem key={index} onClick={() => handleImageClick(index)} className="cursor-pointer">
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
              <CardTitleComponent>Descripción del Vendedor</CardTitleComponent>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{vehicle.description}</p>
            </CardContent>
          </Card>
          <Card className="mt-8">
            <CardHeader>
              <CardTitleComponent>Características</CardTitleComponent>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-accent flex-shrink-0" />
                  <span className="text-sm">{`Título ${vehicle.ownerCount}-1`}</span>
              </div>
              {mainFeatures.map(({icon: Icon, label}) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-accent flex-shrink-0" />
                  <span className="text-sm">{label}</span>
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
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="font-semibold flex items-center gap-1"><Gauge className="h-4 w-4 text-muted-foreground" /> Kilometraje</div><div className="text-muted-foreground">{vehicle.mileage.toLocaleString()} km</div>
                  <div className="font-semibold flex items-center gap-1"><Palette className="h-4 w-4 text-muted-foreground" /> Color</div><div className="text-muted-foreground">{vehicle.exteriorColor}</div>
                  <div className="font-semibold flex items-center gap-1"><Settings2 className="h-4 w-4 text-muted-foreground" /> Motor</div><div className="text-muted-foreground">{vehicle.engine}</div>
                  <div className="font-semibold flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14v14H5V5z"/><path d="M12 5v14"/><path d="M19 12H5"/><path d="M12 12l5-5"/><path d="m7 12 5 5"/></svg> Transmisión</div><div className="text-muted-foreground">{vehicle.transmission}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitleComponent>Información del Vendedor</CardTitleComponent>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {vehicle.seller.displayName}
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

      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-screen-xl w-full h-[90vh] p-0 border-none bg-background/95 flex">
          <DialogTitle className="sr-only">Galería de Imágenes del Vehículo</DialogTitle>
          <DialogDescription className="sr-only">
            Visor de imágenes para {`${vehicle.year} ${vehicle.make} ${vehicle.model}`}. Usa las flechas para navegar entre las fotos.
          </DialogDescription>
          <Carousel
            className="w-full h-full"
            opts={{
              startIndex: lightboxStartIndex,
              loop: vehicle.images.length > 1,
            }}
          >
            <CarouselContent className="h-full">
              {vehicle.images.map((image, index) => (
                <CarouselItem key={index} className="h-full p-0">
                  <div className="relative w-full h-full flex items-center justify-center">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        className="object-contain"
                        data-ai-hint={image.hint}
                        sizes="(max-width: 1280px) 90vw, 80vw"
                      />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {vehicle.images.length > 1 && (
              <>
                <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80 hover:text-white z-20" />
                <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80 hover:text-white z-20" />
              </>
            )}
          </Carousel>
        </DialogContent>
      </Dialog>
    </div>
  );
}
