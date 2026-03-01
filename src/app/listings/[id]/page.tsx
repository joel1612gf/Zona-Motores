'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, useFirestore, useStorage, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { useFavorites } from '@/context/favorites-context';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogHeader, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { collectionGroup, query, where, getDocs, limit, doc, updateDoc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
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
  Home,
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
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapsProvider } from '@/components/maps-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile, Vehicle } from '@/lib/types';
import { ADMIN_EMAIL } from '@/lib/constants';


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

function CarMarker() {
  return (
    <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="white" />
  );
}

interface ContactDialogProps {
  isContactDialogOpen: boolean;
  setIsContactDialogOpen: (open: boolean) => void;
  displaySeller: UserProfile;
  handleContactClick: () => void;
  countdown: number;
  createWhatsAppLink: () => string;
}

function ContactDialog({
  isContactDialogOpen,
  setIsContactDialogOpen,
  displaySeller,
  handleContactClick,
  countdown,
  createWhatsAppLink
}: ContactDialogProps) {
  return (
    <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={!displaySeller.phone}>
          <Phone className="mr-2 h-4 w-4" />
          {displaySeller.phone ? 'Mostrar Número de Teléfono' : 'Teléfono no disponible'}
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
            <a href={countdown === 0 ? createWhatsAppLink() : ''} target="_blank" rel="noopener noreferrer">
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
  );
}


