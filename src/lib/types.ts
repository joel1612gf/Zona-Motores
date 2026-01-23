export type UserProfile = {
  uid: string;
  displayName: string;
  isVerified: boolean;
  phone?: string;
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
  seller: UserProfile;
  location: {
    city: string;
    state: string;
    lat: number;
    lon: number;
  };
};
