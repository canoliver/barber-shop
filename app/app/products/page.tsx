'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GridSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ProductForm } from '@/components/product-form';
import { formatCurrency } from '@/lib/format';
import { Plus, Search, Pencil, Trash2, Package, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';

const CATEGORIES = ['Pomada', 'Shampoo', 'Condicionador', 'Óleo para Barba', 'Cera', 'Pós-Barba', 'Acessórios', 'Outros'];

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: products, isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = (products || []).filter((p: any) =>
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)) &&
    (categoryFilter === 'all' || p.category === categoryFilter)
  );

  const handleEdit = (p: Product) => { setEditing(p); setFormOpen(true); };
  const handleNew = () => { setEditing(null); setFormOpen(true); };

  const handleToggleActive = async (p: Product) => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) toast.error('Erro ao atualizar produto.');
    else { toast.success(p.is_active ? 'Produto desativado.' : 'Produto ativado!'); queryClient.invalidateQueries({ queryKey: ['products'] }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteId);
    if (error) toast.error('Erro ao excluir produto.');
    else { toast.success('Produto excluído!'); queryClient.invalidateQueries({ queryKey: ['products'] }); }
    setDeleteId(null);
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Produtos" description="Gerencie o catálogo de produtos da barbearia.">
        <div className="flex bg-secondary/50 rounded-lg p-1">
          <button onClick={() => setView('grid')} className={`px-3 py-1 rounded-md ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView('table')} className={`px-3 py-1 rounded-md ${view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><List className="h-4 w-4" /></button>
        </div>
        <Button onClick={handleNew} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo Produto
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-background/50" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas categorias</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <GridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title="Nenhum produto cadastrado" description="Cadastre seu primeiro produto para começar a vender." actionLabel="Cadastrar Produto" onAction={handleNew} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p: any) => {
            const margin = p.selling_price - p.cost_price;
            const marginPct = p.cost_price > 0 ? (margin / p.cost_price) * 100 : 0;
            return (
              <Card key={p.id} className={`glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in ${!p.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="p-5">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-32 rounded-lg object-cover mb-4" />
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-secondary/50 flex items-center justify-center mb-4"><Package className="h-10 w-10 text-muted-foreground" /></div>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-base leading-tight">{p.name}</h3>
                    <Badge variant="secondary" className="bg-primary/15 text-primary">{p.category}</Badge>
                  </div>
                  {p.brand && <p className="text-xs text-muted-foreground mb-3">{p.brand}</p>}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Preço</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(p.selling_price)}</p>
                    </div>
                    <Badge variant={margin > 0 ? 'default' : 'destructive'} className={margin > 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : ''}>
                      {marginPct.toFixed(0)}% margem
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_active} onCheckedChange={() => handleToggleActive(p)} />
                      <span className="text-xs text-muted-foreground">{p.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(p)} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50">
                <tr>
                  <th className="text-left p-4 font-medium text-muted-foreground">Produto</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Marca</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Categoria</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">SKU</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Custo</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Venda</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Margem</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => {
                  const margin = p.selling_price - p.cost_price;
                  const marginPct = p.cost_price > 0 ? (margin / p.cost_price) * 100 : 0;
                  return (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <td className="p-4 font-medium">{p.name}</td>
                      <td className="p-4 text-muted-foreground">{p.brand || '—'}</td>
                      <td className="p-4"><Badge variant="secondary" className="bg-primary/15 text-primary">{p.category}</Badge></td>
                      <td className="p-4 text-muted-foreground">{p.sku || '—'}</td>
                      <td className="p-4 text-right">{formatCurrency(p.cost_price)}</td>
                      <td className="p-4 text-right font-medium">{formatCurrency(p.selling_price)}</td>
                      <td className="p-4 text-right"><span className={margin > 0 ? 'text-emerald-400' : 'text-red-400'}>{marginPct.toFixed(0)}%</span></td>
                      <td className="p-4"><div className="flex gap-1 justify-end"><Button size="icon" variant="ghost" onClick={() => handleEdit(p)} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductForm open={formOpen} onOpenChange={setFormOpen} product={editing} onSaved={() => queryClient.invalidateQueries({ queryKey: ['products'] })} />
      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} title="Excluir Produto" description="Tem certeza que deseja excluir este produto?" confirmLabel="Excluir" destructive onConfirm={handleDelete} />
    </div>
  );
}
