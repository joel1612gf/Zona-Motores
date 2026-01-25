'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useVehicles } from '@/context/vehicle-context';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogClose } from '@/components/ui/dialog';
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
  Shield,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { notFound } from 'next/navigation';

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const { vehicles } = useVehicles();
  const vehicle = vehicles.find(v => v.id === params.id);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // State and refs for zoom/pan
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const initialTouchState = useRef({ distance: 0, scale: 1 });

  // Reset zoom when lightbox closes or image changes
  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [isLightboxOpen, currentImageIndex]);

  const handleLightboxOpenChange = (open: boolean) => {
    if (!open) {
      setTransform({ scale: 1, x: 0, y: 0 });
      setIsPanning(false);
    }
    setIsLightboxOpen(open);
  };

  if (!vehicle) {
    notFound();
  }

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setIsLightboxOpen(true);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === 0 ? vehicle.images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => (prev === vehicle.images.length - 1 ? 0 : prev + 1));
  };

  // Zoom/Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const scaleAmount = -e.deltaY * 0.002;
    setTransform(prev => {
      const newScale = Math.max(1, Math.min(prev.scale + scaleAmount, 5));
      if (newScale === 1) {
        return { scale: 1, x: 0, y: 0 };
      }
      // TODO: Implement zoom towards cursor for better UX
      return { ...prev, scale: newScale };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || transform.scale <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    e.preventDefault();
    const newX = e.clientX - panStart.current.x;
    const newY = e.clientY - panStart.current.y;
    setTransform(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };
  
  // Touch Handlers
  const getDistance = (touches: React.TouchList) => {
    return Math.sqrt(
      Math.pow(touches[0].clientX - touches[1].clientX, 2) +
      Math.pow(touches[0].clientY - touches[1].clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsPanning(false);
      initialTouchState.current = { distance: getDistance(e.touches), scale: transform.scale };
    } else if (e.touches.length === 1 && transform.scale > 1) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX - transform.x, y: e.touches[0].clientY - transform.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDistance = getDistance(e.touches);
      const newScale = Math.max(1, (newDistance / initialTouchState.current.distance) * initialTouchState.current.scale);
      setTransform(prev => ({ ...prev, scale: newScale, x: 0, y: 0 }));
    } else if (e.touches.length === 1 && isPanning) {
      e.preventDefault();
      const newX = e.touches[0].clientX - panStart.current.x;
      const newY = e.touches[0].clientY - panStart.current.y;
      setTransform(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    if (transform.scale <= 1) {
      setTransform({ scale: 1, x: 0, y: 0 });
    }
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

      <Dialog open={isLightboxOpen} onOpenChange={handleLightboxOpenChange}>
        <DialogContent className="max-w-screen-xl w-full h-[90vh] p-0 border-none bg-black/90 flex items-center justify-center overflow-hidden">
          <DialogTitle className="sr-only">Galería de Imágenes del Vehículo</DialogTitle>
          <DialogDescription className="sr-only">
            Visor de imágenes para {`${vehicle.year} ${vehicle.make} ${vehicle.model}`}. Usa la rueda del ratón o pellizca para hacer zoom. Arrastra para mover la imagen.
          </DialogDescription>
          
          <div
            ref={imageContainerRef}
            className={cn(
              "relative w-full h-full",
              transform.scale > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-auto'
            )}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Image
              key={currentImageIndex}
              src={vehicle.images[currentImageIndex].url}
              alt={vehicle.images[currentImageIndex].alt}
              fill
              className="object-contain"
              style={{
                transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
                cursor: 'inherit',
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              }}
              data-ai-hint={vehicle.images[currentImageIndex].hint}
              sizes="(max-width: 1280px) 90vw, 80vw"
              draggable="false"
            />
          </div>

          {/* Navigation buttons: only show when not zoomed in */}
          {vehicle.images.length > 1 && transform.scale === 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white z-20"
                onClick={handlePrevImage}
              >
                <ChevronLeft className="h-6 w-6" />
                <span className="sr-only">Anterior</span>
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white z-20"
                onClick={handleNextImage}
              >
                <ChevronRight className="h-6 w-6" />
                <span className="sr-only">Siguiente</span>
              </Button>
            </>
          )}

          <DialogClose className="absolute right-4 top-4 rounded-full p-2 bg-black/50 text-white hover:bg-black/80 hover:text-white z-20 transition-colors">
            <X className="h-5 w-5" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
