import type { Vehicle, UserProfile, ImageInfo } from './types';
import { PlaceHolderImages } from './placeholder-images';
import { Timestamp } from 'firebase/firestore';

const userProfiles: Record<string, UserProfile> = {};

const getImage = (id: string): ImageInfo => {
    const img = PlaceHolderImages.find(p => p.id === id);
    if (!img) return { url: 'https://picsum.photos/seed/default/800/600', alt: 'Placeholder', hint: 'image' };
    return { url: img.imageUrl, alt: img.description, hint: img.imageHint };
}

// Generate static, predictable timestamps to avoid hydration errors.
const baseDate = new Date('2024-07-01T12:00:00Z');
const staticTimestamps = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(baseDate);
    d.setHours(baseDate.getHours() - i * 2); // Stagger creation times by 2 hours
    return Timestamp.fromDate(d);
});


export const vehicles: Vehicle[] = [];
