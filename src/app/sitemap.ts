import { MetadataRoute } from 'next'
import { vehicles } from '@/lib/data';
import { UserProfile } from '@/lib/types';
 
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zonamotores.ve';

// Function to get unique dealership IDs from the static vehicle data
const getUniqueDealershipIds = (): string[] => {
    const dealershipIds = new Set<string>();
    vehicles.forEach(vehicle => {
        if (vehicle.seller.accountType === 'dealer') {
            dealershipIds.add(vehicle.seller.uid);
        }
    });
    return Array.from(dealershipIds);
}
 
export default function sitemap(): MetadataRoute.Sitemap {
  const vehicleUrls = vehicles.map((vehicle) => ({
    url: `${siteUrl}/listings/${vehicle.id}`,
    lastModified: vehicle.createdAt ? vehicle.createdAt.toDate() : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const dealershipUrls = getUniqueDealershipIds().map(id => ({
    url: `${siteUrl}/dealerships/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const staticPages = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/listings`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/dealerships`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
        url: `${siteUrl}/pricing`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
    }
  ];

  return [
    ...staticPages,
    ...dealershipUrls,
    ...vehicleUrls,
  ]
}
