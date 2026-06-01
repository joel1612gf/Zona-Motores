'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useAdminAuth } from '@/context/admin-auth-context';
import type { SuperAdmin } from '@/lib/admin-types';
import { TeamTable } from '@/components/admin/team-table';
import { InviteAdminDialog } from '@/components/admin/invite-admin-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users, UserPlus } from 'lucide-react';

export default function AdminTeamPage() {
  const router = useRouter();
  const { isOwner, user } = useAdminAuth();
  const firestore = useFirestore();

  // Owner-only route (defense in depth).
  useEffect(() => {
    if (!isOwner) router.replace('/admin/marketplace');
  }, [isOwner, router]);

  const adminsQuery = useMemoFirebase(() => collection(firestore, 'super_admins'), [firestore]);
  const { data: admins, isLoading } = useCollection<SuperAdmin>(adminsQuery);

  const [inviteOpen, setInviteOpen] = useState(false);

  const existingEmails = useMemo(() => (admins ?? []).map((a) => a.email.toLowerCase()), [admins]);

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
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Equipo de Administración</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Invita administradores y gestiona sus roles y accesos al panel global.
          </p>
        </div>
        <Button
          className="rounded-2xl h-12 px-6 shadow-lg shadow-primary/20 font-bold gap-2 w-full md:w-auto"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          Invitar administrador
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-[1.5rem]" />
          <Skeleton className="h-16 rounded-[1.5rem]" />
        </div>
      ) : (
        <TeamTable admins={admins ?? []} currentEmail={(user?.email ?? '').toLowerCase()} />
      )}

      <InviteAdminDialog open={inviteOpen} onOpenChange={setInviteOpen} existingEmails={existingEmails} />
    </div>
  );
}
