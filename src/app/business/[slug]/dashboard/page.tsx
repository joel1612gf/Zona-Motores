'use client';

import { useBusinessAuth } from '@/context/business-auth-context';
import { OwnerOverview } from '@/components/business/dashboard/owner-overview';
import { SellerOverview } from '@/components/business/dashboard/seller-overview';
import { CashierOverview } from '@/components/business/dashboard/cashier-overview';
import { SecretaryOverview } from '@/components/business/dashboard/secretary-overview';
import { Loader2 } from 'lucide-react';

export default function BusinessDashboardPage() {
  const { currentRole, isLoading } = useBusinessAuth();

  if (isLoading || !currentRole) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  switch (currentRole) {
    case 'dueno':
      return <OwnerOverview />;
    case 'encargado':
      return <OwnerOverview isReadOnly />;
    case 'vendedor':
      return <SellerOverview />;
    case 'cajero':
      return <CashierOverview />;
    case 'secretario':
      return <SecretaryOverview />;
    default:
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">No tienes acceso a esta sección.</p>
        </div>
      );
  }
}
