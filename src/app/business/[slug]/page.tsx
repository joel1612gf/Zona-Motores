'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useBusinessAuth } from '@/context/business-auth-context';

export default function BusinessSlugPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { concesionario, isLoading } = useBusinessAuth();

  useEffect(() => {
    if (isLoading) return;
    // Blank tenant → straight to the wizard; otherwise the login flow (the
    // layout gate then handles staff-login / dashboard for authenticated users).
    if (concesionario?.onboarding_completado === false) {
      router.replace(`/business/${slug}/onboarding`);
    } else {
      router.replace(`/business/${slug}/login`);
    }
  }, [isLoading, concesionario, slug, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
