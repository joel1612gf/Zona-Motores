'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/context/admin-auth-context';

/**
 * /admin entrypoint. Owners land on the analytics dashboard; moderators (who
 * cannot see the dashboard) are sent to the marketplace moderation view.
 */
export default function AdminIndexPage() {
  const router = useRouter();
  const { isOwner } = useAdminAuth();

  useEffect(() => {
    router.replace(isOwner ? '/admin/dashboard' : '/admin/marketplace');
  }, [isOwner, router]);

  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
