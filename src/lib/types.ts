import type { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  uid: string;
  displayName: string;
  isVerified: boolean;
  phone?: string;
  accountType?: 'personal' | 'dealer';
  logoUrl?: string;
  heroUrl?: string;
  address?: string;
  isBlocked?: boolean;
};

export type ImageInfo = {
  url: string;
  alt: string;
  hint?: string;
};

export type Vehicle = {
  id: string;
  sellerId: string;
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
  isArmored?: boolean;
  armorLevel?: number;
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
  createdAt: Timestamp;
  status?: 'active' | 'paused' | 'sold';
  viewCount?: number;
  contactRequests?: number;
  marketplaceUrl?: string;
  promotionExpiresAt?: Timestamp;
};

export type PlanTier = 'basico' | 'pro' | 'ultra';

export type UserSubscription = {
  plan: PlanTier;
  activatedAt?: Timestamp;
  contactsUsedThisMonth: number;
  contactsResetMonth: number;
  promotionsUsedThisMonth: number;
  promotionsResetMonth: number;
};

export type PlanLimits = {
  maxListings: number;
  maxContactsPerMonth: number; // -1 = unlimited
  maxPromotionsPerMonth: number;
  promotionDays: number;
  hasStats: boolean;
  hasAdvancedStats: boolean;
  hasDealerProfile: boolean;
  extraPromotionDiscount: number; // percentage, e.g. 50
};

export const PLAN_CONFIG: Record<PlanTier, { name: string; price: number; limits: PlanLimits }> = {
  basico: {
    name: 'Básico',
    price: 0,
    limits: {
      maxListings: 2,
      maxContactsPerMonth: 50,
      maxPromotionsPerMonth: 0,
      promotionDays: 0,
      hasStats: false,
      hasAdvancedStats: false,
      hasDealerProfile: false,
      extraPromotionDiscount: 0,
    },
  },
  pro: {
    name: 'Pro',
    price: 3.99,
    limits: {
      maxListings: 5,
      maxContactsPerMonth: 100,
      maxPromotionsPerMonth: 1,
      promotionDays: 7,
      hasStats: true,
      hasAdvancedStats: false,
      hasDealerProfile: false,
      extraPromotionDiscount: 0,
    },
  },
  ultra: {
    name: 'Ultra',
    price: 7.99,
    limits: {
      maxListings: 20,
      maxContactsPerMonth: -1,
      maxPromotionsPerMonth: 5,
      promotionDays: 7,
      hasStats: true,
      hasAdvancedStats: true,
      hasDealerProfile: true,
      extraPromotionDiscount: 50,
    },
  },
};
