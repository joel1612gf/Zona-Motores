'use client';

import { useState } from 'react';
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

const vehicleFeatures = ["Apple CarPlay", "Android Auto", "4x4", "Leather Seats", "Sunroof", "7-Seater", "Upgraded Suspension", "Winch"];

const listingFormSchema = z.object({
  make: z.string().min(2, { message: "Make must be at least 2 characters." }),
  model: z.string().min(1, { message: "Model is required." }),
  year: z.coerce.number().min(1900, "Invalid year.").max(new Date().getFullYear() + 1, "Invalid year."),
  mileage: z.coerce.number().min(0, "Mileage cannot be negative."),
  priceUSD: z.coerce.number().min(1, "Price must be at least $1."),
  bodyType: z.string().min(1, "Body type is required."),
  exteriorColor: z.string().min(2, "Color is required."),
  interiorColor: z.string().min(2, "Color is required."),
  description: z.string().min(20, { message: "Description must be at least 20 characters." }).max(500, "Description is too long."),
  summary: z.string().optional(),
  features: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one feature.',
  }).optional(),
  images: z.any().refine((files) => files?.length >= 1, 'At least one image is required.'),
});

type ListingFormValues = z.infer<typeof listingFormSchema>;

export default function NewListingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [compressedImages, setCompressedImages] = useState<string[]>([]);
  
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
          title: "Image Compression Failed",
          description: "Could not compress one of the images. Please try another file.",
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
        title: "Description too short",
        description: "Please provide a more detailed description before generating a summary.",
        variant: "destructive",
      });
      setIsSummarizing(false);
      return;
    }
    
    try {
      const result = await summarizeVehicleListing(values as SummarizeVehicleListingInput);
      form.setValue('summary', result.summary);
      toast({
        title: "Summary Generated!",
        description: "The AI-powered summary has been added to your listing.",
      });
    } catch (error) {
      console.error('AI summary generation failed:', error);
      toast({
        title: "AI Summary Failed",
        description: "We couldn't generate a summary at this time. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  function onSubmit(data: ListingFormValues) {
    console.log({ ...data, images: compressedImages });
    toast({
      title: "Listing Submitted! (Demo)",
      description: "In a real app, you would be redirected to your new listing.",
    });
    // In a real app, you would redirect to the new listing page, e.g., router.push(`/listings/new-id`)
    setTimeout(() => {
        router.push('/listings');
    }, 1500)
  }

  return (
    <div className="container max-w-4xl mx-auto py-12">
      <h1 className="font-headline text-3xl font-bold mb-8">Create a New Vehicle Listing</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Vehicle Details</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="make" render={({ field }) => (
                <FormItem><FormLabel>Make</FormLabel><FormControl><Input placeholder="e.g., Toyota" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="e.g., Corolla" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="year" render={({ field }) => (
                <FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" placeholder="e.g., 2021" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mileage" render={({ field }) => (
                <FormItem><FormLabel>Mileage (km)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="priceUSD" render={({ field }) => (
                <FormItem><FormLabel>Price (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bodyType" render={({ field }) => (
                <FormItem><FormLabel>Body Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a body type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Sedan">Sedan</SelectItem><SelectItem value="SUV">SUV</SelectItem><SelectItem value="Truck">Truck</SelectItem><SelectItem value="Hatchback">Hatchback</SelectItem><SelectItem value="Coupe">Coupe</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="exteriorColor" render={({ field }) => (
                <FormItem><FormLabel>Exterior Color</FormLabel><FormControl><Input placeholder="e.g., Pearl White" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="interiorColor" render={({ field }) => (
                <FormItem><FormLabel>Interior Color</FormLabel><FormControl><Input placeholder="e.g., Black Leather" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Features</CardTitle></CardHeader>
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
            <CardHeader><CardTitle>Description & Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Seller's Description</FormLabel>
                  <FormControl><Textarea placeholder="Tell us about your vehicle..." className="min-h-[120px]" {...field} /></FormControl>
                  <FormDescription>Be detailed! This information will be used to generate the AI summary.</FormDescription><FormMessage />
                </FormItem>
              )} />
              <Button type="button" variant="secondary" onClick={handleGenerateSummary} disabled={isSummarizing}>
                {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate AI Summary
              </Button>
              <FormField control={form.control} name="summary" render={({ field }) => (
                <FormItem>
                  <FormLabel>AI-Generated Summary (optional)</FormLabel>
                  <FormControl><Textarea placeholder="AI summary will appear here..." className="min-h-[100px] bg-muted" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Upload Images</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="images" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle Photos</FormLabel>
                  <FormControl><Input type="file" accept="image/*" multiple onChange={handleImageChange} /></FormControl>
                  <FormDescription>Upload up to 5 images. They will be compressed to WebP format (max 1200px wide).</FormDescription><FormMessage />
                </FormItem>
              )} />
              {compressedImages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {compressedImages.map((src, index) => (
                    <Image key={index} src={src} alt={`Compressed preview ${index + 1}`} width={200} height={150} className="rounded-md object-cover" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Listing
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
