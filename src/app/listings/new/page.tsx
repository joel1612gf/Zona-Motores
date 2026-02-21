'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bike, Car, Truck, UploadCloud, X, Loader2, ShieldAlert, Phone, ExternalLink, AlertTriangle, MapPin, LocateFixed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirestore, useUser, useMemoFirebase, useStorage } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, doc, serverTimestamp, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMakes } from '@/context/makes-context';
import { useVehicles } from '@/context/vehicle-context';
import { useSubscription } from '@/context/subscription-context';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import imageCompression from 'browser-image-compression';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { summarizeVehicleListing } from '@/ai/flows/summarize-vehicle-listing';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from '@/lib/utils';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';


type VehicleType = 'Moto' | 'Carro' | 'Camioneta';
type Step = 'selection' | 'details' | 'location' | 'photos';

const vehicleTypeOptions: {
    id: VehicleType;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
}[] = [
        { id: 'Moto', name: 'Moto', icon: Bike },
        { id: 'Carro', name: 'Carro', icon: Car },
        { id: 'Camioneta', name: 'Camioneta', icon: Truck },
    ];

// LISTING_LIMIT is now dynamic, see useSubscription()
const ADMIN_EMAIL = 'zonamotores.ve@gmail.com';

const defaultCenter = { lat: 6.4238, lng: -66.5897 }; // Center of Venezuela

function CarMarker() {
    const carIconDataUri = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImhzbCh2YXIoLS1wcmltYXJ5KSkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1jYXIiPjxwYXRoIGQ9Ik0xOSA5bDIgMGMuNiAwIDEgLjQgMSAxdjNjMCAuOS0uNyAxLjctMS41IDEuOUMxOC43IDE1LjQgMTYgMTUgMTYgMTVzLTEuMy0xLjQtMi4yLTIuM2MtLjUtLjQtMS4xLS43LTEuOC0uN0g1Yy0uNiAwLTEuMS40LTEuNC45TDEuNCAxNy45Yy0uMS4yLS4xLjQtLjEuNlYyMWMwIC42LjQgMSAxIDEiLz48cGF0aCBkPSJNNyAyMXYtMS4zIi8+PHBhdGggZD0iTTE3IDIxdi0xLjMiLz48cGF0aCBkPSJNNSAxNWgxNCIvPjxjaXJjbGUgY3g9IjciIGN5PSIxNyIgcj0iMiIvPjxjaXJjbGUgY3g9IjE3IiBjeT0iMTciIHI9IjIiLz48L3N2Zz4=';
  
    return (
      <div style={{ width: 24, height: 24 }}>
        <img src={carIconDataUri} alt="Car Marker" />
      </div>
    );
  }