function ListingDetailContent() {
  const params = useParams<{ id: string }>();
  const { user: adminUser } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isVehicleLoading, setIsVehicleLoading] = useState(true);

  useEffect(() => {
    const getVehicle = async () => {
      setIsVehicleLoading(true);
      if (!params.id || !firestore) {
        setIsVehicleLoading(false);
        return;
      };

      const vehiclesColGroup = collectionGroup(firestore, 'vehicleListings');
      const q = query(vehiclesColGroup, where('id', '==', params.id), limit(1));

      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          setVehicle({ id: docSnap.id, ...docSnap.data() } as Vehicle);
        } else {
          setVehicle(null);
        }
      } catch (e) {
        console.error("Error fetching vehicle for detail page:", e);
        setVehicle(null);
      } finally {
        setIsVehicleLoading(false);
      }
    };

    if (firestore) {
      getVehicle();
    }
  }, [params.id, firestore]);

  const sellerProfileRef = useMemoFirebase(() => {
    if (!firestore || !vehicle) return null;
    return doc(firestore, 'users', vehicle.sellerId);
  }, [firestore, vehicle]);

  const { data: sellerInfo, isLoading: isSellerLoading } = useDoc<UserProfile>(sellerProfileRef);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const isAdmin = adminUser?.email === ADMIN_EMAIL;

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

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setSelectedImageIndex(carouselApi.selectedScrollSnap());
    };
    onSelect();
    carouselApi.on('select', onSelect);
    return () => { carouselApi.off('select', onSelect); };
  }, [carouselApi]);

  const displaySeller = sellerInfo || vehicle?.seller;

  const createWhatsAppLink = () => {
    if (!vehicle || !displaySeller?.phone) return '';

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

  // Ref-based zoom/pan for smooth, GPU-accelerated transforms (no React re-renders)
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lightboxImageRef = useRef<HTMLImageElement>(null);
  const initialTouchState = useRef({ distance: 0, scale: 1, midX: 0, midY: 0, startX: 0, startY: 0 });
  const lastTapRef = useRef(0);
  const swipeRef = useRef({ startX: 0, startY: 0, swiping: false });
  const [isZoomed, setIsZoomed] = useState(false);

  const applyTransform = useCallback((animate = false) => {
    const el = lightboxImageRef.current;
    if (!el) return;
    const { scale, x, y } = transformRef.current;
    el.style.transition = animate ? 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  const resetZoom = useCallback((animate = false) => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    applyTransform(animate);
    setIsZoomed(false);
  }, [applyTransform]);

  useEffect(() => {
    resetZoom(false);
  }, [isLightboxOpen, currentImageIndex, resetZoom]);

  const handleLightboxOpenChange = (open: boolean) => {
    if (!open) {
      resetZoom(false);
      isPanningRef.current = false;
    }
    setIsLightboxOpen(open);
  };

  if (isVehicleLoading) {
    return <LoadingSkeleton />;
  }

  if (!vehicle || !displaySeller) {
    notFound();
  }

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

  // Zoom/Pan Handlers — ref-based, no re-renders
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const t = transformRef.current;
    const scaleAmount = -e.deltaY * 0.003;
    const newScale = Math.max(1, Math.min(t.scale + scaleAmount * t.scale, 5));
    if (newScale === 1) {
      transformRef.current = { scale: 1, x: 0, y: 0 };
      applyTransform(true);
      setIsZoomed(false);
    } else {
      const container = imageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const factor = newScale / t.scale;
        transformRef.current = { scale: newScale, x: cx - factor * (cx - t.x), y: cy - factor * (cy - t.y) };
      } else {
        transformRef.current = { ...t, scale: newScale };
      }
      applyTransform(false);
      setIsZoomed(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || transformRef.current.scale <= 1) return;
    e.preventDefault();
    isPanningRef.current = true;
    panStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    if (imageContainerRef.current) imageContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    e.preventDefault();
    transformRef.current.x = e.clientX - panStart.current.x;
    transformRef.current.y = e.clientY - panStart.current.y;
    applyTransform(false);
  };

  const handleMouseUpOrLeave = () => {
    isPanningRef.current = false;
    if (imageContainerRef.current && transformRef.current.scale > 1) imageContainerRef.current.style.cursor = 'grab';
  };

  const getDistance = (touches: React.TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  const getMidpoint = (touches: React.TouchList) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPanningRef.current = false;
      swipeRef.current.swiping = false;
      const mid = getMidpoint(e.touches);
      initialTouchState.current = {
        distance: getDistance(e.touches),
        scale: transformRef.current.scale,
        midX: mid.x,
        midY: mid.y,
        startX: transformRef.current.x,
        startY: transformRef.current.y,
      };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        e.preventDefault();
        if (transformRef.current.scale > 1) {
          resetZoom(true);
        } else {
          const container = imageContainerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const cx = e.touches[0].clientX - rect.left - rect.width / 2;
            const cy = e.touches[0].clientY - rect.top - rect.height / 2;
            transformRef.current = { scale: 2.5, x: cx - 2.5 * cx, y: cy - 2.5 * cy };
            applyTransform(true);
            setIsZoomed(true);
          }
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      if (transformRef.current.scale > 1) {
        e.preventDefault();
        isPanningRef.current = true;
        panStart.current = { x: e.touches[0].clientX - transformRef.current.x, y: e.touches[0].clientY - transformRef.current.y };
      } else {
        // Start tracking swipe for image navigation
        swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, swiping: true };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDistance = getDistance(e.touches);
      const newScale = Math.max(1, Math.min((newDistance / initialTouchState.current.distance) * initialTouchState.current.scale, 5));
      const container = imageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const mid = getMidpoint(e.touches);
        const cx = mid.x - rect.left - rect.width / 2;
        const cy = mid.y - rect.top - rect.height / 2;
        const initCx = initialTouchState.current.midX - rect.left - rect.width / 2;
        const initCy = initialTouchState.current.midY - rect.top - rect.height / 2;
        const factor = newScale / initialTouchState.current.scale;
        const { startX, startY } = initialTouchState.current;
        transformRef.current = {
          scale: newScale,
          x: cx - factor * (initCx - startX),
          y: cy - factor * (initCy - startY),
        };
      } else {
        transformRef.current.scale = newScale;
      }
      applyTransform(false);
      setIsZoomed(newScale > 1);
    } else if (e.touches.length === 1 && isPanningRef.current) {
      e.preventDefault();
      transformRef.current.x = e.touches[0].clientX - panStart.current.x;
      transformRef.current.y = e.touches[0].clientY - panStart.current.y;
      applyTransform(false);
    } else if (e.touches.length === 1 && swipeRef.current.swiping) {
      // Track swipe but don't prevent default yet
      const deltaX = e.touches[0].clientX - swipeRef.current.startX;
      const deltaY = e.touches[0].clientY - swipeRef.current.startY;
      // If vertical movement dominates, cancel swipe
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 20) {
        swipeRef.current.swiping = false;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Swipe to change image when not zoomed
    if (swipeRef.current.swiping && transformRef.current.scale <= 1 && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - swipeRef.current.startX;
      if (Math.abs(deltaX) > 50 && vehicle.images.length > 1) {
        if (deltaX < 0) {
          setCurrentImageIndex(prev => (prev === vehicle.images.length - 1 ? 0 : prev + 1));
        } else {
          setCurrentImageIndex(prev => (prev === 0 ? vehicle.images.length - 1 : prev - 1));
        }
      }
      swipeRef.current.swiping = false;
    }
    isPanningRef.current = false;
    if (transformRef.current.scale <= 1.05) resetZoom(true);
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
            return deleteObject(imageRef).catch(error => {
              if (error.code === 'storage/object-not-found') {
                console.warn(`Image not found during admin deletion, skipping: ${image.url}`);
                return;
              }
              throw error;
            });
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
        description: "No se pudo eliminar la publicación por completo. Inténtalo de nuevo.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleBlockSeller = async () => {
    if (!adminUser) return;
    setIsBlocking(true);
    const newBlockedState = !displaySeller.isBlocked;
    try {
      const sellerRef = doc(firestore, 'users', vehicle.sellerId);
      await updateDoc(sellerRef, { isBlocked: newBlockedState });
      toast({
        title: `Vendedor ${newBlockedState ? 'Bloqueado' : 'Desbloqueado'}`,
        description: `${displaySeller.displayName} ha sido ${newBlockedState ? 'bloqueado' : 'desbloqueado'}.`,
      });
    } catch (error) {
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
              )} />
              {isVehicleFavorite ? 'Guardado' : 'Guardar'}
            </Button>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="font-semibold flex items-center gap-1"><Gauge className="h-4 w-4 text-muted-foreground" /> Kilometraje</div><div className="text-muted-foreground">{vehicle.mileage.toLocaleString()} km</div>
            <div className="font-semibold flex items-center gap-1"><Palette className="h-4 w-4 text-muted-foreground" /> Color</div><div className="text-muted-foreground">{vehicle.exteriorColor}</div>
            <div className="font-semibold flex items-center gap-1"><Settings2 className="h-4 w-4 text-muted-foreground" /> Motor</div><div className="text-muted-foreground">{vehicle.engine}</div>
            <div className="font-semibold flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14v14H5V5z" /><path d="M12 5v14" /><path d="M19 12H5" /><path d="M12 12l5-5" /><path d="m7 12 5 5" /></svg> Transmisión</div><div className="text-muted-foreground">{vehicle.transmission}</div>
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
    <div className="container mx-auto max-w-6xl py-4 md:py-8 px-4 md:px-6 overflow-hidden">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground overflow-hidden">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <Home className="h-3.5 w-3.5" />
          <span>Inicio</span>
        </Link>
        <span>/</span>
        <Link href="/listings" className="hover:text-foreground transition-colors">Anuncios</Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">{`${vehicle.year} ${vehicle.make} ${vehicle.model}`}</span>
      </nav>
      <div className="grid md:grid-cols-3 gap-8 items-start min-w-0">
        {/* Main Content Column */}
        <div className="md:col-span-2 space-y-8 flex flex-col min-w-0">
          <Carousel className="w-full" setApi={setCarouselApi}>
            <CarouselContent>
              {vehicle.images.map((image, index) => (
                <CarouselItem key={index} onClick={() => handleImageClick(index)} className="cursor-pointer">
                  <Card className="overflow-hidden">
                    <CardContent className="flex aspect-video items-center justify-center p-0 relative">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        width={1200}
                        height={800}
                        className="object-cover w-full h-full"
                        data-ai-hint={image.hint}
                        priority={index === 0}
                      />
                      {vehicle.images.length > 1 && (
                        <Badge variant="secondary" className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm shadow-lg text-xs font-medium">
                          {index + 1} / {vehicle.images.length}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            {vehicle.images.length > 1 && (
              <>
                <CarouselPrevious className="ml-2 md:ml-16" />
                <CarouselNext className="mr-2 md:mr-16" />
              </>
            )}
          </Carousel>

          {vehicle.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mt-4">
              {vehicle.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => carouselApi?.scrollTo(index)}
                  className={cn(
                    "relative flex-shrink-0 w-16 h-12 sm:w-20 sm:h-14 rounded-md overflow-hidden border-2 transition-all",
                    selectedImageIndex === index
                      ? "border-primary ring-1 ring-primary"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          )}

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
                {mainFeatures.map(({ icon: Icon, label }) => (
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
              {mainFeatures.map(({ icon: Icon, label }) => (
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
                <ContactDialog
                  isContactDialogOpen={isContactDialogOpen}
                  setIsContactDialogOpen={setIsContactDialogOpen}
                  displaySeller={displaySeller}
                  handleContactClick={handleContactClick}
                  countdown={countdown}
                  createWhatsAppLink={createWhatsAppLink}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Los vendedores verificados han confirmado su identidad vía WhatsApp.
                </p>
              </CardContent>

              <div className="border-t">
                <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
                  <DialogTrigger asChild>
                    <div className="h-40 w-full cursor-pointer relative group">
                      <Map
                        mapId="listing_detail_map_mobile"
                        defaultCenter={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                        defaultZoom={12}
                        gestureHandling={'none'}
                        zoomControl={false}
                        streetViewControl={false}
                        mapTypeControl={false}
                        fullscreenControl={false}
                        clickableIcons={false}
                        className="w-full h-full"
                      >
                        <AdvancedMarker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}>
                          <CarMarker />
                        </AdvancedMarker>
                      </Map>
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
                    <Map
                      mapId="listing_detail_map_dialog"
                      defaultCenter={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                      defaultZoom={15}
                      streetViewControl={false}
                      mapTypeControl={false}
                      fullscreenControl={false}
                      className="w-full h-full"
                    >
                      <AdvancedMarker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}>
                        <CarMarker />
                      </AdvancedMarker>
                    </Map>
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
                  <ContactDialog
                    isContactDialogOpen={isContactDialogOpen}
                    setIsContactDialogOpen={setIsContactDialogOpen}
                    displaySeller={displaySeller}
                    handleContactClick={handleContactClick}
                    countdown={countdown}
                    createWhatsAppLink={createWhatsAppLink}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Los vendedores verificados han confirmado su identidad vía WhatsApp.
                  </p>
                </CardContent>

                <div className="border-t">
                  <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
                    <DialogTrigger asChild>
                      <div className="h-40 w-full cursor-pointer relative group">
                        <Map
                          mapId="listing_detail_map_desktop"
                          defaultCenter={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                          defaultZoom={12}
                          gestureHandling={'none'}
                          zoomControl={false}
                          streetViewControl={false}
                          mapTypeControl={false}
                          fullscreenControl={false}
                          clickableIcons={false}
                          className="w-full h-full"
                        >
                          <AdvancedMarker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}>
                            <CarMarker />
                          </AdvancedMarker>
                        </Map>
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
                      <Map
                        mapId="listing_detail_map_dialog_desktop"
                        defaultCenter={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}
                        defaultZoom={15}
                        streetViewControl={false}
                        mapTypeControl={false}
                        fullscreenControl={false}
                        className="w-full h-full"
                      >
                        <AdvancedMarker position={{ lat: vehicle.location.lat, lng: vehicle.location.lon }}>
                          <CarMarker />
                        </AdvancedMarker>
                      </Map>
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
                      {isTogglingStatus ? <Loader2 className="animate-spin mr-2" /> : <Pause className="mr-2" />}
                      Pausar Anuncio
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => handleToggleStatus('active')} disabled={isTogglingStatus}>
                      {isTogglingStatus ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2" />}
                      Reactivar Anuncio
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2" /> Eliminar Anuncio
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
                          {isDeleting && <Loader2 className="animate-spin mr-2" />}
                          Sí, eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Separator className="my-2" />

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant={displaySeller.isBlocked ? 'secondary' : 'destructive'}>
                        <ShieldBan className="mr-2" /> {displaySeller.isBlocked ? 'Desbloquear Vendedor' : 'Bloquear Vendedor'}
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
                          {isBlocking && <Loader2 className="animate-spin mr-2" />}
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
              "relative w-full h-full select-none",
              isZoomed ? 'cursor-grab' : 'cursor-auto'
            )}
            style={{ touchAction: 'none' }}
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
              ref={lightboxImageRef}
              key={currentImageIndex}
              src={vehicle.images[currentImageIndex].url}
              alt={vehicle.images[currentImageIndex].alt}
              fill
              className="object-contain"
              style={{
                willChange: 'transform',
                transformOrigin: 'center center',
                cursor: 'inherit',
              }}
              data-ai-hint={vehicle.images[currentImageIndex].hint}
              sizes="(max-width: 1280px) 90vw, 80vw"
              draggable="false"
            />
          </div>

          {vehicle.images.length > 1 && !isZoomed && (
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

function LoadingSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl py-8">
      <Skeleton className="h-10 w-48 mb-4" />
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 space-y-8">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-48 w-full hidden md:block" />
          <Skeleton className="h-48 w-full hidden md:block" />
        </div>
        <div className="md:col-span-1 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  return (
    <MapsProvider>
      <ListingDetailContent />
    </MapsProvider>
  );
}
