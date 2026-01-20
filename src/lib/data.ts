import type { Vehicle, Seller, ImageInfo } from './types';
import { PlaceHolderImages } from './placeholder-images';

const sellers: Record<string, Seller> = {
  seller1: { id: 'seller1', name: 'Juan Perez', isVerified: true, phone: '+584141234567' },
  seller2: { id: 'seller2', name: 'Maria Rodriguez', isVerified: false, phone: '+584129876543' },
  seller3: { id: 'seller3', name: 'Carlos Gomez', isVerified: true, phone: '+584241122334' },
};

const getImage = (id: string): ImageInfo => {
    const img = PlaceHolderImages.find(p => p.id === id);
    if (!img) return { url: 'https://picsum.photos/seed/default/800/600', alt: 'Placeholder', hint: 'image' };
    return { url: img.imageUrl, alt: img.description, hint: img.imageHint };
}

export const vehicles: Vehicle[] = [
  {
    id: '1',
    make: 'Toyota',
    model: 'Corolla',
    year: 2021,
    priceUSD: 22000,
    mileage: 15000,
    bodyType: 'Sedan',
    exteriorColor: 'White',
    interiorColor: 'Black',
    transmission: 'Automatic',
    engine: '1.8L 4-Cylinder',
    location: { city: 'Caracas', state: 'Distrito Capital', lat: 10.4806, lon: -66.9036 },
    features: ['Apple CarPlay', 'Android Auto', 'Blind Spot Monitor', 'Sunroof'],
    description: 'Impeccable Toyota Corolla, like new. Single owner, all services done at the dealership. A reliable and economical car for the city.',
    images: [
      getImage('corolla-main'),
      getImage('corolla-interior'),
      getImage('corolla-side'),
    ],
    seller: sellers.seller1,
  },
  {
    id: '2',
    make: 'Toyota',
    model: 'Fortuner',
    year: 2022,
    priceUSD: 55000,
    mileage: 5000,
    bodyType: 'SUV',
    exteriorColor: 'Silver',
    interiorColor: 'Brown',
    transmission: 'Automatic',
    engine: '4.0L V6',
    location: { city: 'Maracaibo', state: 'Zulia', lat: 10.6421, lon: -71.6125 },
    features: ['4x4', 'Leather Seats', '7-Seater', '360 Camera', 'Parking Sensors'],
    description: 'Powerful and luxurious Toyota Fortuner 4x4. Perfect for family and adventure. Very low mileage, practically brand new. Ready for any terrain.',
    images: [
      getImage('fortuner-main'),
      getImage('fortuner-interior'),
    ],
    seller: sellers.seller2,
  },
  {
    id: '3',
    make: 'Toyota',
    model: 'Land Cruiser',
    year: 2018,
    priceUSD: 45000,
    mileage: 80000,
    bodyType: 'Truck',
    exteriorColor: 'Beige',
    interiorColor: 'Gray',
    transmission: 'Manual',
    engine: '4.5L V8 Diesel',
    location: { city: 'Valencia', state: 'Carabobo', lat: 10.162, lon: -68.0076 },
    features: ['4x4', 'Snorkel', 'Winch', 'Roof Rack', 'Upgraded Suspension'],
    description: 'The legendary "Machito". A beast prepared for the most demanding off-road. Many extras included. A true workhorse that never quits.',
    images: [
      getImage('machito-main'),
    ],
    seller: sellers.seller3,
  },
  {
    id: '4',
    make: 'Jeep',
    model: 'Grand Cherokee',
    year: 2020,
    priceUSD: 48000,
    mileage: 35000,
    bodyType: 'SUV',
    exteriorColor: 'Black',
    interiorColor: 'Black',
    transmission: 'Automatic',
    engine: '3.6L V6',
    location: { city: 'Caracas', state: 'Distrito Capital', lat: 10.5000, lon: -66.9167 },
    features: ['Limited Trim', 'Sunroof', 'Leather Seats', 'Uconnect 8.4-inch screen'],
    description: 'Elegant and capable Jeep Grand Cherokee Limited. A perfect combination of luxury and off-road capability. Excellent condition.',
    images: [
      getImage('cherokee-main'),
    ],
    seller: sellers.seller1,
  },
  {
    id: '5',
    make: 'Hyundai',
    model: 'Elantra',
    year: 2019,
    priceUSD: 16000,
    mileage: 55000,
    bodyType: 'Sedan',
    exteriorColor: 'Blue',
    interiorColor: 'Beige',
    transmission: 'Automatic',
    engine: '2.0L 4-Cylinder',
    location: { city: 'Barquisimeto', state: 'Lara', lat: 10.0678, lon: -69.3572 },
    features: ['Rearview Camera', 'Bluetooth', 'Cruise Control'],
    description: 'Modern and efficient Hyundai Elantra. Ideal for daily use. Spacious and comfortable, with low fuel consumption.',
    images: [
      getImage('elantra-main'),
    ],
    seller: sellers.seller2,
  },
];
