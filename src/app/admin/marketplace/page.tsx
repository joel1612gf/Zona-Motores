'use client';

import { useMemo, useState } from 'react';
import { collection, collectionGroup } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import type { Vehicle } from '@/lib/types';
import type { Concesionario } from '@/lib/business-types';
import { MarketplaceTable } from '@/components/admin/marketplace-table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Search } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'paused' | 'sold';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'paused', label: 'Pausados' },
  { value: 'sold', label: 'Vendidos' },
];

export default function AdminMarketplacePage() {
  const firestore = useFirestore();

  const listingsQuery = useMemoFirebase(() => collectionGroup(firestore, 'vehicleListings'), [firestore]);
  const { data: listings, isLoading } = useCollection<Vehicle>(listingsQuery);

  const dealersQuery = useMemoFirebase(() => collection(firestore, 'concesionarios'), [firestore]);
  const { data: dealers } = useCollection<Concesionario>(dealersQuery);

  const dealerNameByUid = useMemo(() => {
    const m = new Map<string, string>();
    dealers?.forEach((d) => m.set(d.owner_uid, d.nombre_empresa || ''));
    return m;
  }, [dealers]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    if (!listings) return [];
    const term = search.trim().toLowerCase();
    return listings.filter((v) => {
      const matchesStatus = status === 'all' || (v.status ?? 'active') === status;
      const matchesTerm =
        !term ||
        `${v.make} ${v.model}`.toLowerCase().includes(term) ||
        (v.seller?.displayName || '').toLowerCase().includes(term) ||
        (dealerNameByUid.get(v.sellerId) || '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [listings, search, status, dealerNameByUid]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Moderación de Marketplace</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Todas las publicaciones de la web pública. Pausa o elimina las que infrinjan las reglas.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm font-bold">
          {isLoading ? '…' : `${listings?.length ?? 0} publicaciones`}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por vehículo o vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-12"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-muted/40 p-1 rounded-2xl">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={
                'px-4 h-10 rounded-xl text-sm font-medium transition-colors ' +
                (status === f.value ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {f.label}
            </button>
          ))}
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
        <MarketplaceTable listings={filtered} dealerNameByUid={dealerNameByUid} />
      )}
    </div>
  );
}
