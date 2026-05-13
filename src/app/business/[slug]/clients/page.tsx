'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
  where,
  limit,
  startAfter,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Search,
  Plus,
  Phone,
  Mail,
  DollarSign,
  MessageCircle,
  MoreVertical,
  Trash2,
  Eye,
  Sparkles,
  Loader2,
  FileText,
  Users,
  Target,
  Car,
  AlertTriangle,
} from 'lucide-react';
import type { Cliente, MatchOportunidad } from '@/lib/business-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { openWhatsApp } from '@/lib/whatsapp-helper';
import { CustomerAccountStatement } from '@/components/business/customer-account-statement';
import { ClientSheet360 } from '@/components/business/client-sheet-360';
import { ClientCreateDialog } from '@/components/business/client-create-dialog';
import { sendMatchWhatsApp, updateMatchStatus } from '@/lib/crm-actions';

const PAGE_SIZE = 100;

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function ClientsPage() {
  const { concesionario, staff, hasPermission, isStaffLoggedIn } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get('tab') === 'oportunidades' ? 'oportunidades' : 'todos';
  const [tab, setTab] = useState<string>(initialTab);

  const [clients, setClients] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetCliente, setSheetCliente] = useState<Cliente | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [statementClient, setStatementClient] = useState<Cliente | null>(null);

  const [kpiTotal, setKpiTotal] = useState<number | null>(null);
  const [kpiLeads, setKpiLeads] = useState<number | null>(null);
  const [kpiLtv, setKpiLtv] = useState<number | null>(null);

  const [matches, setMatches] = useState<MatchOportunidad[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLTableRowElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) loadMore();
    });
    if (node) observer.current.observe(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoadingMore, hasMore]);

  const permission = hasPermission('clients');

  const loadInitialData = async () => {
    if (!concesionario) return;
    setIsLoading(true);
    try {
      const qClients = query(
        collection(firestore, 'concesionarios', concesionario.id, 'clientes'),
        orderBy('created_at', 'desc'),
        limit(PAGE_SIZE),
      );
      const snapClients = await getDocs(qClients);
      const clientsData = snapClients.docs.map(d => ({ id: d.id, ...d.data() } as Cliente));
      setClients(clientsData);
      setLastDoc(snapClients.docs[snapClients.docs.length - 1] || null);
      setHasMore(snapClients.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('[Clients] Error fetching data:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los datos.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadKpis = async () => {
    if (!concesionario) return;
    try {
      const clientesCol = collection(firestore, 'concesionarios', concesionario.id, 'clientes');
      const [countSnap, aggSnap] = await Promise.all([
        getCountFromServer(clientesCol),
        getAggregateFromServer(clientesCol, { ltv: sum('total_invertido') }),
      ]);
      setKpiTotal(countSnap.data().count);
      setKpiLtv(aggSnap.data().ltv ?? 0);
    } catch (e) {
      console.error('[Clients KPI] error', e);
    }
  };

  const loadMore = async () => {
    if (!concesionario || !lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const qClients = query(
        collection(firestore, 'concesionarios', concesionario.id, 'clientes'),
        orderBy('created_at', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      );
      const snapClients = await getDocs(qClients);
      const more = snapClients.docs.map(d => ({ id: d.id, ...d.data() } as Cliente));
      setClients(prev => [...prev, ...more]);
      setLastDoc(snapClients.docs[snapClients.docs.length - 1] || null);
      setHasMore(snapClients.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('[Clients] Error loading more:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isStaffLoggedIn && permission) {
      loadInitialData();
      loadKpis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concesionario, isStaffLoggedIn, permission]);

  useEffect(() => {
    if (!concesionario || !permission) return;
    setMatchesLoading(true);
    const qMatches = query(
      collection(firestore, 'concesionarios', concesionario.id, 'matches'),
      where('status', '==', 'pendiente'),
      orderBy('created_at', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(
      qMatches,
      (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as MatchOportunidad));
        setMatches(rows);
        setMatchesLoading(false);
      },
      (err) => {
        console.error('[Clients matches] error', err);
        setMatchesLoading(false);
      },
    );
    return () => unsub();
  }, [firestore, concesionario, permission]);

  useEffect(() => {
    const count = clients.reduce((acc, c) => {
      const has = (c.vehiculos_requeridos ?? []).some(r => r.status === 'pendiente');
      return acc + (has ? 1 : 0);
    }, 0);
    setKpiLeads(count);
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      `${c.nombre} ${c.apellido} ${c.cedula_rif} ${c.telefono || ''}`.toLowerCase().includes(q),
    );
  }, [clients, searchQuery]);

  const handleCreate = () => setCreateOpen(true);

  const openSheetFor = (cliente: Cliente) => {
    setSheetCliente(cliente);
    setTimeout(() => setSheetOpen(true), 30);
  };

  const handleDelete = async (id: string) => {
    if (!concesionario || !confirm('¿Estás seguro de eliminar este cliente?')) return;
    try {
      await deleteDoc(doc(firestore, 'concesionarios', concesionario.id, 'clientes', id));
      toast({ title: 'Cliente eliminado' });
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleMatchWhatsApp = async (m: MatchOportunidad) => {
    if (!concesionario || !staff) return;
    if (!m.cliente_telefono) {
      toast({ title: 'Sin teléfono', description: 'Este cliente no tiene teléfono registrado.', variant: 'destructive' });
      return;
    }
    try {
      await sendMatchWhatsApp(
        firestore,
        concesionario.id,
        concesionario.nombre_empresa,
        m,
        m.cliente_telefono,
        { id: staff.id, nombre: staff.nombre },
      );
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'No se pudo enviar.', variant: 'destructive' });
    }
  };

  const handleMatchStatus = async (m: MatchOportunidad, status: MatchOportunidad['status']) => {
    if (!concesionario || !staff) return;
    try {
      await updateMatchStatus(firestore, concesionario.id, m.id, status, { id: staff.id, nombre: staff.nombre });
      toast({ title: status === 'descartado' ? 'Oportunidad descartada' : 'Marcado como convertido' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
      {/* Blob decorativo */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* §3 Header canónico */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Clientes</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            CRM con match-maker automático, vista 360° y bitácora de interacciones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            onClick={handleCreate}
            className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold flex-1 md:flex-none"
          >
            <Plus className="h-5 w-5" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* §5 KPI cards — variante B (border-l semántico). Justificado: CRM expone métricas analíticas LTV/Leads. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        <KpiCard
          icon={<Users className="h-28 w-28" />}
          label="Total Clientes"
          value={kpiTotal === null ? '—' : kpiTotal.toLocaleString('en-US')}
          hint="Base activa registrada"
          accent="primary"
        />
        <KpiCard
          icon={<Target className="h-28 w-28" />}
          label="Leads Activos"
          value={kpiLeads === null ? '—' : kpiLeads.toLocaleString('en-US')}
          hint="Con wishlist pendiente (visibles)"
          accent="amber"
        />
        <KpiCard
          icon={<DollarSign className="h-28 w-28" />}
          label="LTV Global"
          value={kpiLtv === null ? '—' : fmtUsd(kpiLtv)}
          hint="Suma histórica invertida"
          accent="emerald"
        />
      </div>

      {/* §7 Tabs pill blanca */}
      <Tabs value={tab} onValueChange={setTab} className="relative z-10">
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-12 border border-slate-200/60 shadow-inner">
          <TabsTrigger
            value="todos"
            className="rounded-xl px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold gap-2"
          >
            <Users className="h-4 w-4" />
            Todos
          </TabsTrigger>
          <TabsTrigger
            value="oportunidades"
            className="rounded-xl px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Oportunidades
            {matches.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 bg-amber-500 hover:bg-amber-500 text-white">{matches.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab Todos */}
        <TabsContent value="todos" className="mt-8 space-y-6">
          {/* §9 Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, cédula o teléfono..."
                className="pl-10 rounded-xl h-12 border-slate-200 focus:border-primary/50 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <LoadingBlock />
          ) : filteredClients.length === 0 ? (
            <EmptyClients hasSearch={!!searchQuery} />
          ) : (
            <>
              {/* Desktop — tabla envuelta §8 */}
              <div className="hidden md:block rounded-[1.5rem] border shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest w-[300px]">Cliente</TableHead>
                        <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Identificación</TableHead>
                        <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contacto</TableHead>
                        <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Inversión</TableHead>
                        <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estado / Wishlist</TableHead>
                        <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y bg-background/50 backdrop-blur-sm">
                      {filteredClients.map((client, index) => {
                        const hasWishlist = (client.vehiculos_requeridos ?? []).some(r => r.status === 'pendiente');
                        const isLast = index === filteredClients.length - 1;
                        return (
                          <TableRow
                            key={client.id}
                            ref={isLast ? lastElementRef : null}
                            className="group hover:bg-muted/40 transition-colors cursor-pointer"
                            onClick={() => openSheetFor(client)}
                          >
                            <TableCell className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm ring-1 ring-primary/20">
                                  {client.nombre[0]}{client.apellido?.[0]}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-foreground leading-tight truncate">{client.nombre} {client.apellido}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                                    Reg. {client.created_at?.toDate?.().toLocaleDateString('es-VE') ?? '—'}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-5">
                              <span className="font-mono text-sm text-muted-foreground">{client.cedula_rif}</span>
                            </TableCell>
                            <TableCell className="px-6 py-5">
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate">{client.telefono || 'Sin teléfono'}</span>
                                </div>
                                {client.email && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                                    <Mail className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate max-w-[180px]">{client.email}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-5">
                              <div className="flex items-center gap-1 font-bold font-headline text-primary text-base">
                                <DollarSign className="h-3.5 w-3.5" />
                                <span>{(client.total_invertido || 0).toLocaleString()}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-5">
                              <div className="flex flex-wrap gap-1">
                                {client.traspaso_pendiente && (
                                  <Badge variant="destructive" className="text-[10px] h-5 py-0 font-bold">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />Título Pendiente
                                  </Badge>
                                )}
                                {(client.deuda_actual_usd ?? 0) > 0.01 && (
                                  <Badge className="text-[10px] h-5 py-0 bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20 font-bold" variant="outline">
                                    Deuda ${(client.deuda_actual_usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </Badge>
                                )}
                                {hasWishlist && (
                                  <Badge variant="outline" className="text-[10px] h-5 py-0 border-primary/30 text-primary font-bold">
                                    <Sparkles className="h-2.5 w-2.5 mr-1" />Wishlist activa
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-5 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 rounded-xl border-emerald-500/20 hover:bg-emerald-500/5 text-emerald-600"
                                  onClick={() => client.telefono && openWhatsApp(client.telefono)}
                                  disabled={!client.telefono}
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-primary/20 hover:bg-primary/5">
                                      <MoreVertical className="h-4 w-4 text-primary" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl">
                                    <DropdownMenuItem onClick={() => openSheetFor(client)}><Eye className="h-4 w-4 mr-2" />Ver Perfil 360°</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatementClient(client)}><FileText className="h-4 w-4 mr-2" />Estado de Cuenta</DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(client.id)}><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {isLoadingMore && (
                  <div className="p-4 text-center border-t">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                  </div>
                )}
              </div>

              {/* Mobile — cards apiladas */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredClients.map((client, index) => {
                  const hasWishlist = (client.vehiculos_requeridos ?? []).some(r => r.status === 'pendiente');
                  const isLast = index === filteredClients.length - 1;
                  return (
                    <ClientCardMobile
                      key={client.id}
                      client={client}
                      hasWishlist={hasWishlist}
                      onOpen={() => openSheetFor(client)}
                      onWhatsApp={() => client.telefono && openWhatsApp(client.telefono)}
                      onStatement={() => setStatementClient(client)}
                      onDelete={() => handleDelete(client.id)}
                      lastRef={isLast ? (lastElementRef as unknown as React.Ref<HTMLDivElement>) : undefined}
                    />
                  );
                })}
                {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto my-3" />}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab Oportunidades */}
        <TabsContent value="oportunidades" className="mt-8">
          {matchesLoading ? (
            <LoadingBlock />
          ) : matches.length === 0 ? (
            <EmptyMatches />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {matches.map(m => (
                <MatchCard
                  key={m.id}
                  match={m}
                  onWhatsApp={() => handleMatchWhatsApp(m)}
                  onView={() => {
                    const c = clients.find(x => x.id === m.cliente_id);
                    if (c) openSheetFor(c);
                    else toast({ title: 'Cliente no cargado', description: 'Búscalo en la pestaña Todos.' });
                  }}
                  onDiscard={() => handleMatchStatus(m, 'descartado')}
                  onConvert={() => handleMatchStatus(m, 'convertido')}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {concesionario && (
        <>
          <ClientSheet360
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            cliente={sheetCliente}
            concesionarioId={concesionario.id}
            onSaved={loadInitialData}
          />
          <ClientCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            concesionarioId={concesionario.id}
            onCreated={(c) => {
              setClients(prev => [c, ...prev]);
              loadKpis();
              openSheetFor(c);
            }}
          />
        </>
      )}

      <CustomerAccountStatement
        open={!!statementClient}
        cliente={statementClient}
        onOpenChange={(o) => !o && setStatementClient(null)}
      />
    </div>
  );
}

/* ---------- KPI Card — variante B ---------- */
function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent: 'primary' | 'amber' | 'emerald';
}) {
  const accentMap = {
    primary: { border: 'border-l-primary', text: 'text-primary' },
    amber: { border: 'border-l-amber-500', text: 'text-amber-600' },
    emerald: { border: 'border-l-emerald-500', text: 'text-emerald-600' },
  }[accent];

  return (
    <Card className={cn(
      'border-none relative overflow-hidden group transition-all hover:-translate-y-1 bg-card/60 backdrop-blur-md ring-1 ring-border shadow-xl rounded-[1.5rem] border-l-4',
      accentMap.border,
    )}>
      <div className={cn('absolute -bottom-4 -right-4 opacity-[0.08] group-hover:scale-110 transition-transform duration-700', accentMap.text)}>
        {icon}
      </div>
      <CardHeader className="pb-2 relative z-10">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className={cn('text-3xl font-bold font-headline tracking-tighter leading-none', accentMap.text)}>{value}</div>
        {hint && <p className="text-xs mt-2.5 font-medium text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/* ---------- Match Card ---------- */
function MatchCard({
  match,
  onWhatsApp,
  onView,
  onDiscard,
  onConvert,
}: {
  match: MatchOportunidad;
  onWhatsApp: () => void;
  onView: () => void;
  onDiscard: () => void;
  onConvert: () => void;
}) {
  const budgetDelta =
    match.budget && match.vehiculo_precio_usd
      ? ((match.vehiculo_precio_usd - match.budget) / match.budget) * 100
      : null;

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[2rem] overflow-hidden group transition-all hover:-translate-y-1 relative">
      <Sparkles className="absolute -bottom-4 -right-4 h-32 w-32 text-amber-500 opacity-[0.08] group-hover:scale-110 group-hover:rotate-12 transition-all duration-700" />
      <CardContent className="p-6 space-y-4 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Nueva oportunidad</p>
            </div>
            <h3 className="font-bold font-headline text-lg flex items-center gap-2 truncate">
              <Car className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{match.vehiculo_make} {match.vehiculo_model}{match.vehiculo_year ? ` ${match.vehiculo_year}` : ''}</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              para <span className="font-bold text-foreground">{match.cliente_nombre}</span>
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold font-headline text-primary tracking-tighter leading-none">{fmtUsd(match.vehiculo_precio_usd)}</p>
            {match.budget !== undefined && budgetDelta !== null && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] mt-2 font-bold',
                  budgetDelta <= 0
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-700 border-amber-500/20',
                )}
              >
                {budgetDelta <= 0 ? 'dentro de presupuesto' : `+${budgetDelta.toFixed(0)}% sobre budget`}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <span className="font-medium">{match.cliente_telefono ?? 'Sin teléfono registrado'}</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/50">
          <Button
            size="sm"
            className="rounded-xl h-10 font-bold shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 gap-2"
            onClick={onWhatsApp}
            disabled={!match.cliente_telefono}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar oferta
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-10 font-bold border-primary/20 hover:bg-primary/5 gap-2"
            onClick={onView}
          >
            <Eye className="h-4 w-4 text-primary" />
            Ver cliente
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="rounded-xl h-10 font-bold text-muted-foreground" onClick={onDiscard}>
            Descartar
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl h-10 font-bold text-emerald-700 hover:bg-emerald-50" onClick={onConvert}>
            Convertido
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Client Card Mobile ---------- */
function ClientCardMobile({
  client,
  hasWishlist,
  onOpen,
  onWhatsApp,
  onStatement,
  onDelete,
  lastRef,
}: {
  client: Cliente;
  hasWishlist: boolean;
  onOpen: () => void;
  onWhatsApp: () => void;
  onStatement: () => void;
  onDelete: () => void;
  lastRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={lastRef}
      className="rounded-[1.5rem] border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border p-4 space-y-3 active:scale-[0.99] transition-transform"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base ring-1 ring-primary/20 flex-shrink-0">
          {client.nombre[0]}{client.apellido?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{client.nombre} {client.apellido}</p>
          <p className="text-xs font-mono text-muted-foreground">{client.cedula_rif}</p>
          <p className="text-xs text-muted-foreground truncate">{client.telefono ?? 'Sin teléfono'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inv.</p>
          <p className="font-bold font-headline text-primary text-base">${(client.total_invertido || 0).toLocaleString()}</p>
        </div>
      </div>

      {(client.traspaso_pendiente || (client.deuda_actual_usd ?? 0) > 0.01 || hasWishlist) && (
        <div className="flex flex-wrap gap-1">
          {client.traspaso_pendiente && (
            <Badge variant="destructive" className="text-[10px] h-5 py-0 font-bold">Título Pendiente</Badge>
          )}
          {(client.deuda_actual_usd ?? 0) > 0.01 && (
            <Badge className="text-[10px] h-5 py-0 bg-red-500/10 text-red-600 border-red-500/20 font-bold" variant="outline">
              Deuda ${(client.deuda_actual_usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Badge>
          )}
          {hasWishlist && (
            <Badge variant="outline" className="text-[10px] h-5 py-0 border-primary/30 text-primary font-bold">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Wishlist
            </Badge>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-10 font-bold flex-1 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5 gap-2"
          onClick={onWhatsApp}
          disabled={!client.telefono}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-10 font-bold flex-1 border-primary/20 text-primary hover:bg-primary/5 gap-2"
          onClick={onStatement}
        >
          <FileText className="h-4 w-4" />
          Estado
        </Button>
        <Button size="icon" variant="outline" className="rounded-xl h-10 w-10 border-red-200 text-red-500 hover:bg-red-50" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Loading + Empty ---------- */
function LoadingBlock() {
  return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Cargando…</p>
    </div>
  );
}

function EmptyClients({ hasSearch }: { hasSearch: boolean }) {
  return (
    <Card className="bg-card/40 backdrop-blur-md border-dashed border-2 border-muted-foreground/20 rounded-[2rem]">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 bg-muted/50 rounded-full mb-4">
          <User className="h-10 w-10 text-muted-foreground opacity-60" />
        </div>
        <p className="text-lg font-bold font-headline">Sin clientes</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {hasSearch ? 'No hay coincidencias para tu búsqueda. Prueba con otros términos.' : 'Registra tu primer cliente para empezar a alimentar el CRM.'}
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyMatches() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="relative">
        <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full" />
        <div className="relative p-8 bg-white/60 backdrop-blur-xl border border-white/40 rounded-[2rem] shadow-xl">
          <Sparkles className="h-14 w-14 text-amber-500 mx-auto" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold font-headline">Sin oportunidades activas</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Cuando ingrese un vehículo que coincida con la wishlist de un cliente, aparecerá aquí automáticamente.
        </p>
      </div>
    </div>
  );
}
