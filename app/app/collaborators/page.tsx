'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CollaboratorForm } from '@/components/collaborator-form';
import { getInitials, formatCurrency, getWeekdayShort } from '@/lib/format';
import { Plus, Search, Pencil, Trash2, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Collaborator } from '@/lib/types';

export default function CollaboratorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: collaborators, isLoading, isError, refetch } = useQuery({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Collaborator[];
    },
  });

  const filtered = (collaborators || []).filter((c: any) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.nickname.toLowerCase().includes(search.toLowerCase()) ||
    c.specialty.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (c: Collaborator) => {
    setEditing(c);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('collaborators').delete().eq('id', deleteId);
    if (error) {
      toast.error('Erro ao excluir colaborador.');
    } else {
      toast.success('Colaborador excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    }
    setDeleteId(null);
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Colaboradores" description="Gerencie barbeiros e funcionários da barbearia.">
        <Button onClick={handleNew} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
        </Button>
      </PageHeader>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, apelido ou especialidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background/50"
        />
      </div>

      {isLoading ? (
        <ListSkeleton count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserCircle className="h-8 w-8" />}
          title="Nenhum colaborador cadastrado"
          description="Cadastre seu primeiro barbeiro ou funcionário para começar a gerenciar agendamentos e comissões."
          actionLabel="Cadastrar Colaborador"
          onAction={handleNew}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => (
            <Card key={c.id} className="glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-14 w-14 border border-border">
                    {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.full_name} />}
                    <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                      {getInitials(c.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{c.full_name}</h3>
                    {c.nickname && <p className="text-sm text-muted-foreground">"{c.nickname}"</p>}
                    <Badge variant={c.is_active ? 'default' : 'secondary'} className={`mt-1 ${c.is_active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : ''}`}>
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {c.specialty && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs">Especialidade:</span>
                      <span className="text-foreground">{c.specialty}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">Comissão:</span>
                    <span className="text-primary font-medium">{c.commission_percentage}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">Dias:</span>
                    <div className="flex gap-1">
                      {(c.work_days || []).sort().map((day: any) => (
                        <span key={day} className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                          {getWeekdayShort(day)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">Horário:</span>
                    <span className="text-foreground">{c.work_hours_start?.slice(0, 5)} - {c.work_hours_end?.slice(0, 5)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(c)} className="flex-1">
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteId(c.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CollaboratorForm
        open={formOpen}
        onOpenChange={setFormOpen}
        collaborator={editing}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['collaborators'] })}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir Colaborador"
        description="Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
