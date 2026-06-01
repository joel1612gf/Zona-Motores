'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/context/admin-auth-context';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { useToast } from '@/hooks/use-toast';

const LOGIN_PATH = '/admin/login';

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { status, signOut } = useAdminAuth();

  const isLoginPage = pathname === LOGIN_PATH;
  // Guard against firing the "unauthorized" side-effects more than once.
  const kickedOut = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      if (!isLoginPage) router.replace(LOGIN_PATH);
      return;
    }

    if (status === 'unauthorized') {
      if (kickedOut.current) return;
      kickedOut.current = true;
      toast({
        title: 'Acceso no autorizado',
        description: 'Tu cuenta no tiene permisos de administrador.',
        variant: 'destructive',
      });
      void signOut();
      router.replace('/');
      return;
    }

    // authorized
    if (isLoginPage) router.replace('/admin/dashboard');
  }, [status, isLoginPage, router, signOut, toast]);

  // Full-screen loader while resolving auth / during redirects.
  if (status === 'loading' || (status === 'unauthenticated' && !isLoginPage) || status === 'unauthorized') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  // Login page renders without the sidebar.
  if (isLoginPage) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  // Authorized app shell.
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
