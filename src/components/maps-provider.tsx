'use client';

import { ReactNode } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

export function MapsProvider({ children }: { children: ReactNode }) {
    return (
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
            {children}
        </APIProvider>
    );
}
