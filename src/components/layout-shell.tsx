'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import type { ReactNode } from 'react';

export function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Business (SaaS) and Admin (God-Mode) are standalone surfaces that bring
  // their own chrome — they must NOT render the public site header/footer.
  const isStandaloneRoute = pathname.startsWith('/business') || pathname.startsWith('/admin');

  if (isStandaloneRoute) {
    return <>{children}</>;
  }

  // Consumer-facing routes get the standard layout
  return (
    <div className="relative flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 overflow-x-hidden">{children}</main>
      <SiteFooter />
    </div>
  );
}
