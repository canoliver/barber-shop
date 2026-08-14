'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { formatCurrency, getMovementTypeLabel } from '@/lib/format';
import { Boxes, AlertTriangle, Package, TrendingUp, TrendingDown, Sliders, ScanLine, History } from 'lucide-react';
import { toast } from 'sonner';
import type { Inventory, InventoryMovement, MovementType } from '@/lib/types';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>('entry');
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');

  const { data: inventory, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, product:products(*)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter(i => i.product) as (Inventory & { product: any })[];
    },
  });

  const { data: movements } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_movements')
        .select('*, product:products(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as (InventoryMovement & { product: any })[];
    },
  });

  const lowStockItems = (inventory || []).filter((i: any) => i.current_stock < i.minimum_stock);
  const totalStockValue = (inventory || []).reduce((sum: number, i: any) => sum + (i.product?.cost_price || 0) * i.current_stock, 0);
  const filteredInventory = (inventory || []).filter((i: any) => i.product?.name.toLowerCase().includes(search.toLowerCase()));

  const openMovement = (inv: Inventory, type: MovementType) => {
    setSelectedInventory(inv);
    setMovementType(type);
    setQuantity('');
    setReason('');
    setMovementOpen(true);
  };

  const handleMovement = async () => {
    if (!selectedInventory || !quantity) { toast.error('Informe a quantidade.'); return; }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) { toast.error('Quantidade inválida.'); return; }

    let newStock = selectedInventory.current_stock;
    if (movementType === 'entry') newStock += qty;
    else if (movementType === 'exit' || movementType === 'sale') newStock -= qty;
    else if (movementType === 'adjustment') newStock = qty;

    if (newStock < 0) { toast.error('Estoque não pode ficar negativo.'); return; }

    const { error: invErr } = await supabase
      .from('inventory')
      .update({ current_stock: newStock })
      .eq('id', selectedInventory.id);

    if (invErr) { toast.error('Erro ao atualizar estoque.'); return; }

    const { error: movErr } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: selectedInventory.product_id,
        movement_type: movementType,
        quantity: qty,
        previous_stock: selectedInventory.current_stock,
        new_stock: newStock,
        reason,
        performed_by: user?.id,
      });

    if (movErr) toast.error('Erro ao registrar movimentação.');
    else { toast.success('Movimentação registrada!'); queryClient.invalidateQueries({ queryKey: ['inventory'] }); queryClient.invalidateQueries({ queryKey: ['inventory-movements'] }); queryClient.invalidateQueries({ queryKey: ['low-stock-count'] }); setMovementOpen(false); }
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  const stats = [
    { label: 'Total de Produtos', value: String(inventory?.length || 0), icon: Package, color: 'text-blue-400' },
    { label: 'Estoque Baixo', value: String(lowStockItems.length), icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Valor do Estoque', value: formatCurrency(totalStockValue), icon: Boxes, color: 'text-emerald-400' },
  ];

  return (
    <div>
      <PageHeader title="Controle de Estoque" description="Gerencie o estoque de produtos da barbearia." />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s: any) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="glass border-border/50 animate-fade-in">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center"><Icon className={`h-6 w-6 ${s.color}`} /></div>
                <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('stock')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'stock' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>Estoque</button>
        <button onClick={() => setTab('movements')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'movements' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>Movimentações</button>
      </div>

      {tab === 'stock' ? (
        isLoading ? <ListSkeleton count={5} /> : filteredInventory.length === 0 ? (
          <EmptyState icon={<Boxes className="h-8 w-8" />} title="Nenhum produto em estoque" description="Cadastre produtos para controlar o estoque." />
        ) : (
          <div className="glass rounded-xl border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md bg-background/50" />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Estoque Atual</TableHead>
                    <TableHead className="text-center">Mínimo</TableHead>
                    <TableHead className="text-center">Máximo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((inv: any) => {
                    const isLow = inv.current_stock < inv.minimum_stock;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.product?.name}</TableCell>
                        <TableCell className="text-center font-bold">{inv.current_stock}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{inv.minimum_stock}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{inv.maximum_stock}</TableCell>
                        <TableCell>
                          {isLow ? <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Estoque Baixo</Badge>
                                 : <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Normal</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => openMovement(inv, 'entry')} className="h-8 text-emerald-400"><TrendingUp className="h-3.5 w-3.5 mr-1" />Entrada</Button>
                            <Button size="sm" variant="outline" onClick={() => openMovement(inv, 'exit')} className="h-8 text-red-400"><TrendingDown className="h-3.5 w-3.5 mr-1" />Saída</Button>
                            <Button size="sm" variant="outline" onClick={() => openMovement(inv, 'adjustment')} className="h-8"><Sliders className="h-3.5 w-3.5 mr-1" />Ajuste</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      ) : (
        <div className="glass rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-center">Anterior</TableHead>
                  <TableHead className="text-center">Novo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements || []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.product?.name || '—'}</TableCell>
                    <TableCell><Badge variant="secondary" className={m.movement_type === 'entry' ? 'bg-emerald-500/15 text-emerald-300' : m.movement_type === 'exit' || m.movement_type === 'sale' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}>{getMovementTypeLabel(m.movement_type)}</Badge></TableCell>
                    <TableCell className="text-center">{m.quantity}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{m.previous_stock}</TableCell>
                    <TableCell className="text-center font-medium">{m.new_stock}</TableCell>
                    <TableCell className="text-muted-foreground">{m.reason || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="glass-strong border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-playfair text-xl">
              {movementType === 'entry' ? 'Entrada de Estoque' : movementType === 'exit' ? 'Saída de Estoque' : 'Ajuste de Estoque'}
            </DialogTitle>
            <DialogDescription>{selectedInventory?.product?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="glass rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">Estoque atual: <span className="text-foreground font-medium">{selectedInventory?.current_stock}</span></p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">{movementType === 'adjustment' ? 'Nova Quantidade' : 'Quantidade'}</Label>
              <Input id="qty" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Compra de mercadoria, perda, ajuste de inventário..." className="bg-background/50" rows={2} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMovementOpen(false)}>Cancelar</Button>
              <Button onClick={handleMovement} className="gold-gradient text-charcoal font-semibold">Confirmar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
