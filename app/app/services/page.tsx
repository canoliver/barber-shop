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
import { ServiceForm } from '@/components/service-form';
import { formatCurrency } from '@/lib/format';
import { Plus, Search, Pencil, Trash2, Scissors, Clock, TrendingUp, Percent } from 'lucide-react';
import { toast } from 'sonner';
import type { Service } from '@/lib/types';

const CATEGORIES = ['Corte', 'Barba', 'Combo', 'Tratamento', 'Coloração', 'Outros'];

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPercent, setBulkPercent] = useState('');

  const { data: services, isLoading, isError, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Service[];
    },
  });

  const filtered = (services || []).filter((s: any) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchSearch && matchCategory;
  }).sort((a: any, b: any) => {
    if (sortBy === 'price_asc') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const handleEdit = (s: Service) => { setEditing(s); setFormOpen(true); };
  const handleNew = () => { setEditing(null); setFormOpen(true); };

  const handleToggleActive = async (s: Service) => {
    const { error } = await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) toast.error('Erro ao atualizar serviço.');
    else { toast.success(s.is_active ? 'Serviço desativado.' : 'Serviço ativado!'); queryClient.invalidateQueries({ queryKey: ['services'] }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('services').delete().eq('id', deleteId);
    if (error) toast.error('Erro ao excluir serviço.');
    else { toast.success('Serviço excluído!'); queryClient.invalidateQueries({ queryKey: ['services'] }); }
    setDeleteId(null);
  };

  const handleBulkUpdate = async () => {
    const pct = parseFloat(bulkPercent.replace(',', '.'));
    if (isNaN(pct)) { toast.error('Informe um percentual válido.'); return; }
    const factor = 1 + pct / 100;
    const activeServices = (services || []).filter((s: any) => s.is_active);
    const updates = activeServices.map((s: any) =>
      supabase.from('services').update({ price: Math.round(s.price * factor * 100) / 100 }).eq('id', s.id)
    );
    const results = await Promise.all(updates);
    if (results.some(r => r.error)) toast.error('Erro ao atualizar preços.');
    else { toast.success(`Preços reajustados em ${pct > 0 ? '+' : ''}${pct}%!`); queryClient.invalidateQueries({ queryKey: ['services'] }); setBulkOpen(false); setBulkPercent(''); }
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Serviços" description="Gerencie os serviços oferecidos pela barbearia.">
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Percent className="h-4 w-4 mr-2" /> Reajustar Preços
        </Button>
        <Button onClick={handleNew} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo Serviço
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-background/50" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48 bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Mais recentes</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="price_asc">Menor preço</SelectItem>
            <SelectItem value="price_desc">Maior preço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <GridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Scissors className="h-8 w-8" />}
          title="Nenhum serviço cadastrado"
          description="Cadastre seu primeiro serviço para começar a receber agendamentos e registrar vendas."
          actionLabel="Cadastrar Serviço"
          onAction={handleNew}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((s: any) => (
            <Card key={s.id} className={`glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in ${!s.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-5">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} className="w-full h-32 rounded-lg object-cover mb-4" />
                ) : (
                  <div className="w-full h-32 rounded-lg bg-secondary/50 flex items-center justify-center mb-4">
                    <Scissors className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base leading-tight">{s.name}</h3>
                  <Badge variant="secondary" className="bg-primary/15 text-primary">{s.category}</Badge>
                </div>
                {s.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{s.description}</p>}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
                  </div>
                  <span className="text-lg font-bold text-primary">{formatCurrency(s.price)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Switch checked={s.is_active} onCheckedChange={() => handleToggleActive(s)} />
                    <span className="text-xs text-muted-foreground">{s.is_active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(s)} className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ServiceForm open={formOpen} onOpenChange={setFormOpen} service={editing} onSaved={() => queryClient.invalidateQueries({ queryKey: ['services'] })} />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir Serviço"
        description="Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Reajustar Preços"
        description="Informe o percentual de reajuste para todos os serviços ativos. Ex: 10 para aumentar 10%, -5 para diminuir 5%."
        confirmLabel="Aplicar"
        onConfirm={handleBulkUpdate}
      />
    </div>
  );
}
