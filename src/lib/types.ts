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
  transmission: 'Automática' | 'Sincrónica';
  engine: string;
  exteriorColor: string;
  interiorColor: string;
  doorCount?: '2' | '4';
  is4x4?: boolean;
  ownerCount: number;
  tireLife: number;
  
  hasAC: boolean;
  hasSoundSystem: boolean;
  
  hadMajorCrash: boolean;
  isOperational: boolean;
  operationalDetails?: string;

  isSignatory: boolean;

  acceptsTradeIn: boolean;
  tradeInDetails?: string;
  tradeInForHigherValue?: boolean;
  tradeInForLowerValue?: boolean;

  description: string;
  images: ImageInfo[];
  seller: Seller;
  location: {
    city: string;
    state: string;
    lat: number;
    lon: number;
  };
};
