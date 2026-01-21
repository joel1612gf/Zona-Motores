'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { summarizeVehicleListing, type SummarizeVehicleListingInput } from '@/ai/flows/summarize-vehicle-listing';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import { useUser } from '@/firebase';

const vehicleFeatures = ["Apple CarPlay", "Android Auto", "4x4", "Asientos de Cuero", "Techo Corredizo", "7 Puestos", "Suspensión Mejorada", "Winch"];

const listingFormSchema = z.object({
  make: z.string().min(2, { message: "La marca debe tener al menos 2 caracteres." }),
  model: z.string().min(1, { message: "El modelo es requerido." }),
  year: z.coerce.number().min(1900, "Año inválido.").max(new Date().getFullYear() + 1, "Año inválido."),
  mileage: z.coerce.number().min(0, "El kilometraje no puede ser negativo."),
  priceUSD: z.coerce.number().min(1, "El precio debe ser al menos $1."),
  bodyType: z.string().min(1, "El tipo de carrocería es requerido."),
  exteriorColor: z.string().min(2, "El color es requerido."),
  interiorColor: z.string().min(2, "El color es requerido."),
  description: z.string().min(20, { message: "La descripción debe tener al menos 20 caracteres." }).max(500, "La descripción es muy larga."),
  summary: z.string().optional(),
  features: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'Debes seleccionar al menos una característica.',
  }).optional(),
  images: z.any().refine((files) => files?.length >= 1, 'Se requiere al menos una imagen.'),
});

type ListingFormValues = z.infer<typeof listingFormSchema>;

export default function NewListingPage() {
  const { toast } = useToast();
  const router = useRouter();
  // const { user, loading: userLoading } = useUser();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [compressedImages, setCompressedImages] = useState<string[]>([]);
  
  /*
  useEffect(() => {
    if (!userLoading && !user) {
      toast({
        title: "Acceso Denegado",
        description: "Debes iniciar sesión para publicar un anuncio.",
        variant: "destructive",
      });
      router.push('/');
    }
  }, [user, userLoading, router, toast]);
  */

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      make: '',
      model: '',
      year: new Date().getFullYear(),
      mileage: 0,
      priceUSD: 10000,
      bodyType: '',
      exteriorColor: '',
      interiorColor: '',
      description: '',
      features: [],
    },
  });

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const compressed: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const compressedImage = await compressImage(file);
        compressed.push(compressedImage);
      } catch (error) {
        toast({
          title: "Falló la Compresión de Imagen",
          description: "No se pudo comprimir una de las imágenes. Por favor, intenta con otro archivo.",
          variant: "destructive",
        });
        console.error(error);
      }
    }
    setCompressedImages(compressed);
    form.setValue('images', compressed);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Could not get canvas context');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', 0.8));
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    const values: Partial<ListingFormValues> = form.getValues();

    if ((values.description?.length || 0) < 20) {
      toast({
        title: "Descripción muy corta",
        description: "Por favor, proporciona una descripción más detallada antes de generar un resumen.",
        variant: "destructive",
      });
      setIsSummarizing(false);
      return;
    }
    
    try {
      const result = await summarizeVehicleListing(values as SummarizeVehicleListingInput);
      form.setValue('summary', result.summary);
      toast({
        title: "¡Resumen Generado!",
        description: "El resumen generado por IA ha sido agregado a tu anuncio.",
      });
    } catch (error) {
      console.error('AI summary generation failed:', error);
      toast({
        title: "Falló el Resumen con IA",
        description: "No pudimos generar un resumen en este momento. Por favor, inténtalo de nuevo más tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  function onSubmit(data: ListingFormValues) {
    console.log({ ...data, images: compressedImages });
    toast({
      title: "¡Anuncio Enviado! (Demo)",
      description: "En una aplicación real, serías redirigido a tu nuevo anuncio.",
    });
    // In a real app, you would redirect to the new listing page, e.g., router.push(`/listings/new-id`)
    setTimeout(() => {
        router.push('/listings');
    }, 1500)
  }

  /*
  if (userLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
  */

  return (
    <div className="container max-w-4xl mx-auto py-12">
      <h1 className="font-headline text-3xl font-bold mb-8">Crear un Nuevo Anuncio de Vehículo</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Detalles del Vehículo</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="make" render={({ field }) => (
                <FormItem><FormLabel>Marca</FormLabel><FormControl><Input placeholder="Ej: Toyota" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input placeholder="Ej: Corolla" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="year" render={({ field }) => (
                <FormItem><FormLabel>Año</FormLabel><FormControl><Input type="number" placeholder="Ej: 2021" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mileage" render={({ field }) => (
                <FormItem><FormLabel>Kilometraje (km)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="priceUSD" render={({ field }) => (
                <FormItem><FormLabel>Precio (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bodyType" render={({ field }) => (
                <FormItem><FormLabel>Tipo de Carrocería</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo de carrocería" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Sedan">Sedán</SelectItem><SelectItem value="SUV">SUV</SelectItem><SelectItem value="Truck">Camioneta</SelectItem><SelectItem value="Hatchback">Hatchback</SelectItem><SelectItem value="Coupe">Cupé</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="exteriorColor" render={({ field }) => (
                <FormItem><FormLabel>Color Exterior</FormLabel><FormControl><Input placeholder="Ej: Blanco Perla" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="interiorColor" render={({ field }) => (
                <FormItem><FormLabel>Color Interior</FormLabel><FormControl><Input placeholder="Ej: Cuero Negro" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Características</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="features" render={() => (
                <FormItem>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {vehicleFeatures.map((item) => (
                      <FormField key={item} control={form.control} name="features" render={({ field }) => (
                        <FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => {
                              return checked ? field.onChange([...(field.value || []), item]) : field.onChange(field.value?.filter((value) => value !== item));
                            }} /></FormControl>
                          <FormLabel className="font-normal">{item}</FormLabel>
                        </FormItem>
                      )} />
                    ))}
                  </div><FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Descripción y Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del Vendedor</FormLabel>
                  <FormControl><Textarea placeholder="Cuéntanos sobre tu vehículo..." className="min-h-[120px]" {...field} /></FormControl>
                  <FormDescription>¡Sé detallado! Esta información se usará para generar el resumen con IA.</FormDescription><FormMessage />
                </FormItem>
              )} />
              <Button type="button" variant="secondary" onClick={handleGenerateSummary} disabled={isSummarizing}>
                {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generar Resumen con IA
              </Button>
              <FormField control={form.control} name="summary" render={({ field }) => (
                <FormItem>
                  <FormLabel>Resumen Generado por IA (opcional)</FormLabel>
                  <FormControl><Textarea placeholder="El resumen de la IA aparecerá aquí..." className="min-h-[100px] bg-muted" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Subir Imágenes</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="images" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fotos del Vehículo</FormLabel>
                  <FormControl><Input type="file" accept="image/*" multiple onChange={handleImageChange} /></FormControl>
                  <FormDescription>Sube hasta 5 imágenes. Se comprimirán a formato WebP (máximo 1200px de ancho).</FormDescription><FormMessage />
                </FormItem>
              )} />
              {compressedImages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {compressedImages.map((src, index) => (
                    <Image key={index} src={src} alt={`Vista previa comprimida ${index + 1}`} width={200} height={150} className="rounded-md object-cover" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Anuncio
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
