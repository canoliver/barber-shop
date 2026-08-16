'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LoadingState, ErrorState, EmptyState } from '@/components/states';
import { formatCurrency, maskPhone, getPaymentMethodLabel } from '@/lib/format';
import { Search, Plus, Trash2, ShoppingCart, Package, Scissors, UserPlus, X, CheckCircle2, Loader2, Receipt as ReceiptIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Service, Product, Client, Collaborator, Appointment, PaymentMethod, DiscountType, SaleItemType } from '@/lib/types';

interface CartItem {
  id: string;
  type: SaleItemType;
  name: string;
  unitPrice: number;
  quantity: number;
  serviceId?: string;
  productId?: string;
}

export default function POSPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointment');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [collaboratorId, setCollaboratorId] = useState('');
  const [appointmentIdLinked, setAppointmentIdLinked] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('is_active', true).order('name');
      return data as Service[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*, inventory:inventory(current_stock)').eq('is_active', true).order('name');
      return data as (Product & { inventory?: { current_stock: number }[] })[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').order('full_name');
      return data as Client[];
    },
  });

  const { data: collaborators } = useQuery({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const { data } = await supabase.from('collaborators').select('*').eq('is_active', true).order('full_name');
      return data as Collaborator[];
    },
  });

  const { data: todayAppointments } = useQuery({
    queryKey: ['today-appointments-pos'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(full_name), service:services(name)')
        .eq('appointment_date', today)
        .order('start_time');
      return data as (Appointment & { client: any; service: any })[];
    },
  });

  useEffect(() => {
    if (appointmentId && todayAppointments) {
      const apt = todayAppointments.find((a: any) => a.id === appointmentId);
      if (apt) {
        setAppointmentIdLinked(apt.id);
        if (apt.collaborator_id) setCollaboratorId(apt.collaborator_id);
        if (apt.client_id) {
          const c = clients?.find((cl: any) => cl.id === apt.client_id);
          if (c) { setSelectedClient(c); setClientSearch(c.full_name); }
        }
        if (apt.service_id) {
          const s = services?.find((sv: any) => sv.id === apt.service_id);
          if (s) addToCart({ id: s.id, type: 'service', name: s.name, unitPrice: s.price, quantity: 1, serviceId: s.id });
        }
      }
    }
  }, [appointmentId, todayAppointments, clients, services]);

  const filteredClients = (clients || []).filter((c: any) =>
    c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch)
  ).slice(0, 5);

  const selectClient = (c: Client) => {
    setSelectedClient(c);
    setClientSearch(c.full_name);
    setShowClientResults(false);
  };

  const handleQuickCreate = async () => {
    if (!newClientName.trim() || !newClientPhone.trim()) { toast.error('Nome e telefone são obrigatórios.'); return; }
    const { data, error } = await supabase.from('clients').insert({ full_name: newClientName, phone: newClientPhone }).select().single();
    if (error) { toast.error('Erro ao criar cliente.'); return; }
    queryClient.invalidateQueries({ queryKey: ['clients-all'] });
    selectClient(data);
    setNewClientName(''); setNewClientPhone('');
    setQuickClientOpen(false);
    toast.success('Cliente criado!');
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find((c: any) => c.id === item.id && c.type === item.type);
      if (existing) return prev.map((c: any) => c.id === item.id && c.type === item.type ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, item];
    });
  };

  const updateQuantity = (id: string, type: SaleItemType, delta: number) => {
    setCart(prev => prev.map((c: any) => c.id === id && c.type === type ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const removeFromCart = (id: string, type: SaleItemType) => {
    setCart(prev => prev.filter((c: any) => !(c.id === id && c.type === type)));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue.replace(',', '.')) || 0;
    if (discountType === 'percentage') return subtotal * (val / 100);
    return val;
  }, [discountValue, discountType, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);

  const filteredServices = (services || []).filter((s: any) => s.name.toLowerCase().includes(itemSearch.toLowerCase()));
  const filteredProducts = (products || []).filter((p: any) => p.name.toLowerCase().includes(itemSearch.toLowerCase()));

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Adicione itens ao carrinho.'); return; }
    setSubmitting(true);
    try {
      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        appointment_id: appointmentIdLinked,
        client_id: selectedClient?.id || null,
        collaborator_id: collaboratorId || null,
        payment_method: paymentMethod,
        subtotal,
        discount_amount: discountAmount,
        discount_type: discountType,
        total_amount: total,
        notes,
        created_by: user?.id,
      }).select().single();

      if (saleErr) throw saleErr;

      // Insert sale items
      const saleItems = cart.map((item: any) => ({
        sale_id: sale.id,
        item_type: item.type,
        service_id: item.type === 'service' ? item.serviceId : null,
        product_id: item.type === 'product' ? item.productId : null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.unitPrice * item.quantity,
      }));
      await supabase.from('sale_items').insert(saleItems);

      // Create commission if collaborator is selected
      if (collaboratorId) {
        const collaborator = collaborators?.find((c: any) => c.id === collaboratorId);
        if (collaborator && collaborator.commission_percentage > 0) {
          const commissionAmount = total * (collaborator.commission_percentage / 100);
          await supabase.from('commissions').insert({
            collaborator_id: collaboratorId,
            sale_id: sale.id,
            appointment_id: appointmentIdLinked,
            commission_percentage: collaborator.commission_percentage,
            commission_amount: commissionAmount,
          });
        }
      }

      // Deduct product stock
      const productItems = cart.filter((item: any) => item.type === 'product');
      for (const item of productItems) {
        const inv = (products || []).find((p: any) => p.id === item.productId)?.inventory?.[0];
        if (inv) {
          const newStock = Math.max(0, inv.current_stock - item.quantity);
          await supabase.from('inventory').update({ current_stock: newStock }).eq('id', inv.id);
          await supabase.from('inventory_movements').insert({
            product_id: item.productId!,
            movement_type: 'sale',
            quantity: item.quantity,
            previous_stock: inv.current_stock,
            new_stock: newStock,
            reason: `Venda ${sale.id.slice(0, 8)}`,
            performed_by: user?.id,
          });
        }
      }

      // Create financial transaction
      await supabase.from('financial_transactions').insert({
        type: 'income',
        category: 'Venda',
        description: `Venda PDV - ${selectedClient?.full_name || 'Cliente não identificado'}`,
        amount: total,
        payment_method: paymentMethod,
        reference_id: sale.id,
        reference_type: 'sale',
        date: new Date().toISOString().split('T')[0],
        created_by: user?.id,
      });

      // Update appointment status if linked
      if (appointmentIdLinked) {
        await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointmentIdLinked);
      }

      // Add loyalty points
      if (selectedClient) {
        const points = Math.floor(total);
        await supabase.from('clients').update({ loyalty_points: (selectedClient.loyalty_points || 0) + points }).eq('id', selectedClient.id);
      }

      setLastSaleId(sale.id);
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Venda registrada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar venda.');
    }
    setSubmitting(false);
  };

  const resetSale = () => {
    setCart([]); setSelectedClient(null); setClientSearch(''); setCollaboratorId('');
    setAppointmentIdLinked(null); setDiscountValue(''); setNotes(''); setSuccess(false); setLastSaleId(null);
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="glass-strong border-border/50 max-w-md w-full animate-scale-in">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="font-playfair text-2xl font-bold mb-2">Venda Concluída!</h2>
            <p className="text-muted-foreground text-sm mb-6">Total: <span className="text-primary font-bold text-lg">{formatCurrency(total)}</span></p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => { resetSale(); }}><Plus className="h-4 w-4 mr-2" /> Nova Venda</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Vendas (PDV)" description="Registre vendas de serviços e produtos." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product/Service Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('services')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'services' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
              <Scissors className="h-4 w-4 inline mr-2" /> Serviços
            </button>
            <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
              <Package className="h-4 w-4 inline mr-2" /> Produtos
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar item..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="pl-10 bg-background/50" />
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
            {activeTab === 'services' ? (
              filteredServices.map((s: any) => (
                <button key={s.id} onClick={() => addToCart({ id: s.id, type: 'service', name: s.name, unitPrice: s.price, quantity: 1, serviceId: s.id })}
                  className="glass rounded-lg p-3 text-left hover:gold-glow transition-all border border-border/50">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} className="w-full h-20 rounded-lg object-cover mb-2" />
                  ) : (
                    <div className="w-full h-20 rounded-lg bg-secondary/50 flex items-center justify-center mb-2">
                      <Scissors className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-primary font-bold text-sm">{formatCurrency(s.price)}</p>
                  <p className="text-xs text-muted-foreground">{s.duration_minutes}min</p>
                </button>
              ))
            ) : (
              filteredProducts.map((p: any) => (
                <button key={p.id} onClick={() => addToCart({ id: p.id, type: 'product', name: p.name, unitPrice: p.selling_price, quantity: 1, productId: p.id })}
                  className="glass rounded-lg p-3 text-left hover:gold-glow transition-all border border-border/50">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-20 rounded-lg object-cover mb-2" /> : <div className="w-full h-20 rounded-lg bg-secondary/50 flex items-center justify-center mb-2"><Package className="h-6 w-6 text-muted-foreground" /></div>}
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-primary font-bold text-sm">{formatCurrency(p.selling_price)}</p>
                  <p className="text-xs text-muted-foreground">Estoque: {p.inventory?.[0]?.current_stock || 0}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="space-y-4">
          <Card className="glass border-border/50 sticky top-20">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-playfair text-lg font-semibold flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Carrinho</h3>

              {/* Client */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <div className="relative">
                  <Input placeholder="Buscar cliente..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); }} onFocus={() => setShowClientResults(true)} className="bg-background/50" />
                  {showClientResults && clientSearch && (
                    <div className="absolute z-50 w-full mt-1 glass-strong rounded-lg border border-border/50 max-h-48 overflow-y-auto scrollbar-thin">
                      {filteredClients.map((c: any) => (
                        <button key={c.id} type="button" onClick={() => selectClient(c)} className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors text-sm">
                          <span className="font-medium">{c.full_name}</span><span className="text-muted-foreground ml-2">{c.phone}</span>
                        </button>
                      ))}
                      {filteredClients.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>}
                      <button type="button" onClick={() => setQuickClientOpen(true)} className="w-full text-left px-3 py-2 hover:bg-primary/10 text-sm text-primary flex items-center gap-2 border-t border-border/50">
                        <UserPlus className="h-3.5 w-3.5" /> Criar novo cliente
                      </button>
                    </div>
                  )}
                </div>
                {quickClientOpen && (
                  <div className="glass rounded-lg p-3 space-y-2 border border-primary/30 animate-fade-in">
                    <div className="flex items-center justify-between"><Label className="text-sm">Novo Cliente</Label><button onClick={() => setQuickClientOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
                    <Input placeholder="Nome" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="bg-background/50" />
                    <Input placeholder="Telefone" value={newClientPhone} onChange={(e) => setNewClientPhone(maskPhone(e.target.value))} className="bg-background/50" />
                    <Button size="sm" onClick={handleQuickCreate} className="w-full gold-gradient text-charcoal">Criar</Button>
                  </div>
                )}
              </div>

              {/* Collaborator */}
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                  <SelectTrigger className="bg-background/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(collaborators || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Appointment Link */}
              <div className="space-y-2">
                <Label>Agendamento (opcional)</Label>
                <Select value={appointmentIdLinked || 'none'} onValueChange={(v) => setAppointmentIdLinked(v === 'none' ? null : v)}>
                  <SelectTrigger className="bg-background/50"><SelectValue placeholder="Sem agendamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem agendamento</SelectItem>
                    {(todayAppointments || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.start_time?.slice(0, 5)} - {a.client?.full_name || a.client_name || 'Cliente'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Cart Items */}
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Carrinho vazio. Adicione itens.</p>
                ) : (
                  cart.map(item => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => updateQuantity(item.id, item.type, -1)} className="h-7 w-7">-</Button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <Button size="icon" variant="ghost" onClick={() => updateQuantity(item.id, item.type, 1)} className="h-7 w-7">+</Button>
                      </div>
                      <span className="text-sm font-bold w-20 text-right">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeFromCart(item.id, item.type)} className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))
                )}
              </div>

              {/* Discount */}
              {cart.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                      <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="fixed">R$ Fixo</SelectItem><SelectItem value="percentage">% Percentual</SelectItem></SelectContent>
                    </Select>
                    <Input placeholder="Desconto" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="bg-background/50" />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                      <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                        <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="mixed">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 pt-3 border-t border-border/50">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-400"><span>Desconto:</span><span>-{formatCurrency(discountAmount)}</span></div>}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/50"><span>Total:</span><span className="text-primary">{formatCurrency(total)}</span></div>
                  </div>

                  <Button onClick={handleCheckout} disabled={submitting} className="w-full gold-gradient text-charcoal font-semibold hover:opacity-90">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Finalizar Venda</>}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
