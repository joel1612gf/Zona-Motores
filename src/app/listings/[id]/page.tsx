'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useVehicles } from '@/context/vehicle-context';
import { useUser, useFirestore, useStorage, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { useTheme } from 'next-themes';
import { useFavorites } from '@/context/favorites-context';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogHeader, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { doc, updateDoc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  X,
  Pencil as PencilIcon,
  Trash2,
  Loader2,
  ShieldBan,
  Play,
  Pause,
  Heart,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile } from '@/lib/types';


function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.044-.53-.044-.315 0-.765.11-1.057.332-.29.22-.722.71-1.256 1.448a.93.93 0 0 0 .115.746c.143.372.43.83.698 1.15l.61.859a5.889 5.889 0 0 0 2.686 2.37c.792.43 1.77.72 2.654.72a.91.91 0 0 0 .546-.12c.328-.2.48-.68.6-.943.12-.264.12-.504 0-.66zM27.84 4.28C25.045 1.47 21.308 0 17.21 0 7.8 0 0 7.79 0 17.21c0 3.215.89 6.29 2.55 8.98l-2.54 9.38 9.61-2.49c2.6.16 5.38.25 8.08.25 9.4 0 17.2-7.8 17.2-17.2 0-4.1-1.48-7.8-4.28-10.6z"
        fill="currentColor"
      />
    </svg>
  );
}

