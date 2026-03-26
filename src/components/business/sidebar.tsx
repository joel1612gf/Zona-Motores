'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { BusinessModule } from '@/lib/business-types';
import { ROLE_LABELS } from '@/lib/business-types';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCog,
  Settings,
  Wallet,
  Handshake,
  Globe,
  Award,
  LogOut,
  UserRound,
  ChevronLeft,
  ChevronRight,
  Menu,
  CalendarDays,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

type SidebarItem = {
  module: BusinessModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

function getSidebarItems(slug: string): SidebarItem[] {
  return [
    { module: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: `/business/${slug}/dashboard` },
    { module: 'inventory', label: 'Inventario', icon: Package, href: `/business/${slug}/inventory` },
    { module: 'sales', label: 'Ventas', icon: ShoppingCart, href: `/business/${slug}/sales` },
    { module: 'clients', label: 'Clientes', icon: Users, href: `/business/${slug}/clients` },
    { module: 'consignment', label: 'Consignación', icon: Handshake, href: `/business/${slug}/consignment` },
    { module: 'calendar', label: 'Calendario', icon: CalendarDays, href: `/business/${slug}/calendar` },
    { module: 'staff', label: 'Personal', icon: UserCog, href: `/business/${slug}/staff` },
    { module: 'commissions', label: 'Comisiones', icon: Award, href: `/business/${slug}/commissions` },
    { module: 'cash_register', label: 'Caja', icon: Wallet, href: `/business/${slug}/cash-register` },
    { module: 'web_sync', label: 'Web Pública', icon: Globe, href: `/business/${slug}/web-sync` },
    { module: 'settings', label: 'Configuración', icon: Settings, href: `/business/${slug}/settings` },
  ];
}

export function BusinessSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { concesionario, staff, hasPermission, switchUser, logout, currentRole } = useBusinessAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = getSidebarItems(slug);
  const visibleItems = items.filter(item => hasPermission(item.module) !== false);

  const sidebarContent = (
    <div className={cn(
      "flex flex-col h-full bg-card border-r transition-all duration-300",
      collapsed ? "w-[68px]" : "w-64"
    )}>
      {/* Logo & company name */}
      <div className="flex items-center gap-3 p-4 border-b min-h-[64px]">
        {concesionario?.logo_url ? (
          <div className="relative h-9 w-9 rounded-lg overflow-hidden shrink-0 bg-muted">
            <Image src={concesionario.logo_url} alt="" fill className="object-cover" />
          </div>
        ) : (
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
        )}
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-semibold text-sm truncate">{concesionario?.nombre_empresa || 'Empresa'}</p>
            <p className="text-xs text-muted-foreground truncate">Zona Motores Business</p>
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
              key={item.module}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Staff info & actions */}
      <div className="mt-auto border-t p-3 space-y-2">
        {staff && !collapsed && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {staff.foto_url ? (
                <Image src={staff.foto_url} alt="" width={32} height={32} className="rounded-full object-cover" />
              ) : (
                <UserRound className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{staff.nombre}</p>
              <p className="text-xs text-muted-foreground">{currentRole ? ROLE_LABELS[currentRole] : ''}</p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full justify-start gap-2 text-muted-foreground", collapsed && "justify-center px-0")}
          onClick={switchUser}
          title="Cambiar de usuario"
        >
          <UserRound className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cambiar Usuario</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full justify-start gap-2 text-destructive hover:text-destructive", collapsed && "justify-center px-0")}
          onClick={logout}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center hidden md:flex mt-auto pt-2"
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
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-40 md:sticky md:top-0 md:h-screen md:z-auto transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}
