'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/context/admin-auth-context';
import { ADMIN_ROLE_LABELS } from '@/lib/admin-types';
import {
  LayoutDashboard,
  Store,
  Building2,
  Users,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';

type AdminNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly: boolean;
};

const NAV_ITEMS: AdminNavItem[] = [
  { label: 'Visión General', href: '/admin/dashboard', icon: LayoutDashboard, ownerOnly: true },
  { label: 'Marketplace', href: '/admin/marketplace', icon: Store, ownerOnly: false },
  { label: 'Concesionarios', href: '/admin/dealerships', icon: Building2, ownerOnly: true },
  { label: 'Equipo Admin', href: '/admin/team', icon: Users, ownerOnly: true },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isOwner, signOut } = useAdminAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/admin/login');
  };

  const sidebarContent = (
    <div
      className={cn(
        'flex flex-col h-full bg-card border-r transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 p-4 border-b min-h-[64px]">
        <div className="h-9 w-9 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-semibold text-sm truncate">Zona Motores</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">God-Mode</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Admin info & actions */}
      <div className="mt-auto border-t p-3 space-y-2">
        {user && !collapsed && (
          <div className="px-2 py-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground">{role ? ADMIN_ROLE_LABELS[role] : ''}</p>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start gap-2 text-destructive hover:text-destructive', collapsed && 'justify-center px-0')}
          onClick={handleSignOut}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center hidden md:flex"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-40 md:sticky md:top-0 md:h-screen md:z-auto transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
