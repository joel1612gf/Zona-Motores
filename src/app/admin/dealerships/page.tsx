'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useAdminAuth } from '@/context/admin-auth-context';
import type { Concesionario } from '@/lib/business-types';
import { DealershipsTable } from '@/components/admin/dealerships-table';
import { EditPriceDialog } from '@/components/admin/edit-price-dialog';
import { DeleteTenantDialog } from '@/components/admin/delete-tenant-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Building2, Search } from 'lucide-react';

type DealerRow = Concesionario & { id: string };

export default function AdminDealershipsPage() {
  const router = useRouter();
  const { isOwner } = useAdminAuth();
  const firestore = useFirestore();

  // Owner-only route (defense in depth — the sidebar already hides it).
  useEffect(() => {
    if (!isOwner) router.replace('/admin/marketplace');
  }, [isOwner, router]);

  const dealersQuery = useMemoFirebase(() => collection(firestore, 'concesionarios'), [firestore]);
  const { data: dealers, isLoading } = useCollection<Concesionario>(dealersQuery);

  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<DealerRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DealerRow | null>(null);

  const filtered = useMemo(() => {
    if (!dealers) return [];
    const term = search.trim().toLowerCase();
    if (!term) return dealers;
    return dealers.filter(
      (d) =>
        d.nombre_empresa.toLowerCase().includes(term) ||
        (d.slug || '').toLowerCase().includes(term) ||
        (d.email || '').toLowerCase().includes(term),
    );
  }, [dealers, search]);

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Concesionarios (SaaS)</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Gestiona los clientes del SaaS: suspende planes, ajusta tarifas o elimina cuentas.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar concesionario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-12"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-[1.5rem]" />
          <Skeleton className="h-16 rounded-[1.5rem]" />
          <Skeleton className="h-16 rounded-[1.5rem]" />
        </div>
      ) : (
        <DealershipsTable dealerships={filtered} onEditPrice={setEditTarget} onDelete={setDeleteTarget} />
      )}

      <EditPriceDialog dealership={editTarget} open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)} />
      <DeleteTenantDialog
        dealership={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      />
    </div>
  );
}
