'use client';

import { useState, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Save, 
  Loader2, 
  ShoppingBag, 
  FileText, 
  Plus, 
  Trash2, 
  Car, 
  Calendar,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import type { Cliente, VehiculoRequerido, Venta } from '@/lib/business-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Cliente | null;
  onSave: () => void;
}

export function ClientFormDialog({ open, onOpenChange, client, onSave }: ClientFormDialogProps) {
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Form state
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cedulaRif, setCedulaRif] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [traspasoPendiente, setTraspasoPendiente] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Wishlist state
  const [vehiculosRequeridos, setVehiculosRequeridos] = useState<VehiculoRequerido[]>([]);
  const [newReqMake, setNewReqMake] = useState('');
  const [newReqModel, setNewReqModel] = useState('');
  
  // History state
  const [purchases, setPurchases] = useState<Venta[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (client) {
      setNombre(client.nombre || '');
      setApellido(client.apellido || '');
      setCedulaRif(client.cedula_rif || '');
      setTelefono(client.telefono || '');
      setEmail(client.email || '');
      setTraspasoPendiente(client.traspaso_pendiente || false);
      setTags(client.tags || []);
      setVehiculosRequeridos(client.vehiculos_requeridos || []);
      
      if (open) {
        loadPurchaseHistory(client.id);
      }
    } else {
      setNombre('');
      setApellido('');
      setCedulaRif('');
      setTelefono('');
      setEmail('');
      setTraspasoPendiente(false);
      setTags([]);
      setVehiculosRequeridos([]);
      setPurchases([]);
    }
    setActiveTab('general');
  }, [client, open]);

  const loadPurchaseHistory = async (clientId: string) => {
    if (!concesionario) return;
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(firestore, 'concesionarios', concesionario.id, 'ventas'),
        where('comprador_id', '==', clientId)
      );
      const snap = await getDocs(q);
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Venta)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSave = async () => {
    if (!concesionario || !nombre || !apellido || !cedulaRif) {
      toast({ title: 'Faltan datos', description: 'Nombre, apellido y cédula son obligatorios.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const clientData = {
        nombre,
        apellido,
        cedula_rif: cedulaRif,
        telefono,
        email,
        traspaso_pendiente: traspasoPendiente,
        tags,
        vehiculos_requeridos: vehiculosRequeridos,
        updated_at: serverTimestamp(),
      };

      if (client) {
        await updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'clientes', client.id), clientData);
        toast({ title: 'Cliente actualizado' });
      } else {
        await addDoc(collection(firestore, 'concesionarios', concesionario.id, 'clientes'), {
          ...clientData,
          total_invertido: 0,
          compras_ids: [],
          created_at: serverTimestamp(),
        });
        toast({ title: 'Cliente creado' });
      }
      onSave();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const addRequirement = () => {
    if (!newReqMake || !newReqModel) return;
    const newReq: VehiculoRequerido = {
      id: crypto.randomUUID(),
      make: newReqMake,
      model: newReqModel,
      status: 'pendiente',
      created_at: Timestamp.now(),
    };
    setVehiculosRequeridos([...vehiculosRequeridos, newReq]);
    setNewReqMake('');
    setNewReqModel('');
  };

  const removeRequirement = (id: string) => {
    setVehiculosRequeridos(vehiculosRequeridos.filter(r => r.id !== id));
  };

  const openWhatsApp = () => {
    if (!telefono) return;
    const cleanPhone = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={client?.id || 'new'}>
      <DialogContent 
        className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-[2rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-headline flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            {client ? 'Expediente de Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {client ? `Gestionando a ${client.nombre} ${client.apellido}` : 'Registra un nuevo cliente en el sistema'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b">
            <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
              <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2">General</TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2">Historial</TabsTrigger>
              <TabsTrigger value="wishlist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2">Requerimientos</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* ═══ TAB: GENERAL ═══ */}
            <TabsContent value="general" className="mt-0 space-y-6 outline-none">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" />
                </div>
                <div className="space-y-2">
                  <Label>Apellido *</Label>
                  <Input value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Apellido" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cédula / RIF *</Label>
                  <Input value={cedulaRif} onChange={e => setCedulaRif(e.target.value)} placeholder="V-00000000" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono / WhatsApp</Label>
                  <div className="relative">
                    <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="0424..." className="pr-10" />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="absolute right-0 top-0 h-full text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={openWhatsApp}
                      disabled={!telefono}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email (Opcional - Para Meta Ads)</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="ejemplo@correo.com" />
              </div>

              <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-xl border">
                <Checkbox id="traspaso" checked={traspasoPendiente} onCheckedChange={c => setTraspasoPendiente(c as boolean)} />
                <div className="flex-1">
                  <Label htmlFor="traspaso" className="font-semibold cursor-pointer">Traspaso de Título Pendiente</Label>
                  <p className="text-xs text-muted-foreground">Marcar si el cliente aún no ha entregado el nuevo título a su nombre.</p>
                </div>
                {traspasoPendiente && client?.traspaso_fecha_limite && (
                  <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                    Límite: {client.traspaso_fecha_limite.toDate().toLocaleDateString()}
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <Label>Etiquetas (Categorización)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newTag} 
                    onChange={e => setNewTag(e.target.value)} 
                    placeholder="Nueva etiqueta..." 
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                  />
                  <Button type="button" variant="outline" onClick={addTag}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <Badge key={tag} className="gap-1 px-3 py-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-200"><Plus className="h-3 w-3 rotate-45" /></button>
                    </Badge>
                  ))}
                  {tags.length === 0 && <p className="text-xs text-muted-foreground italic">Sin etiquetas asignadas.</p>}
                </div>
              </div>
            </TabsContent>

            {/* ═══ TAB: HISTORY ═══ */}
            <TabsContent value="history" className="mt-0 outline-none">
              {isLoadingHistory ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : purchases.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
                  <p className="text-muted-foreground">Este cliente aún no tiene compras registradas.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Ventas Realizadas ({purchases.length})</h4>
                    <span className="text-sm font-bold">Inversión Total: <span className="text-primary">${(client?.total_invertido || 0).toLocaleString()}</span></span>
                  </div>
                  {purchases.map(sale => (
                    <div key={sale.id} className="p-4 rounded-xl border bg-card hover:border-primary/30 transition-colors flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                        {sale.tipo_venta === 'vehiculo' ? <Car className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{sale.vehiculo_nombre || 'Producto'}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {sale.fecha?.toDate().toLocaleDateString()}</span>
                          <span className="flex items-center gap-1 font-mono"><FileText className="h-3 w-3" /> {sale.numero_factura_venta || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">${sale.precio_venta.toLocaleString()}</p>
                        <Badge variant="outline" className="text-[10px] uppercase">{sale.metodo_pago}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ═══ TAB: WISHLIST ═══ */}
            <TabsContent value="wishlist" className="mt-0 outline-none space-y-6">
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Agregar Requerimiento (Wishlist)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">Marca</Label>
                    <Input value={newReqMake} onChange={e => setNewReqMake(e.target.value)} placeholder="Ej: Toyota" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">Modelo</Label>
                    <Input value={newReqModel} onChange={e => setNewReqModel(e.target.value)} placeholder="Ej: Corolla" />
                  </div>
                </div>
                <Button className="w-full mt-3 h-9" onClick={addRequirement} disabled={!newReqMake || !newReqModel}>
                  Agregar a la lista
                </Button>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Vehículos que busca ({vehiculosRequeridos.length})</h4>
                {vehiculosRequeridos.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed">
                    <p className="text-xs text-muted-foreground">No hay requerimientos activos.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {vehiculosRequeridos.map(req => (
                      <div key={req.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Car className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{req.make} {req.model}</p>
                            <p className="text-[10px] text-muted-foreground">Pedido el {req.created_at instanceof Timestamp ? req.created_at.toDate().toLocaleDateString() : 'hoy'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">PENDIENTE</Badge>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeRequirement(req.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs flex gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-blue-500" />
                <p>El sistema te notificará automáticamente cuando ingrese un vehículo que coincida con estos requerimientos.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-6 border-t bg-muted/10">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {client ? 'Guardar Cambios' : 'Registrar Cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
