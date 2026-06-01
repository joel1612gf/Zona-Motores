'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { BusinessAuthProvider, useBusinessAuth } from '@/context/business-auth-context';
import { BusinessSidebar } from '@/components/business/sidebar';
import { Loader2 } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

function BusinessLayoutInner({ children, slug }: { children: ReactNode; slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated, isStaffLoggedIn, concesionario } = useBusinessAuth();

  const isLoginPage = pathname === `/business/${slug}/login`;
  const isStaffLoginPage = pathname === `/business/${slug}/staff-login`;
  const isOnboardingPage = pathname === `/business/${slug}/onboarding`;

  useEffect(() => {
    if (isLoading) return;

    // If concesionario doesn't exist, show 404 (handled by login page)
    if (!concesionario && !isLoginPage && !isOnboardingPage) {
      router.replace(`/business/${slug}/login`);
      return;
    }

    // Onboarding gate (runs BEFORE auth gates). A blank tenant created from /admin
    // has onboarding_completado === false: force the client into the wizard,
    // skipping the master-key login. Legacy tenants (undefined) are never affected.
    if (concesionario?.onboarding_completado === false && !isOnboardingPage) {
      router.replace(`/business/${slug}/onboarding`);
      return;
    }

    // Already configured but trying to re-open the wizard → bounce out.
    if (concesionario && concesionario.onboarding_completado !== false && isOnboardingPage) {
      router.replace(`/business/${slug}/login`);
      return;
    }

    // If not authenticated (step 1), redirect to login
    if (!isAuthenticated && !isLoginPage && !isOnboardingPage) {
      router.replace(`/business/${slug}/login`);
      return;
    }

    // If authenticated but staff not logged in (step 2), redirect to staff login
    if (isAuthenticated && !isStaffLoggedIn && !isStaffLoginPage && !isLoginPage && !isOnboardingPage) {
      router.replace(`/business/${slug}/staff-login`);
      return;
    }

    // If fully logged in and on login/staff-login pages, redirect to dashboard
    if (isAuthenticated && isStaffLoggedIn && (isLoginPage || isStaffLoginPage)) {
      router.replace(`/business/${slug}/dashboard`);
      return;
    }

    // If authenticated but on login page, redirect to staff-login
    if (isAuthenticated && !isStaffLoggedIn && isLoginPage) {
      router.replace(`/business/${slug}/staff-login`);
      return;
    }
  }, [isLoading, isAuthenticated, isStaffLoggedIn, isLoginPage, isStaffLoginPage, isOnboardingPage, router, slug, concesionario]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Login, staff-login and onboarding pages render full-screen without sidebar
  if (isLoginPage || isStaffLoginPage || isOnboardingPage) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  // Main app layout with sidebar
  return (
    <div className="flex min-h-screen bg-background">
      <BusinessSidebar slug={slug} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

import { CartProvider } from '@/context/cart-context';
import { FloatingCart } from '@/components/business/floating-cart';

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <BusinessAuthProvider slug={slug}>
      <CartProvider>
        <BusinessLayoutInner slug={slug}>
          {children}
        </BusinessLayoutInner>
        {/* Renderizamos el carrito flotante de forma global para el SaaS (no se mostrará en login porque ahí los items estarán en 0 o no hay concesionario) */}
        <FloatingCart />
      </CartProvider>
    </BusinessAuthProvider>
  );
}
