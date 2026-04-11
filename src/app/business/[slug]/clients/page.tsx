'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
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
  FileText
} from 'lucide-react';
import type { Cliente, StockVehicle } from '@/lib/business-types';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ClientFormDialog } from '@/components/business/client-form-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';

const PAGE_SIZE = 100;

export default function ClientsPage() {
  const { concesionario, hasPermission, isStaffLoggedIn } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [clients, setClients] = useState<Cliente[]>([]);
  const [inventory, setInventory] = useState<StockVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLTableRowElement | null) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore]);

  const permission = hasPermission('clients');

  const loadInitialData = async () => {
    if (!concesionario) return;
    setIsLoading(true);
    try {
      // Load Clients (first 100)
      const qClients = query(
        collection(firestore, 'concesionarios', concesionario.id, 'clientes'),
        orderBy('created_at', 'desc'),
        limit(PAGE_SIZE)
      );
      const snapClients = await getDocs(qClients);
      const clientsData = snapClients.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
      setClients(clientsData);
      setLastDoc(snapClients.docs[snapClients.docs.length - 1] || null);
      setHasMore(snapClients.docs.length === PAGE_SIZE);

      // Load Inventory for matching (all active vehicles)
      const qInventory = query(
        collection(firestore, 'concesionarios', concesionario.id, 'inventario'),
        where('estado_stock', 'in', ['privado_taller', 'publico_web', 'pausado', 'reservado'])
      );
      const snapInventory = await getDocs(qInventory);
      setInventory(snapInventory.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockVehicle)));
    } catch (error) {
      console.error('[Clients] Error fetching data:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los datos.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
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
        limit(PAGE_SIZE)
      );
      const snapClients = await getDocs(qClients);
      const moreClients = snapClients.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
      
      setClients(prev => [...prev, ...moreClients]);
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
    }
  }, [concesionario, isStaffLoggedIn, permission]);

  const getClientMatches = (client: Cliente) => {
    if (!client.vehiculos_requeridos || client.vehiculos_requeridos.length === 0) return [];
    
    return inventory.filter(v => {
      return client.vehiculos_requeridos?.some(req => 
        req.status === 'pendiente' &&
        v.make.toLowerCase() === req.make.toLowerCase() &&
        (v.model.toLowerCase() === req.model.toLowerCase() || v.model.toLowerCase().includes(req.model.toLowerCase()))
      );
    });
  };

  const filteredClients = clients.filter(c => 
    `${c.nombre} ${c.apellido} ${c.cedula_rif} ${c.telefono || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const handleEdit = (client: Cliente) => {
    setEditingClient(client);
    setTimeout(() => {
      setDialogOpen(true);
    }, 50);
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

  const openWhatsApp = (phone: string, text?: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = text 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${cleanPhone}`;
    window.open(url, '_blank');
  };

  if (permission === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Clientes</h1>
          <p className="text-muted-foreground mt-1">Base de datos optimizada para alto volumen</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate} className="shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre, cédula o teléfono..." 
            className="pl-9 bg-muted/50 border-none"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-none bg-transparent">
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[300px]">Cliente</TableHead>
                <TableHead>Identificación</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Inversión</TableHead>
                <TableHead>Estado / Wishlist</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Cargando clientes...</p>
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <User className="h-12 w-12 text-muted-foreground mb-4 opacity-20 mx-auto" />
                    <h3 className="text-lg font-semibold">No se encontraron clientes</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                      {searchQuery ? 'Intenta con otros términos de búsqueda.' : 'Registra tu primer cliente para empezar.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client, index) => {
                  const matches = getClientMatches(client);
                  const isLast = index === filteredClients.length - 1;
                  
                  return (
                    <TableRow key={client.id} ref={isLast ? lastElementRef : null} className="group hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {client.nombre[0]}{client.apellido?.[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground leading-none">{client.nombre} {client.apellido}</span>
                            <span className="text-[10px] text-muted-foreground mt-1">Registrado: {client.created_at?.toDate().toLocaleDateString()}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground">{client.cedula_rif}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{client.telefono || 'Sin teléfono'}</span>
                          </div>
                          {client.email && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{client.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-bold text-primary">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>{(client.total_invertido || 0).toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {client.traspaso_pendiente && (
                            <Badge variant="destructive" className="text-[10px] h-5 py-0">Título Pendiente</Badge>
                          )}
                          {matches.length > 0 && (
                            <Badge className="text-[10px] h-5 py-0 bg-purple-600 hover:bg-purple-700 animate-pulse">
                              <Sparkles className="h-2.5 w-2.5 mr-1" /> {matches.length} Match
                            </Badge>
                          )}
                          {client.vehiculos_requeridos && client.vehiculos_requeridos.length > 0 && matches.length === 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 py-0">Wishlist active</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => client.telefono && openWhatsApp(client.telefono)}
                            disabled={!client.telefono}
                            title="WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(client)}><Eye className="h-4 w-4 mr-2" />Ver Detalle / Expediente</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(client.id)}><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          
          {isLoadingMore && (
            <div className="p-4 text-center border-t">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
            </div>
          )}
        </div>
      </Card>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
        onSave={loadInitialData}
      />
    </div>
  );
}