export default function NewListingPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const { vehicles: allVehicles } = useVehicles();
    const { limits: planLimits, planName: currentPlanName, plan: currentPlan } = useSubscription();

    const isAdmin = user?.email === ADMIN_EMAIL;

    const profileRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: profileData, isLoading: isProfileLoading } = useDoc(profileRef);

    // Logic to check for listing limit
    const userListingsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'vehicleListings');
    }, [user, firestore]);

    const { data: allUserListings, isLoading: areListingsLoading } = useCollection(userListingsQuery);

    const currentListingCount = useMemo(() => {
        if (!allUserListings) return 0;
        // Count all listings that are not marked as 'sold'.
        return allUserListings.filter(l => l.status !== 'sold').length;
    }, [allUserListings]);

    const LISTING_LIMIT = planLimits.maxListings;
    const limitReached = !isAdmin && currentListingCount >= LISTING_LIMIT;


    const { makesByType, isLoading: areMakesLoading } = useMakes();

    const [step, setStep] = useState<Step>('selection');

    const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>('');

    const [photos, setPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
    const [mainPhotoIndex, setMainPhotoIndex] = useState<number | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

    const [location, setLocation] = useState<{ lat: number; lon: number; city: string; state: string; } | null>(null);
    const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [mapCenter, setMapCenter] = useState(defaultCenter);


    const [details, setDetails] = useState({
        price: '',
        mileage: '',
        transmission: 'Automática',
        exteriorColor: '',
        engine: '',
        hadMajorCrash: false,
        hasAC: true,
        isOperational: true,
        operationalDetails: '',
        isSignatory: true,
        doorCount: '4',
        is4x4: false,
        isArmored: false,
        armorLevel: '1',
        hasSoundSystem: false,
        ownerCount: '1',
        tireLife: '75',
        moreDetails: '',
        acceptsTradeIn: false,
        tradeInDetails: '',
        tradeInForHigherValue: false,
        tradeInForLowerValue: false,
        sellerName: '',
        sellerPhone: '',
        marketplaceUrl: '',
    });

    useEffect(() => {
        if (!markerPosition) {
            return;
        }

        setIsGeocoding(true);
        setLocation(null);

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: markerPosition }, (results, status) => {
            if (status === 'OK' && results?.[0]) {
                const address = results[0];
                let city = '';
                let state = '';

                for (const component of address.address_components) {
                    const componentType = component.types[0];
                    if (componentType === 'locality') {
                        city = component.long_name;
                    }
                    if (componentType === 'administrative_area_level_1') {
                        state = component.long_name;
                    }
                }

                if (!city) {
                    city = address.address_components.find(c => c.types.includes("administrative_area_level_2"))?.long_name || "Ubicación";
                }
                if (!state) {
                    state = address.address_components.find(c => c.types.includes("country"))?.long_name || "Desconocida";
                }

                setLocation({
                    lat: markerPosition.lat,
                    lon: markerPosition.lng,
                    city: city,
                    state: state,
                });
            } else {
                console.error(`Geocode was not successful for the following reason: ${status}`);
                toast({ title: "Error de Geocodificación", description: "No se pudo determinar la ciudad y estado. Intenta con otro punto.", variant: "destructive" });
            }
            setIsGeocoding(false);
        });
    }, [markerPosition, toast]);

    const allMakesForSelectedType = useMemo(() => {
        if (!makesByType || !selectedType || !makesByType[selectedType]) return [];
        return Object.keys(makesByType[selectedType]).sort().map(make => ({ label: make, value: make }));
    }, [makesByType, selectedType]);

    const modelsByMake = useMemo(() => {
        if (!selectedBrand || !selectedType || !makesByType || !makesByType[selectedType] || !makesByType[selectedType][selectedBrand]) return [];
        return (makesByType[selectedType][selectedBrand] || []).map(model => ({ label: model, value: model }));
    }, [selectedBrand, selectedType, makesByType]);

    const handleDetailChange = (field: keyof typeof details, value: any) => {
        setDetails(prev => ({ ...prev, [field]: value }));
    };

    const getWelcomeMessage = () => {
        return '¿Qué vehículo quieres publicar el día de hoy?';
    };

    const handleNextToDetails = () => {
        const yearNum = parseInt(selectedYear, 10);
        const minYear = 1950;
        const maxYear = new Date().getFullYear() + 1;

        if (isNaN(yearNum) || yearNum < minYear || yearNum > maxYear) {
            toast({
                title: "Año Inválido",
                description: `Por favor, ingresa un año entre ${minYear} y ${maxYear}.`,
                variant: "destructive",
            });
            return;
        }
        setStep('details');
    }

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        if (photos.length + files.length > 12) {
            toast({
                title: "Límite de fotos alcanzado",
                description: "Puedes subir un máximo de 12 fotos.",
                variant: "destructive",
            });
            return;
        }

        const compressionToast = toast({
            title: 'Comprimiendo imágenes...',
            description: 'Por favor, espera un momento.',
        });

        const newPhotosPromises = Array.from(files).map(async (file) => {
            try {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                };
                const compressedFile = await imageCompression(file, options);
                return {
                    file: compressedFile,
                    previewUrl: URL.createObjectURL(compressedFile)
                };
            } catch (error) {
                console.error('Error al comprimir la imagen:', error);
                toast({
                    title: 'Error de compresión',
                    description: `No se pudo comprimir la imagen ${file.name}.`,
                    variant: 'destructive',
                });
                return null;
            }
        });

        const newPhotos = (await Promise.all(newPhotosPromises)).filter((p): p is { file: File; previewUrl: string } => p !== null);

        compressionToast.dismiss();

        if (newPhotos.length > 0) {
            const updatedPhotos = [...photos, ...newPhotos];
            setPhotos(updatedPhotos);

            if (mainPhotoIndex === null && updatedPhotos.length > 0) {
                setMainPhotoIndex(0);
            }
            toast({
                title: 'Imágenes listas',
                description: `${newPhotos.length} foto(s) se han comprimido y añadido.`,
            });
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => {
            const photoToRemove = prev[index];
            URL.revokeObjectURL(photoToRemove.previewUrl);
            const newPhotos = prev.filter((_, i) => i !== index);
            return newPhotos;
        });

        if (mainPhotoIndex === index) {
            setMainPhotoIndex(photos.length > 1 ? 0 : null);
        } else if (mainPhotoIndex && mainPhotoIndex > index) {
            setMainPhotoIndex(mainPhotoIndex - 1);
        }
    };

    const handleGenerateDescription = async () => {
        if (!selectedType) return;
        setIsGeneratingDescription(true);
        try {
            const { summary } = await summarizeVehicleListing({
                make: selectedBrand,
                model: selectedModel,
                year: parseInt(selectedYear, 10),
                mileage: parseInt(details.mileage, 10) || 0,
                bodyType: selectedType,
                exteriorColor: details.exteriorColor,
                description: details.moreDetails,
                features: [
                    details.is4x4 ? '4x4' : '',
                    details.isArmored ? `Blindado nivel ${details.armorLevel}` : '',
                    details.hasAC ? 'Aire Acondicionado' : '',
                    details.hasSoundSystem ? 'Sistema de sonido' : '',
                    details.acceptsTradeIn ? 'Acepta cambios' : '',
                ].filter(Boolean),
            });
            handleDetailChange('moreDetails', summary);
            toast({
                title: "Descripción Generada",
                description: "La descripción ha sido generada por IA y añadida al formulario."
            });
        } catch (e) {
            console.error("Error generating description", e);
            toast({
                title: "Error",
                description: "No se pudo generar la descripción.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingDescription(false);
        }
    };

    const validatePriceAgainstMarket = (price: number): boolean => {
        if (!selectedBrand || !selectedModel || !selectedYear || !allVehicles) return true;

        const similarVehicles = allVehicles.filter(v =>
            v.make === selectedBrand &&
            v.model === selectedModel &&
            v.year === parseInt(selectedYear, 10) &&
            v.status === 'active'
        );

        if (similarVehicles.length < 3) {
            console.log("Not enough market data to validate price.");
            return true;
        }

        const prices = similarVehicles.map(v => v.priceUSD);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        const lowerBound = minPrice * 0.7;
        const upperBound = maxPrice * 1.3;

        if (price < lowerBound) {
            if (details.isOperational) {
                toast({
                    title: "Precio Sospechosamente Bajo",
                    description: `El precio que ingresaste es muy bajo comparado con el rango del mercado (${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}). Asegúrate de que es correcto.`,
                    duration: 8000,
                });
                return true;
            } else {
                return true;
            }
        }

        if (price > upperBound) {
            toast({
                variant: "destructive",
                title: "Precio Fuera de Rango",
                description: `El precio ingresado es muy superior al rango del mercado para este vehículo (${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}). Por favor, introduce un precio realista.`,
                duration: 8000,
            });
            return false;
        }

        return true;
    };


    const handlePublish = async () => {
        const price = parseInt(details.price, 10);
        const minPriceCar = 800;
        const minPriceMoto = 300;
        const maxPrice = 999999;

        if (!details.price || isNaN(price) || price <= 0) {
            toast({
                title: "Precio requerido",
                description: "Por favor, ingresa un precio válido para el vehículo.",
                variant: "destructive",
            });
            return;
        }

        if (selectedType === 'Moto' && price < minPriceMoto) {
            toast({
                title: "Precio muy bajo",
                description: `El precio mínimo para una moto es de ${formatCurrency(minPriceMoto)}.`,
                variant: "destructive",
            });
            return;
        }

        if ((selectedType === 'Carro' || selectedType === 'Camioneta') && price < minPriceCar) {
            toast({
                title: "Precio muy bajo",
                description: `El precio mínimo para un vehículo es de ${formatCurrency(minPriceCar)}.`,
                variant: "destructive",
            });
            return;
        }

        if (price > maxPrice) {
            toast({
                title: "Precio muy alto",
                description: `El precio no puede exceder los ${formatCurrency(maxPrice)}.`,
                variant: "destructive",
            });
            return;
        }

        if (!user) {
            toast({
                title: "Necesitas iniciar sesión",
                description: "Para publicar un anuncio, primero debes iniciar sesión.",
                variant: "destructive",
            });
            return;
        }

        if (photos.length < 4) {
            toast({
                title: "Fotos insuficientes",
                description: "Debes subir al menos 4 fotos.",
                variant: "destructive",
            });
            return;
        }

        try {
            if (!isAdmin) {
                const userListingsRef = collection(firestore, 'users', user.uid, 'vehicleListings');
                const snapshot = await getDocs(userListingsRef);
                const currentTotalCount = snapshot.docs.map(d => d.data()).filter(l => l.status !== 'sold').length;

                if (currentTotalCount >= LISTING_LIMIT) {
                    toast({
                        title: "Límite de publicaciones alcanzado",
                        description: `No puedes tener más de ${LISTING_LIMIT} publicaciones. Elimina una para continuar.`,
                        variant: "destructive",
                    });
                    router.push('/profile/listings');
                    return;
                }
            }
        } catch (e) {
            console.error("Could not verify listing count", e);
            toast({
                title: "Error al verificar límite",
                description: "No pudimos verificar tu número de publicaciones. Inténtalo de nuevo.",
                variant: "destructive",
            });
            return;
        }

        /*
        const isPriceValid = validatePriceAgainstMarket(price);
        if (!isPriceValid) {
          return;
        }
        */

        setIsPublishing(true);
        setUploadProgress(0);

        try {
            const vehicleCollection = collection(firestore, 'users', user.uid, 'vehicleListings');
            const newVehicleRef = doc(vehicleCollection);

            const photosToUpload = [...photos];
            if (mainPhotoIndex !== null && mainPhotoIndex > 0 && photosToUpload.length > mainPhotoIndex) {
                const mainPhoto = photosToUpload.splice(mainPhotoIndex, 1)[0];
                photosToUpload.unshift(mainPhoto);
            }

            const uploadedImages: { url: string; alt: string; hint: string }[] = [];

            for (let i = 0; i < photosToUpload.length; i++) {
                const photo = photosToUpload[i];
                const fileName = `${Date.now()}-${i}-${photo.file.name}`;
                const imageRef = ref(storage, `vehicle-images/${user.uid}/${fileName}`);

                const metadata = {
                    contentType: photo.file.type,
                };

                const uploadTask = uploadBytesResumable(imageRef, photo.file, metadata);

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            const totalProgress = ((i * 100) + progress) / photos.length;
                            setUploadProgress(totalProgress);
                        },
                        (error) => {
                            console.error("Fallo en la subida de imagen:", error);
                            reject(error);
                        },
                        async () => {
                            try {
                                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                                uploadedImages.push({
                                    url: downloadURL,
                                    alt: `Foto ${i + 1} de ${selectedBrand} ${selectedModel}`,
                                    hint: 'car photo'
                                });
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        }
                    );
                });
            }

            if (uploadedImages.length !== photos.length) {
                throw new Error("No todas las imágenes se subieron correctamente.");
            }

            const newVehicleData: any = {
                id: newVehicleRef.id,
                make: selectedBrand,
                model: selectedModel,
                year: parseInt(selectedYear, 10),
                priceUSD: parseInt(details.price, 10),
                mileage: parseInt(details.mileage, 10) || 0,
                bodyType: selectedType as string,
                transmission: details.transmission as 'Automática' | 'Sincrónica',
                engine: details.engine,
                exteriorColor: details.exteriorColor,
                ownerCount: parseInt(details.ownerCount, 10),
                tireLife: parseInt(details.tireLife, 10),
                hasAC: details.hasAC,
                hasSoundSystem: details.hasSoundSystem,
                hadMajorCrash: details.hadMajorCrash,
                isOperational: details.isOperational,
                isSignatory: details.isSignatory,
                acceptsTradeIn: details.acceptsTradeIn,
                is4x4: details.is4x4,
                isArmored: details.isArmored,
                description: details.moreDetails,
                images: uploadedImages,
                sellerId: user.uid,
                seller: {
                    uid: user.uid,
                    displayName: isAdmin ? details.sellerName : (user.displayName || 'Vendedor Anónimo'),
                    isVerified: (profileData as any)?.isVerified || false,
                    phone: isAdmin ? details.sellerPhone : (user.phoneNumber || ''),
                    accountType: (profileData as any)?.accountType || 'personal'
                },
                location: location!,
                createdAt: serverTimestamp(),
                status: 'active' as 'active' | 'paused' | 'sold',
                promotionExpiresAt: Timestamp.fromDate(new Date(0)),
            };

            if (isAdmin && details.marketplaceUrl) {
                newVehicleData.marketplaceUrl = details.marketplaceUrl;
            }
            if (selectedType === 'Carro') {
                newVehicleData.doorCount = details.doorCount as '2' | '4';
            }
            if (!details.isOperational) {
                newVehicleData.operationalDetails = details.operationalDetails;
            }
            if (details.acceptsTradeIn) {
                newVehicleData.tradeInDetails = details.tradeInDetails;
                newVehicleData.tradeInForHigherValue = details.tradeInForHigherValue;
                newVehicleData.tradeInForLowerValue = details.tradeInForLowerValue;
            }
            if (details.isArmored) {
                newVehicleData.armorLevel = parseInt(details.armorLevel, 10);
            }

            await setDoc(newVehicleRef, newVehicleData);

            toast({
                title: "¡Publicación Creada!",
                description: `Tu ${selectedBrand} ${selectedModel} se publicó con éxito.`,
            });

            router.push('/');

        } catch (e) {
            console.error("Error al publicar el anuncio: ", e);
            toast({
                variant: "destructive",
                title: "Error al publicar",
                description: "No se pudo guardar el vehículo. Revisa tu conexión y los permisos de almacenamiento.",
            });
        } finally {
            setIsPublishing(false);
            setUploadProgress(null);
        }
    }

    const handleTypeSelect = (type: VehicleType) => {
        setSelectedType(type);
        setSelectedBrand('');
        setSelectedModel('');
        setSelectedYear('');
    };

    const handleBrandChange = (brand: string) => {
        setSelectedBrand(brand);
        setSelectedModel('');
        setSelectedYear('');
    };

    const handleModelChange = (model: string) => {
        setSelectedModel(model);
        setSelectedYear('');
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.length > 4) return;
        setSelectedYear(value);
    };

    const handleYearBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) return;

        let year = parseInt(value, 10);
        if (isNaN(year)) {
            setSelectedYear('');
            toast({ title: "Año inválido", description: "Por favor, introduce un número válido.", variant: "destructive" });
            return;
        }

        if (year >= 0 && year < 100) {
            if (year > (new Date().getFullYear() % 100) + 1) {
                year += 1900;
            } else {
                year += 2000;
            }
        }

        const finalYearString = year.toString();
        setSelectedYear(finalYearString);

        const minYear = 1950;
        const maxYear = new Date().getFullYear() + 1;

        if (year < minYear || year > maxYear) {
            toast({ title: "Año inválido", description: `El año debe estar entre ${minYear} y ${maxYear}.`, variant: "destructive" });
        }
    };

    const getPrompt = () => {
        if (!selectedBrand) {
            return `¿Qué marca es tu ${selectedType?.toLowerCase()}?`;
        }
        if (!selectedModel) {
            return `¿Qué modelo es tu ${selectedBrand}?`;
        }
        return `¿De qué año es tu ${selectedModel}?`;
    };

    const renderSelectionStep = () => (
        <>
            <div className="text-center mb-12">
                <h1 className="font-headline text-3xl font-bold">{getWelcomeMessage()}</h1>
            </div>

            <div className="flex justify-center gap-4 mb-12">
                {vehicleTypeOptions.map((type) => {
                    const Icon = type.icon;
                    return (
                        <Button
                            key={type.id}
                            variant="outline"
                            className={cn(
                                "h-28 w-40 flex flex-col gap-2 justify-center text-lg font-semibold",
                                selectedType === type.id
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-muted text-muted-foreground hover:bg-muted/90"
                            )}
                            onClick={() => handleTypeSelect(type.id)}
                        >
                            <Icon className="h-10 w-10" />
                            <span>{type.name}</span>
                        </Button>
                    );
                })}
            </div>

            {selectedType && (
                <div className="flex flex-col items-center space-y-8 animate-in fade-in-50 duration-500">
                    <div className='flex items-end gap-4'>
                        {selectedBrand && (
                            <div className="p-4 border rounded-md bg-muted transition-all animate-in fade-in-0 duration-300">
                                <p className="text-sm text-muted-foreground">Marca</p>
                                <p className="font-semibold">{selectedBrand}</p>
                            </div>
                        )}
                        {selectedModel && (
                            <div className="p-4 border rounded-md bg-muted transition-all animate-in fade-in-0 duration-300">
                                <p className="text-sm text-muted-foreground">Modelo</p>
                                <p className="font-semibold">{selectedModel}</p>
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-semibold mb-2 text-center">
                                {getPrompt()}
                            </h2>
                            {!selectedBrand ? (
                                <Combobox
                                    options={allMakesForSelectedType}
                                    value={selectedBrand}
                                    onChange={handleBrandChange}
                                    placeholder={areMakesLoading ? 'Cargando...' : 'Selecciona una marca'}
                                    searchPlaceholder="Buscar marca..."
                                    notFoundMessage="No se encontró la marca."
                                    disabled={areMakesLoading || !selectedType}
                                />
                            ) : !selectedModel ? (
                                <Combobox
                                    options={modelsByMake}
                                    value={selectedModel}
                                    onChange={handleModelChange}
                                    placeholder="Selecciona un modelo"
                                    searchPlaceholder="Buscar modelo..."
                                    notFoundMessage="No se encontró el modelo."
                                    disabled={!selectedBrand}
                                />
                            ) : (
                                <Input
                                    type="number"
                                    placeholder="Ej: 2021"
                                    value={selectedYear}
                                    onChange={handleYearChange}
                                    onBlur={handleYearBlur}
                                    min="1950"
                                    max={new Date().getFullYear() + 1}
                                    className="w-[200px]"
                                    autoFocus
                                />
                            )}
                        </div>
                    </div>

                    {(selectedBrand && selectedModel && selectedYear) && (
                        <Button onClick={handleNextToDetails} size="lg">
                            Siguiente
                        </Button>
                    )}
                </div>
            )}
        </>
    );

    const renderDetailsStep = () => (
        <div className="animate-in fade-in-50 duration-500">
            <Button variant="ghost" onClick={() => setStep('selection')} className="mb-4 pl-0">
                &larr; Volver a selección
            </Button>
            <h2 className="text-2xl font-bold font-headline mb-4 text-center">
                Detalles del Vehículo: {selectedYear} {selectedBrand} {selectedModel}
            </h2>
            <Card className="p-6">
                {isAdmin && (
                    <>
                        <CardHeader className="p-0 pb-6 -mt-2">
                            <CardTitle>Información del Vendedor (Admin)</CardTitle>
                            <CardDescription>Estás publicando en nombre de otra persona. Introduce sus datos de contacto.</CardDescription>
                        </CardHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-6">
                            <div className="space-y-2">
                                <Label htmlFor="sellerName">Nombre del Vendedor</Label>
                                <Input id="sellerName" value={details.sellerName} onChange={(e) => handleDetailChange('sellerName', e.target.value)} placeholder="Ej: Carlos Rodriguez" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellerPhone">Teléfono del Vendedor</Label>
                                <Input id="sellerPhone" type="tel" value={details.sellerPhone} onChange={(e) => handleDetailChange('sellerPhone', e.target.value)} placeholder="+58412..." />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="marketplaceUrl">URL de Marketplace (Opcional)</Label>
                                <Input id="marketplaceUrl" value={details.marketplaceUrl} onChange={(e) => handleDetailChange('marketplaceUrl', e.target.value)} placeholder="https://www.facebook.com/marketplace/item/..." />
                            </div>
                        </div>
                        <Separator className="mb-6" />
                    </>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-2">
                        <Label htmlFor="price">Precio (USD)</Label>
                        <Input id="price" type="number" min="0" value={details.price} onChange={(e) => handleDetailChange('price', e.target.value)} placeholder="Ej: 22000" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mileage">Kilometraje</Label>
                        <Input id="mileage" type="number" min="0" value={details.mileage} onChange={(e) => handleDetailChange('mileage', e.target.value)} placeholder="Ej: 55000" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="engine">Motor</Label>
                        <Input id="engine" value={details.engine} onChange={(e) => handleDetailChange('engine', e.target.value)} placeholder="Ej: 1.8L 4 Cilindros" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="exteriorColor">Color Exterior</Label>
                        <Input id="exteriorColor" value={details.exteriorColor} onChange={(e) => handleDetailChange('exteriorColor', e.target.value)} placeholder="Ej: Blanco Perlado" />
                    </div>
                    <div className="rounded-lg border p-4">
                        <Label className="mb-3 block">Transmisión</Label>
                        <RadioGroup value={details.transmission} onValueChange={(v) => handleDetailChange('transmission', v)} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Automática" id="t_auto" />
                                <Label htmlFor="t_auto">Automática</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Sincrónica" id="t_sync" />
                                <Label htmlFor="t_sync">Sincrónica</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="hadMajorCrash" className="pr-4">¿Tuvo un choque fuerte o fue volteado?</Label>
                        <Switch id="hadMajorCrash" checked={details.hadMajorCrash} onCheckedChange={(c) => handleDetailChange('hadMajorCrash', c)} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="hasAC" className="pr-4">¿Tiene aire acondicionado?</Label>
                        <Switch id="hasAC" checked={details.hasAC} onCheckedChange={(c) => handleDetailChange('hasAC', c)} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="isOperational" className="pr-4">¿El vehículo rueda actualmente?</Label>
                        <Switch id="isOperational" checked={details.isOperational} onCheckedChange={(c) => handleDetailChange('isOperational', c)} />
                    </div>
                    {!details.isOperational && (
                        <div className="md:col-span-2 space-y-2 animate-in fade-in-50 duration-300">
                            <Label htmlFor="operationalDetails">Por favor, explica por qué no rueda</Label>
                            <Textarea id="operationalDetails" value={details.operationalDetails} onChange={(e) => handleDetailChange('operationalDetails', e.target.value)} placeholder="Ej: Falla en el motor, caja de cambios dañada..." />
                        </div>
                    )}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="isSignatory" className="pr-4">¿Eres el firmante del vehículo?</Label>
                        <Switch id="isSignatory" checked={details.isSignatory} onCheckedChange={(c) => handleDetailChange('isSignatory', c)} />
                    </div>
                    {selectedType === 'Carro' && (
                        <div className="rounded-lg border p-4">
                            <Label className="mb-3 block">Número de puertas</Label>
                            <RadioGroup value={details.doorCount} onValueChange={(v) => handleDetailChange('doorCount', v)} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="2" id="d2" />
                                    <Label htmlFor="d2">2 puertas</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="4" id="d4" />
                                    <Label htmlFor="d4">4 puertas</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="is4x4" className="pr-4">¿Es 4x4?</Label>
                        <Switch id="is4x4" checked={details.is4x4} onCheckedChange={(c) => handleDetailChange('is4x4', c)} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="hasSoundSystem" className="pr-4">¿Tiene sistema de sonido?</Label>
                        <Switch id="hasSoundSystem" checked={details.hasSoundSystem} onCheckedChange={(c) => handleDetailChange('hasSoundSystem', c)} />
                    </div>
                    <div className="md:col-span-2 space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="isArmored" className="pr-4">¿El vehículo es blindado?</Label>
                            <Switch id="isArmored" checked={details.isArmored} onCheckedChange={(c) => handleDetailChange('isArmored', c)} />
                        </div>
                        {details.isArmored && (
                            <div className="space-y-2 pt-4 border-t animate-in fade-in-50 duration-300">
                                <Label htmlFor="armorLevel">Nivel de Blindaje</Label>
                                <Select onValueChange={(v) => handleDetailChange('armorLevel', v)} defaultValue={details.armorLevel}>
                                    <SelectTrigger id="armorLevel">
                                        <SelectValue placeholder="Selecciona el nivel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Nivel 1</SelectItem>
                                        <SelectItem value="2">Nivel 2</SelectItem>
                                        <SelectItem value="3">Nivel 3</SelectItem>
                                        <SelectItem value="4">Nivel 4</SelectItem>
                                        <SelectItem value="5">Nivel 5</SelectItem>
                                        <SelectItem value="6">Nivel 6</SelectItem>
                                        <SelectItem value="7">Nivel 7</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <div className="md:col-span-2 space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="acceptsTradeIn" className="pr-4">¿Aceptas vehículo como parte de pago?</Label>
                            <Switch id="acceptsTradeIn" checked={details.acceptsTradeIn} onCheckedChange={(c) => handleDetailChange('acceptsTradeIn', c)} />
                        </div>
                        {details.acceptsTradeIn && (
                            <div className="space-y-4 pt-4 border-t animate-in fade-in-50 duration-300">
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <Label htmlFor="tradeInForLowerValue" className="pr-4">¿Recibes vehículos de menor valor?</Label>
                                    <Switch id="tradeInForLowerValue" checked={details.tradeInForLowerValue} onCheckedChange={(c) => handleDetailChange('tradeInForLowerValue', c)} />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <Label htmlFor="tradeInForHigherValue" className="pr-4">¿Das tu vehículo como parte de pago por uno de mayor valor?</Label>
                                    <Switch id="tradeInForHigherValue" checked={details.tradeInForHigherValue} onCheckedChange={(c) => handleDetailChange('tradeInForHigherValue', c)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tradeInDetails">Modelos específicos que aceptarías (opcional)</Label>
                                    <Textarea id="tradeInDetails" value={details.tradeInDetails} onChange={(e) => handleDetailChange('tradeInDetails', e.target.value)} placeholder="Ej: Toyota Corolla 2020, Ford Explorer..." />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ownerCount">Título (Número de dueños)</Label>
                        <Input id="ownerCount" type="number" min="1" value={details.ownerCount} onChange={(e) => handleDetailChange('ownerCount', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tireLife">Porcentaje de vida de los cauchos</Label>
                        <Input id="tireLife" type="number" min="0" max="100" step="5" value={details.tireLife} onChange={(e) => handleDetailChange('tireLife', e.target.value)} placeholder="Ej: 75" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <Label htmlFor="moreDetails">Descripción / Más detalles</Label>
                            <Button variant="outline" size="sm" onClick={handleGenerateDescription} disabled={isGeneratingDescription}>
                                {isGeneratingDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                                Generar descripción con IA
                            </Button>
                        </div>
                        <Textarea id="moreDetails" placeholder="Añade cualquier otra información relevante como extras, detalles de pintura, etc." value={details.moreDetails} onChange={(e) => handleDetailChange('moreDetails', e.target.value)} />
                    </div>
                </div>
                <div className="flex justify-end mt-8">
                    <Button onClick={() => setStep('location')} size="lg">Siguiente</Button>
                </div>
            </Card>
        </div>
    );

    const renderLocationStep = () => (
        <div className="animate-in fade-in-50 duration-500">
            <Button variant="ghost" onClick={() => setStep('details')} className="mb-4 pl-0">
                &larr; Volver a detalles
            </Button>
            <h2 className="text-2xl font-bold font-headline mb-2 text-center">
                Selecciona la ubicación de tu vehículo
            </h2>
            <p className="text-center text-muted-foreground mb-6">
                Haz clic en el mapa para fijar un punto o usa tu ubicación actual.
            </p>

            <Card className="p-4">
                <div className='rounded-lg overflow-hidden border h-[400px] mb-4'>
                    <Map
                        mapId="new_listing_map"
                        defaultCenter={mapCenter}
                        defaultZoom={mapCenter === defaultCenter ? 5 : 12}
                        onClick={(e) => e.detail.latLng && setMarkerPosition(e.detail.latLng)}
                        streetViewControl={false}
                        mapTypeControl={false}
                        fullscreenControl={false}
                        className="w-full h-full"
                    >
                        {markerPosition && <AdvancedMarker position={markerPosition}><CarMarker /></AdvancedMarker>}
                    </Map>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                                setMarkerPosition(newPos);
                                setMapCenter(newPos);
                            },
                            () => toast({ title: "Error de Ubicación", description: "No se pudo obtener tu ubicación. Por favor, actívala en tu navegador.", variant: "destructive" })
                        )
                    }}>
                        <LocateFixed className="mr-2" />
                        Usar mi ubicación actual
                    </Button>
                    <div className="flex-grow h-12 flex items-center justify-center rounded-md border bg-muted px-4">
                        {isGeocoding && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                        {!isGeocoding && location && (
                            <div className="flex items-center text-sm font-medium">
                                <MapPin className="h-5 w-5 mr-2 text-primary" />
                                <span>{location.city}, {location.state}</span>
                            </div>
                        )}
                        {!isGeocoding && !location && (
                            <span className="text-sm text-muted-foreground">Ubicación no seleccionada</span>
                        )}
                    </div>
                </div>
            </Card>

            <div className="flex justify-end mt-8">
                <Button onClick={() => setStep('photos')} size="lg" disabled={!location || isGeocoding}>
                    Siguiente
                </Button>
            </div>
        </div>
    );

    const renderPhotosStep = () => (
        <div className="animate-in fade-in-50 duration-500">
            <Button variant="ghost" onClick={() => setStep('location')} className="mb-4 pl-0">
                &larr; Volver a ubicación
            </Button>
            <h2 className="text-2xl font-bold font-headline mb-2 text-center">
                Vamos a seleccionar las mejores fotos de tu {selectedBrand} {selectedModel}
            </h2>
            <p className="text-center text-muted-foreground mb-6">
                Sube entre 4 y 12 fotos. Selecciona una como la foto principal.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                {photos.map((photo, index) => (
                    <div
                        key={index}
                        className="relative aspect-square group"
                        onClick={() => setMainPhotoIndex(index)}
                    >
                        <Image
                            src={photo.previewUrl}
                            alt={`Foto del vehículo ${index + 1}`}
                            fill
                            className="object-cover rounded-md cursor-pointer"
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                            className="absolute top-1 right-1 z-10 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Eliminar foto"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {mainPhotoIndex === index && (
                            <>
                                <div className="absolute inset-0 rounded-md ring-4 ring-primary pointer-events-none" />
                                <div className="absolute bottom-0 w-full bg-primary text-primary-foreground text-center text-xs py-1 pointer-events-none rounded-b-md">
                                    Foto principal
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {photos.length < 12 && (
                    <Label htmlFor="photo-upload" className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-muted transition-colors">
                        <UploadCloud className="h-10 w-10 text-muted-foreground" />
                        <span className="mt-2 text-sm text-muted-foreground">Subir fotos</span>
                        <input id="photo-upload" type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                    </Label>
                )}
            </div>

            <div className="flex justify-end mt-8 items-center gap-4">
                {isPublishing && uploadProgress !== null && (
                    <div className="w-full max-w-xs text-right">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-sm text-muted-foreground mt-1">Subiendo fotos... {uploadProgress.toFixed(0)}%</p>
                    </div>
                )}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="lg" disabled={photos.length < 4 || isPublishing}>
                            {`Publicar Anuncio (${photos.length < 4 ? '4 fotos mín.' : `${photos.length}/12`})`}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="text-amber-500" />
                                Confirmación Final
                            </AlertDialogTitle>
                            <AlertDialogDescription className="pt-2">
                                Al publicar, confirmas que el precio y las características del vehículo son reales.
                                Cualquier información falsa o engañosa, especialmente en el precio, resultará en la <strong>suspensión permanente de tu cuenta</strong>.
                                Esta es una comunidad basada en la confianza.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Volver a Editar</AlertDialogCancel>
                            <AlertDialogAction onClick={handlePublish} disabled={isPublishing}>
                                {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isPublishing ? 'Publicando...' : 'Confirmar y Publicar'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );

    if (isUserLoading || areListingsLoading || isProfileLoading) {
        return (
            <div className="container max-w-5xl mx-auto py-12">
                <div className="flex justify-center items-center min-h-[50vh]">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    const isVerified = (profileData as any)?.isVerified || false;
    if (!isVerified && !isAdmin) {
        return (
            <div className="container max-w-3xl mx-auto py-12">
                <Card className="p-8 text-center">
                    <Phone className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <h1 className="font-headline text-3xl font-bold">Verificación de Teléfono Requerida</h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Para poder publicar un anuncio, primero debes verificar tu número de teléfono.
                    </p>
                    <p className="mt-2 text-muted-foreground">
                        Esto nos ayuda a mantener una comunidad segura y confiable para todos, evitando el spam y los perfiles falsos.
                    </p>
                    <Button asChild className="mt-8" size="lg">
                        <Link href="/profile">Verificar mi Teléfono</Link>
                    </Button>
                </Card>
            </div>
        );
    }

    if (limitReached && !areListingsLoading) {
        return (
            <div className="container max-w-3xl mx-auto py-12">
                <Card className="p-8 text-center">
                    <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <h1 className="font-headline text-3xl font-bold">Límite de Publicaciones Alcanzado</h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Tu plan <strong>{currentPlanName}</strong> permite hasta <strong>{LISTING_LIMIT}</strong> publicaciones simultáneas.
                        Actualmente tienes <strong>{currentListingCount}</strong>.
                    </p>
                    <p className="mt-2 text-muted-foreground">
                        Para publicar un nuevo vehículo, puedes eliminar una publicación existente o mejorar tu plan.
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild size="lg">
                            <Link href="/pricing">Mejorar mi Plan</Link>
                        </Button>
                        <Button asChild variant="outline" size="lg">
                            <Link href="/profile/listings">Gestionar Publicaciones</Link>
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="container max-w-5xl mx-auto py-12">
            {step === 'selection' && renderSelectionStep()}
            {step === 'details' && renderDetailsStep()}
            {step === 'location' && renderLocationStep()}
            {step === 'photos' && renderPhotosStep()}
        </div>
    );
}

    