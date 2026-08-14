'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ClientForm } from '@/components/client-form';
import { Pagination } from '@/components/pagination';
import { getInitials, formatPhone, formatDate } from '@/lib/format';
import { Plus, Search, Pencil, Trash2, Users, Gift, Download, Upload } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';

const ITEMS_PER_PAGE = 20;

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clients', search, page],
    queryFn: async () => {
      let query = supabase.from('clients').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      query = query.range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return { clients: data as Client[], total: count || 0 };
    },
  });

  const clients = data?.clients || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleEdit = (c: Client) => { setEditing(c); setFormOpen(true); };
  const handleNew = () => { setEditing(null); setFormOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { data: deletedClient, error } = await supabase
      .from('clients').delete().eq('id', deleteId).select('id').maybeSingle();

    if (error) {
      toast.error(`Erro ao excluir cliente: ${error.message}`);
    } else if (!deletedClient) {
      toast.error('Cliente não excluído. Verifique se seu usuário possui permissão.');
    } else {
      toast.success('Cliente excluído!');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
    setDeleteId(null);
  };

  const exportCSV = () => {
    const headers = ['Nome', 'Telefone', 'E-mail', 'Nascimento', 'Pontos', 'Criado em'];
    const rows = clients.map((c: any) => [
      c.full_name, c.phone, c.email, c.birth_date || '', c.loyalty_points, formatDate(c.created_at)
    ]);
    const csv = [headers, ...rows].map((r: any) => r.map((v: any) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Clientes exportados!');
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const rows = lines.slice(1).map(l => {
        const cols = l.match(/("([^"]*)"|([^,]*)),?/g)?.map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')) || [];
        return {
          full_name: cols[0] || '',
          phone: cols[1] || '',
          email: cols[2] || '',
          birth_date: cols[3] || null,
        };
      }).filter(r => r.full_name && r.phone);
      if (rows.length === 0) { toast.error('Nenhum cliente válido encontrado no CSV.'); return; }
      const { error } = await supabase.from('clients').upsert(rows, { onConflict: 'phone', ignoreDuplicates: true });
      if (error) toast.error('Erro ao importar clientes.');
      else { toast.success(`${rows.length} clientes importados!`); queryClient.invalidateQueries({ queryKey: ['clients'] }); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Birthday check
  const today = new Date();
  const birthdayThisMonth = clients.filter((c: any) => {
    if (!c.birth_date) return false;
    const [_, m] = c.birth_date.split('-');
    return parseInt(m) === today.getMonth() + 1;
  });

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Clientes" description="Gerencie a base de clientes da barbearia.">
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Exportar</Button>
        <label>
          <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-2" /> Importar</span></Button>
          <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
        </label>
        <Button onClick={handleNew} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo Cliente
        </Button>
      </PageHeader>

      {birthdayThisMonth.length > 0 && (
        <Card className="glass border-primary/30 mb-4 animate-fade-in">
          <CardContent className="p-4 flex items-center gap-3">
            <Gift className="h-5 w-5 text-primary" />
            <p className="text-sm">
              <strong className="text-primary">{birthdayThisMonth.length} cliente(s)</strong> fazem aniversário este mês!
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10 bg-background/50" />
      </div>

      {isLoading ? (
        <ListSkeleton count={8} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Nenhum cliente cadastrado"
          description="Cadastre seu primeiro cliente para começar a registrar agendamentos e vendas."
          actionLabel="Cadastrar Cliente"
          onAction={handleNew}
        />
      ) : (
        <>
          <div className="space-y-2">
            {clients.map((c: any) => (
              <Card key={c.id} className="glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in">
                <CardContent className="p-4 flex items-center gap-4">
                  <Link href={`/app/clients/${c.id}`}>
                    <Avatar className="h-12 w-12 border border-border cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold">{getInitials(c.full_name)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <Link href={`/app/clients/${c.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate hover:text-primary transition-colors">{c.full_name}</h3>
                      {c.loyalty_points > 0 && (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                          {c.loyalty_points} pts
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatPhone(c.phone)}</span>
                      {c.email && <span className="hidden sm:inline truncate">{c.email}</span>}
                      <span className="hidden md:inline">Cadastrado em {formatDate(c.created_at)}</span>
                    </div>
                  </Link>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(c)} className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemsPerPage={ITEMS_PER_PAGE} />
        </>
      )}

      <ClientForm open={formOpen} onOpenChange={setFormOpen} client={editing} onSaved={() => queryClient.invalidateQueries({ queryKey: ['clients'] })} />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? O histórico de agendamentos e vendas será mantido."
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