const libraries: ('places' | 'drawing' | 'geometry' | 'visualization')[] = ['places'];

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const { vehicles } = useVehicles();
  const vehicle = vehicles.find(v => v.id === params.id);
  const { user: adminUser } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();

  const sellerProfileRef = useMemoFirebase(() => {
    if (!firestore || !vehicle) return null;
    return doc(firestore, 'users', vehicle.sellerId);
  }, [firestore, vehicle]);

  const { data: sellerInfo, isLoading: isSellerLoading } = useDoc<UserProfile>(sellerProfileRef);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const carMarkerIcon = useMemo(() => {
    if (typeof window === 'undefined' || !window.google?.maps?.Point) return undefined;
    
    const color = resolvedTheme === 'dark' ? '#FAFAFA' : '#2563EB';
    
    return {
      path: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9L1.4 12.9A3.3 3.3 0 0 0 1 14.8V17c0 .6.4 1 1h2M7 17v-1.3M17 17v-1.3M5 11h14M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0m10 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: 0,
      rotation: 0,
      scale: 1.2,
      anchor: new window.google.maps.Point(12, 12),
    };
  }, [resolvedTheme]);


  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  
  const isAdmin = adminUser?.email === 'zonamotores.ve@gmail.com';
  
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();

  useEffect(() => {
    if (!firestore || !vehicle) return;

    const viewedKey = `viewed_${vehicle.id}`;
    const hasViewed = sessionStorage.getItem(viewedKey);

    if (!hasViewed) {
        const vehicleRef = doc(firestore, 'users', vehicle.sellerId, 'vehicleListings', vehicle.id);
        updateDoc(vehicleRef, {
            viewCount: increment(1)
        }).then(() => {
            sessionStorage.setItem(viewedKey, 'true');
        }).catch(error => {
            console.error("Error incrementing view count:", error);
            errorEmitter.emit(
                'permission-error',
                new FirestorePermissionError({
                    path: vehicleRef.path,
                    operation: 'update',
                    requestResourceData: { viewCount: 'increment(1)' },
                }, error)
            );
        });
    }
  }, [firestore, vehicle]);


  useEffect(() => {
    if (isContactDialogOpen) {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isContactDialogOpen]);

  const createWhatsAppLink = () => {
    if (!vehicle || !displaySeller.phone) return '';
    
    const sellerName = displaySeller.displayName;
    const vehicleInfo = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    const price = formatCurrency(vehicle.priceUSD);
    const phoneNumber = displaySeller.phone.replace(/[^0-9+]/g, '');

    const summaryItems: string[] = [];
    if (vehicle.hasAC) summaryItems.push("tiene aire acondicionado");
    if (vehicle.hasSoundSystem) summaryItems.push("tiene sistema de sonido");
    if (!vehicle.hadMajorCrash) summaryItems.push("no ha tenido choques fuertes");
    if (vehicle.isOperational) summaryItems.push("está rodando sin problemas");

    let summaryText = '';
    if (summaryItems.length > 0) {
      summaryText = `\n\nSolo para confirmar, en el anuncio indicas que el vehículo ${summaryItems.join(', ')}. ¿Es correcto?`;
    }

    const message = `Hola ${sellerName}, te escribo para más información sobre el ${vehicleInfo} que tienes publicado en Zona Motores en ${price}.${summaryText}`;

    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };
  
  const handleContactClick = () => {
    if (!firestore || !vehicle || countdown > 0) return;

    const vehicleRef = doc(firestore, 'users', vehicle.sellerId, 'vehicleListings', vehicle.id);
    updateDoc(vehicleRef, {
        contactRequests: increment(1)
    }).catch(error => {
        console.error("Error incrementing contact requests:", error);
         errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: vehicleRef.path,
                operation: 'update',
                requestResourceData: { contactRequests: 'increment(1)' },
            }, error)
        );
    });
  };

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

  const displaySeller = sellerInfo || vehicle.seller;

  const isVehicleFavorite = isFavorite(vehicle.id);

  const handleFavoriteToggle = () => {
      if (isVehicleFavorite) {
          removeFavorite(vehicle.id);
      } else {
          addFavorite(vehicle.id);
      }
  };


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

  const handleToggleStatus = async (newStatus: 'active' | 'paused' | 'sold') => {
      if (!adminUser) return;
      setIsTogglingStatus(true);

      try {
          const vehicleRef = doc(firestore, 'users', vehicle.sellerId, 'vehicleListings', vehicle.id);
          const updatePayload: { status: string; createdAt?: any } = { status: newStatus };
          
          if (newStatus === 'active') {
              updatePayload.createdAt = serverTimestamp();
          }
          
          await updateDoc(vehicleRef, updatePayload);
          toast({
              title: `Estado Actualizado`,
              description: `La publicación ahora está ${newStatus}.`,
          });
      } catch (error) {
          console.error("Error updating status:", error);
           toast({
              variant: "destructive",
              title: "Error al actualizar",
              description: "No se pudo cambiar el estado de la publicación.",
          });
      } finally {
          setIsTogglingStatus(false);
      }
  };

  const handleDelete = async () => {
      if (!adminUser) return;
      setIsDeleting(true);
      try {
          const vehicleRef = doc(firestore, 'users', vehicle.sellerId, 'vehicleListings', vehicle.id);
          
          if (vehicle.images && vehicle.images.length > 0) {
              const imageDeletePromises = vehicle.images.map(image => {
                  if (image.url.includes('firebasestorage.googleapis.com')) {
                      const imageRef = ref(storage, image.url);
                      return deleteObject(imageRef);
                  }
                  return Promise.resolve();
              });
              await Promise.all(imageDeletePromises);
          }

          await deleteDoc(vehicleRef);

          toast({
              title: "Publicación Eliminada",
              description: `El vehículo ha sido eliminado permanentemente.`,
          });
          router.push('/listings');
      } catch (error) {
          console.error("Error deleting vehicle:", error);
          toast({
              variant: "destructive",
              title: "Error al eliminar",
              description: "No se pudo eliminar la publicación. Inténtalo de nuevo.",
          });
          setIsDeleting(false);
      }
  };

  const handleToggleBlockSeller = async () => {
    if(!adminUser) return;
    setIsBlocking(true);
    const newBlockedState = !displaySeller.isBlocked;
    try {
        const sellerRef = doc(firestore, 'users', vehicle.sellerId);
        await updateDoc(sellerRef, { isBlocked: newBlockedState });
        toast({
            title: `Vendedor ${newBlockedState ? 'Bloqueado' : 'Desbloqueado'}`,
            description: `${displaySeller.displayName} ha sido ${newBlockedState ? 'bloqueado' : 'desbloqueado'}.`,
        });
    } catch(error) {
        console.error("Error blocking/unblocking seller:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado del vendedor.' });
    } finally {
        setIsBlocking(false);
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

  const MainInfoCard = () => (
    <Card>
      <CardHeader>
        <h1 className="font-headline text-2xl sm:text-3xl font-bold">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</h1>
        <div className="flex items-center gap-2 pt-2 text-muted-foreground">
          <MapPin className="h-4 w-4" /> <span>{`${vehicle.location.city}, ${vehicle.location.state}`}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-start">
              <div className="text-3xl font-bold font-headline text-primary">{formatCurrency(vehicle.priceUSD)}</div>
              <Button variant="outline" size="lg" onClick={handleFavoriteToggle}>
                  <Heart className={cn(
                      "mr-2 h-5 w-5 text-destructive transition-all",
                      isVehicleFavorite ? 'fill-destructive' : 'fill-transparent'
                  )}/>
                  {isVehicleFavorite ? 'Guardado' : 'Guardar'}
              </Button>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="font-semibold flex items-center gap-1"><Gauge className="h-4 w-4 text-muted-foreground" /> Kilometraje</div><div className="text-muted-foreground">{vehicle.mileage.toLocaleString()} km</div>
            <div className="font-semibold flex items-center gap-1"><Palette className="h-4 w-4 text-muted-foreground" /> Color</div><div className="text-muted-foreground">{vehicle.exteriorColor}</div>
            <div className="font-semibold flex items-center gap-1"><Settings2 className="h-4 w-4 text-muted-foreground" /> Motor</div><div className="text-muted-foreground">{vehicle.engine}</div>
            <div className="font-semibold flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14v14H5V5z"/><path d="M12 5v14"/><path d="M19 12H5"/><path d="M12 12l5-5"/><path d="m7 12 5 5"/></svg> Transmisión</div><div className="text-muted-foreground">{vehicle.transmission}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const SellerInfoBlock = () => {
    const content = (
        <div className="flex items-center gap-3">
            {displaySeller.accountType === 'dealer' && displaySeller.logoUrl ? (
                <Avatar className="h-10 w-10 border-2">
                    <AvatarImage src={displaySeller.logoUrl} alt={`${displaySeller.displayName} logo`} />
                    <AvatarFallback>{displaySeller.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
            ) : (
                <User className="h-8 w-8 text-muted-foreground" />
            )}
            <div>
                <div className="font-semibold flex items-center gap-2">
                    {displaySeller.displayName}
                    {displaySeller.isVerified && (
                        <Badge variant="secondary" className="border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300">
                            <ShieldCheck className="h-3 w-3 mr-1" />Verificado
                        </Badge>
                    )}
                </div>
                {!displaySeller.isVerified && <Badge variant="destructive">No Verificado</Badge>}
            </div>
        </div>
    );

    if (displaySeller.accountType === 'dealer') {
        return (
            <Link href={`/dealerships/${displaySeller.uid}`} className="block hover:bg-muted/50 rounded-md -m-3 p-3 transition-colors">
                {content}
            </Link>
        );
    }

    return <div className="-m-3 p-3">{content}</div>;
  };

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
        <ChevronLeft className="mr-1 h-5 w-5" />
        Volver a los anuncios
      </Button>
      <div className="grid md:grid-cols-3 gap-8 items-start">
        {/* Main Content Column */}
        <div className="md:col-span-2 space-y-8 flex flex-col">
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
          
          {/* Main Info for Mobile */}
          <div className="space-y-8 md:hidden">
            <MainInfoCard />
            <Card>
              <CardHeader>
                <CardTitleComponent>Características</CardTitleComponent>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-y-4 gap-x-2">
                <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className="text-sm">{`Título ${vehicle.ownerCount}-1`}</span>
                </div>
                {mainFeatures.map(({icon: Icon, label}) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitleComponent>Descripción del Vendedor</CardTitleComponent>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{vehicle.description}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="hidden md:block">
            <CardHeader>
              <CardTitleComponent>Características</CardTitleComponent>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-y-4 gap-x-2">
              <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                  <span className="text-sm">{`Título ${vehicle.ownerCount}-1`}</span>
              </div>
              {mainFeatures.map(({icon: Icon, label}) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-primary flex-shrink-0" />
                  <span className="text-sm">{label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="hidden md:block">
            <CardHeader>
              <CardTitleComponent>Descripción del Vendedor</CardTitleComponent>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{vehicle.description}</p>
            </CardContent>
          </Card>
          
           {/* Seller info for mobile */}
           <div className="md:hidden">
                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitleComponent>Información del Vendedor</CardTitleComponent>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    <SellerInfoBlock />
                    <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                        <DialogTrigger asChild>
                        <Button className="w-full">
                            <Phone className="mr-2 h-4 w-4" /> Mostrar Número de Teléfono
                        </Button>
                        </DialogTrigger>
                        <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Contactar al Vendedor</DialogTitle>
                            <DialogDescription>
                            Estás a punto de contactar a {displaySeller.displayName} por WhatsApp.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="bg-muted h-24 flex items-center justify-center rounded-md text-muted-foreground text-sm">
                            (Espacio para anuncio de Google)
                            </div>

                            <Button asChild size="lg" className="w-full bg-green-500 hover:bg-green-600 text-white" onClick={handleContactClick} disabled={countdown > 0}>
                                <a href={countdown === 0 ? createWhatsAppLink() : undefined} target="_blank" rel="noopener noreferrer">
                                    {countdown > 0 ? (
                                        `Espera ${countdown} segundos...`
                                    ) : (
                                        <>
                                            <WhatsAppIcon className="mr-2 h-5 w-5" />
                                            Contactar por WhatsApp
                                        </>
                                    )}
                                </a>
                            </Button>

                            <div className="bg-muted h-24 flex items-center justify-center rounded-md text-muted-foreground text-sm">
                                (Espacio para anuncio de Google)
                            </div>
                        </div>
                        </DialogContent>
                    </Dialog>
                    <p className="text-xs text-muted-foreground text-center">
                        Los vendedores verificados han confirmado su identidad vía WhatsApp.
                    </p>
                    </CardContent>

                    <div className="border-t">
                    <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
                        <DialogTrigger asChild>
                            <div className="h-40 w-full cursor-pointer relative group">
                                {isLoaded && !loadError ? (
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                        center={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                                        zoom={12}
                                        options={{
                                            gestureHandling: 'none',
                                            zoomControl: false,
                                            streetViewControl: false,
                                            mapTypeControl: false,
                                            fullscreenControl: false,
                                            clickableIcons: false
                                        }}
                                    >
                                        <Marker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }} icon={carMarkerIcon} />
                                    </GoogleMap>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                    {loadError ? <p className="text-destructive text-xs p-2 text-center">Error al cargar mapa</p> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-transparent group-hover:bg-black/30 transition-colors flex items-center justify-center" aria-hidden="true">
                                    <div className="p-2 bg-background/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MapPin className="h-5 w-5 text-foreground" />
                                    </div>
                                </div>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl w-full h-[80vh] p-0">
                            <DialogHeader className="p-4 absolute top-0 left-0 z-10 bg-gradient-to-b from-background via-background/80 to-transparent w-full">
                                <DialogTitle>Ubicación del Vehículo</DialogTitle>
                            </DialogHeader>
                            {isLoaded && !loadError ? (
                                <GoogleMap
                                    mapContainerStyle={{ width: '100%', height: '100%' }}
                                    center={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                                    zoom={15}
                                    options={{
                                    streetViewControl: false,
                                    mapTypeControl: false,
                                    fullscreenControl: false
                                    }}
                                >
                                    <Marker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }} icon={carMarkerIcon} />
                                </GoogleMap>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                    {loadError ? <p className="text-destructive">Error al cargar mapa</p> : <Loader2 className="h-8 w-8 animate-spin" />}
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                    </div>
                    <div className="px-4 py-2 bg-muted/30 border-t">
                        <p className="text-xs text-muted-foreground text-center">La ubicación proporcionada por el vendedor es aproximada.</p>
                    </div>
                </Card>
           </div>
        </div>

        {/* Sidebar */}
        <div className="md:col-span-1 space-y-6">
            <div className="md:sticky md:top-24 space-y-6">
                <div className="hidden md:block">
                    <MainInfoCard />
                </div>
                
                <div className="hidden md:block">
                    <Card className="overflow-hidden">
                        <CardHeader>
                        <CardTitleComponent>Información del Vendedor</CardTitleComponent>
                        </CardHeader>
                        <CardContent className="space-y-4">
                        <SellerInfoBlock />
                        <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                            <DialogTrigger asChild>
                            <Button className="w-full">
                                <Phone className="mr-2 h-4 w-4" /> Mostrar Número de Teléfono
                            </Button>
                            </DialogTrigger>
                            <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Contactar al Vendedor</DialogTitle>
                                <DialogDescription>
                                Estás a punto de contactar a {displaySeller.displayName} por WhatsApp.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="bg-muted h-24 flex items-center justify-center rounded-md text-muted-foreground text-sm">
                                (Espacio para anuncio de Google)
                                </div>

                                <Button asChild size="lg" className="w-full bg-green-500 hover:bg-green-600 text-white" onClick={handleContactClick} disabled={countdown > 0}>
                                    <a href={countdown === 0 ? createWhatsAppLink() : undefined} target="_blank" rel="noopener noreferrer">
                                        {countdown > 0 ? (
                                            `Espera ${countdown} segundos...`
                                        ) : (
                                            <>
                                                <WhatsAppIcon className="mr-2 h-5 w-5" />
                                                Contactar por WhatsApp
                                            </>
                                        )}
                                    </a>
                                </Button>

                                <div className="bg-muted h-24 flex items-center justify-center rounded-md text-muted-foreground text-sm">
                                    (Espacio para anuncio de Google)
                                </div>
                            </div>
                            </DialogContent>
                        </Dialog>
                        <p className="text-xs text-muted-foreground text-center">
                            Los vendedores verificados han confirmado su identidad vía WhatsApp.
                        </p>
                        </CardContent>

                        <div className="border-t">
                        <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
                            <DialogTrigger asChild>
                                <div className="h-40 w-full cursor-pointer relative group">
                                    {isLoaded && !loadError ? (
                                        <GoogleMap
                                            mapContainerStyle={{ width: '100%', height: '100%' }}
                                            center={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                                            zoom={12}
                                            options={{
                                                gestureHandling: 'none',
                                                zoomControl: false,
                                                streetViewControl: false,
                                                mapTypeControl: false,
                                                fullscreenControl: false,
                                                clickableIcons: false
                                            }}
                                        >
                                            <Marker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }} icon={carMarkerIcon} />
                                        </GoogleMap>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-muted">
                                        {loadError ? <p className="text-destructive text-xs p-2 text-center">Error al cargar mapa</p> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-transparent group-hover:bg-black/30 transition-colors flex items-center justify-center" aria-hidden="true">
                                        <div className="p-2 bg-background/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MapPin className="h-5 w-5 text-foreground" />
                                        </div>
                                    </div>
                                </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl w-full h-[80vh] p-0">
                                <DialogHeader className="p-4 absolute top-0 left-0 z-10 bg-gradient-to-b from-background via-background/80 to-transparent w-full">
                                    <DialogTitle>Ubicación del Vehículo</DialogTitle>
                                </DialogHeader>
                                {isLoaded && !loadError ? (
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                        center={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                                        zoom={15}
                                        options={{
                                            streetViewControl: false,
                                            mapTypeControl: false,
                                            fullscreenControl: false
                                        }}
                                    >
                                        <Marker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }} icon={carMarkerIcon} />
                                    </GoogleMap>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                        {loadError ? <p className="text-destructive">Error al cargar mapa</p> : <Loader2 className="h-8 w-8 animate-spin" />}
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                        </div>
                        <div className="px-4 py-2 bg-muted/30 border-t">
                            <p className="text-xs text-muted-foreground text-center">La ubicación proporcionada por el vendedor es aproximada.</p>
                        </div>
                    </Card>
                </div>
                {isAdmin && (
                    <Card className="border-red-500/50">
                        <CardHeader>
                            <CardTitleComponent className="text-red-600 dark:text-red-500">Herramientas de Administrador</CardTitleComponent>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <Button asChild variant="outline">
                                <Link href={`/listings/${vehicle.id}/edit`}>
                                    <PencilIcon className="mr-2" /> Editar Anuncio
                                </Link>
                            </Button>
                            
                            {vehicle.status === 'active' ? (
                                <Button variant="outline" onClick={() => handleToggleStatus('paused')} disabled={isTogglingStatus}>
                                    {isTogglingStatus ? <Loader2 className="animate-spin mr-2"/> : <Pause className="mr-2"/>}
                                    Pausar Anuncio
                                </Button>
                            ) : (
                                <Button variant="outline" onClick={() => handleToggleStatus('active')} disabled={isTogglingStatus}>
                                    {isTogglingStatus ? <Loader2 className="animate-spin mr-2"/> : <Play className="mr-2"/>}
                                    Reactivar Anuncio
                                </Button>
                            )}
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2"/> Eliminar Anuncio
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar este anuncio?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción es permanente y no se puede deshacer. Se borrará el anuncio y todas sus imágenes.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                            {isDeleting && <Loader2 className="animate-spin mr-2"/>}
                                            Sí, eliminar
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <Separator className="my-2"/>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant={displaySeller.isBlocked ? 'secondary' : 'destructive'}>
                                        <ShieldBan className="mr-2"/> {displaySeller.isBlocked ? 'Desbloquear Vendedor' : 'Bloquear Vendedor'}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿{displaySeller.isBlocked ? 'Desbloquear' : 'Bloquear'} a {displaySeller.displayName}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {displaySeller.isBlocked 
                                                ? 'Esto permitirá que el vendedor vuelva a publicar y sus anuncios sean visibles.'
                                                : 'Al bloquear a este vendedor, se ocultarán todos sus anuncios y no podrá publicar nuevos. ¿Deseas continuar?'}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleToggleBlockSeller} disabled={isBlocking} className={cn(!displaySeller.isBlocked && 'bg-destructive hover:bg-destructive/90')}>
                                            {isBlocking && <Loader2 className="animate-spin mr-2"/>}
                                            {displaySeller.isBlocked ? 'Sí, desbloquear' : 'Sí, bloquear'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                )}
            </div>
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

          <DialogClose asChild>
            <button className="absolute right-4 top-4 rounded-full p-2 bg-black/50 text-white hover:bg-black/80 hover:text-white z-20 transition-colors">
              <X className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
