export type Seller = {
  id: string;
  name: string;
  isVerified: boolean;
  phone: string;
};

export type ImageInfo = {
  url: string;
  alt: string;
  hint?: string;
};

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  priceUSD: number;
  mileage: number;
  bodyType: string;
  exteriorColor: string;
  interiorColor: string;
  transmission: 'Automatic' | 'Manual';
  engine: string;
  location: {
    city: string;
    state: string;
    lat: number;
    lon: number;
  };
  features: string[];
  description: string;
  images: ImageInfo[];
  seller: Seller;
};
