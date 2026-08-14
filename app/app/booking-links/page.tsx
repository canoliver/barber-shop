'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { Plus, Copy, Link2, Check, ExternalLink, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { BookingLink, Collaborator } from '@/lib/types';

export default function BookingLinksPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookingLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: links, isLoading, isError, refetch } = useQuery<(BookingLink & { collaborator: Collaborator })[]>({
    queryKey: ['booking-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_links')
        .select('*, collaborator:collaborators!inner(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (BookingLink & { collaborator: Collaborator })[];
    },
  });

  const { data: collaborators } = useQuery<Collaborator[]>({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const { data } = await supabase.from('collaborators').select('*').eq('is_active', true).order('full_name');
      return data as Collaborator[];
    },
  });

  const copyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/agendar/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleActive = async (link: BookingLink) => {
    const { error } = await supabase.from('booking_links').update({ is_active: !link.is_active }).eq('id', link.id);
    if (error) toast.error('Erro ao atualizar link.');
    else { toast.success(link.is_active ? 'Link desativado.' : 'Link ativado!'); queryClient.invalidateQueries({ queryKey: ['booking-links'] }); }
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Links de Agendamento" description="Gerencie os links de agendamento online dos colaboradores.">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo Link
        </Button>
      </PageHeader>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : (links || []).length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-8 w-8" />}
          title="Nenhum link criado"
          description="Crie links de agendamento online para seus colaboradores e compartilhe com os clientes."
          actionLabel="Criar Link"
          onAction={() => { setEditing(null); setFormOpen(true); }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(links || []).map((link: BookingLink & { collaborator: Collaborator }) => (
            <Card key={link.id} className="glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{link.collaborator?.full_name || 'Colaborador'}</h3>
                    <p className="text-sm text-primary">/agendar/{link.slug}</p>
                  </div>
                  <Badge variant={link.is_active ? 'default' : 'secondary'} className={link.is_active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : ''}>
                    {link.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                {link.custom_message && <p className="text-sm text-muted-foreground mb-3 italic">"{link.custom_message}"</p>}
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 text-xs bg-background/50 px-3 py-2 rounded-lg overflow-hidden text-ellipsis">
                    {window.location.origin}/agendar/{link.slug}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => copyLink(link.slug, link.id)} className="h-9 w-9">
                    {copiedId === link.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <a href={`/agendar/${link.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="outline" className="h-9 w-9"><ExternalLink className="h-4 w-4" /></Button>
                  </a>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Switch checked={link.is_active} onCheckedChange={() => toggleActive(link)} />
                    <span className="text-xs text-muted-foreground">{link.is_active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(link); setFormOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LinkFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        link={editing}
        collaborators={collaborators || []}
        existingSlugs={((links as any[]) || []).map((l: any) => l.slug)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['booking-links'] })}
      />
    </div>
  );
}

function LinkFormDialog({ open, onOpenChange, link, collaborators, existingSlugs, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  link: BookingLink | null;
  collaborators: Collaborator[];
  existingSlugs: string[];
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [collaboratorId, setCollaboratorId] = useState('');
  const [slug, setSlug] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    if (link) { setCollaboratorId(link.collaborator_id); setSlug(link.slug); setCustomMessage(link.custom_message); }
  }, [link]);

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCollabChange = (id: string) => {
    setCollaboratorId(id);
    if (!link) {
      const col = collaborators.find(c => c.id === id);
      if (col) {
        let baseSlug = generateSlug(col.full_name);
        let uniqueSlug = baseSlug;
        let i = 1;
        while ((existingSlugs as string[]).includes(uniqueSlug)) {
          uniqueSlug = `${baseSlug}-${i++}`;
        }
        setSlug(uniqueSlug);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorId || !slug.trim()) { toast.error('Colaborador e slug são obrigatórios.'); return; }
    setLoading(true);
    const payload = { collaborator_id: collaboratorId, slug: slug.trim(), custom_message: customMessage, is_active: true };
    try {
      if (link) {
        const { error } = await supabase.from('booking_links').update(payload).eq('id', link.id);
        if (error) throw error;
        toast.success('Link atualizado!');
      } else {
        const { error } = await supabase.from('booking_links').insert(payload);
        if (error) throw error;
        toast.success('Link criado!');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message?.includes('duplicate') ? 'Este slug já está em uso.' : err.message || 'Erro ao salvar link.');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl">{link ? 'Editar Link' : 'Novo Link de Agendamento'}</DialogTitle>
          <DialogDescription>{link ? 'Atualize o link de agendamento.' : 'Crie um link de agendamento online.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Colaborador *</Label>
            <Select value={collaboratorId} onValueChange={handleCollabChange} disabled={!!link}>
              <SelectTrigger className="bg-background/50"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
              <SelectContent>
                {collaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL) *</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/agendar/</span>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="joao-silva" required className="bg-background/50" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem de Boas-Vindas</Label>
            <Textarea id="message" value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Ex: Bem-vindo! Agende seu horário comigo." className="bg-background/50" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="gold-gradient text-charcoal font-semibold">{loading ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
