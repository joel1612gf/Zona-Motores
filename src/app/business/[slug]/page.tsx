'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function BusinessSlugPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  useEffect(() => {
    router.replace(`/business/${slug}/login`);
  }, [slug, router]);

  return null;
}
