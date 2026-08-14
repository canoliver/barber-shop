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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, ExternalLink, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MyLinkPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const { data: collaborator } = useQuery({
    queryKey: ['my-collaborator', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('collaborators').select('*').eq('profile_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: link } = useQuery({
    queryKey: ['my-booking-link', collaborator?.id],
    queryFn: async () => {
      if (!collaborator) return null;
      const { data } = await supabase.from('booking_links').select('*').eq('collaborator_id', collaborator.id).maybeSingle();
      return data;
    },
    enabled: !!collaborator,
  });

  const copyLink = () => {
    if (!link) return;
    const url = `${window.location.origin}/agendar/${link.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveMessage = async () => {
    if (!link) return;
    setSaving(true);
    const { error } = await supabase.from('booking_links').update({ custom_message: customMessage }).eq('id', link.id);
    if (error) toast.error('Erro ao salvar mensagem.');
    else { toast.success('Mensagem atualizada!'); queryClient.invalidateQueries({ queryKey: ['my-booking-link'] }); }
    setSaving(false);
  };

  const toggleActive = async () => {
    if (!link) return;
    const { error } = await supabase.from('booking_links').update({ is_active: !link.is_active }).eq('id', link.id);
    if (error) toast.error('Erro ao atualizar link.');
    else { toast.success(link.is_active ? 'Link desativado.' : 'Link ativado!'); queryClient.invalidateQueries({ queryKey: ['my-booking-link'] }); }
  };

  if (!collaborator) {
    return (
      <div>
        <PageHeader title="Meu Link" description="Seu link de agendamento online." />
        <Card className="glass border-border/50"><CardContent className="p-8 text-center"><p className="text-muted-foreground">Você não está vinculado a um colaborador. Peça ao administrador para vincular sua conta.</p></CardContent></Card>
      </div>
    );
  }

  if (!link) {
    return (
      <div>
        <PageHeader title="Meu Link" description="Seu link de agendamento online." />
        <Card className="glass border-border/50"><CardContent className="p-8 text-center"><p className="text-muted-foreground">Você ainda não tem um link de agendamento. Peça ao administrador para criar um link para você.</p></CardContent></Card>
      </div>
    );
  }

  const linkUrl = `${window.location.origin}/agendar/${link.slug}`;

  return (
    <div>
      <PageHeader title="Meu Link" description="Compartilhe seu link de agendamento com clientes." />

      <div className="max-w-2xl space-y-6">
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center"><Link2 className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-medium">Link de Agendamento</p>
                  <Badge variant={link.is_active ? 'default' : 'secondary'} className={link.is_active ? 'bg-emerald-500/20 text-emerald-300' : ''}>{link.is_active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
              </div>
              <Switch checked={link.is_active} onCheckedChange={toggleActive} />
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-background/50 px-4 py-3 rounded-lg overflow-hidden text-ellipsis border border-border">{linkUrl}</code>
              <Button size="icon" variant="outline" onClick={copyLink} className="h-11 w-11">{copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</Button>
              <a href={`/agendar/${link.slug}`} target="_blank" rel="noopener noreferrer"><Button size="icon" variant="outline" className="h-11 w-11"><ExternalLink className="h-4 w-4" /></Button></a>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-6 space-y-4">
            <Label htmlFor="message">Mensagem de Boas-Vindas</Label>
            <Textarea id="message" value={customMessage || link.custom_message} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Ex: Bem-vindo! Agende seu horário comigo." className="bg-background/50" rows={3} />
            <Button onClick={handleSaveMessage} disabled={saving} className="gold-gradient text-charcoal font-semibold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Mensagem'}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
