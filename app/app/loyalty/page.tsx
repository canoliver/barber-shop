'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatCurrency, getRewardTypeLabel } from '@/lib/format';
import { Gift, Plus, Pencil, Trash2, Star, Award } from 'lucide-react';
import { toast } from 'sonner';
import type { LoyaltyReward, RewardType } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

export default function LoyaltyPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyReward | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rewards, isLoading, isError, refetch } = useQuery({
    queryKey: ['loyalty-rewards'],
    queryFn: async () => {
      const { data } = await supabase.from('loyalty_rewards').select('*').order('points_required');
      return data as LoyaltyReward[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
      return data;
    },
  });

  const { data: topClients } = useQuery({
    queryKey: ['top-loyalty-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('full_name, loyalty_points, phone').gt('loyalty_points', 0).order('loyalty_points', { ascending: false }).limit(10);
      return data || [];
    },
  });

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Programa de Fidelidade" description="Configure recompensas e pontos para clientes fiéis.">
        {canManage && <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gold-gradient text-charcoal font-semibold"><Plus className="h-4 w-4 mr-2" /> Nova Recompensa</Button>}
      </PageHeader>

      {/* Settings Card */}
      <Card className="glass border-border/50 mb-6 animate-fade-in">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Star className="h-6 w-6 text-amber-400" /></div>
            <div className="flex-1">
              <p className="font-medium">Regra de Pontos</p>
              <p className="text-sm text-muted-foreground">A cada R$ 1,00 gasto = {settings?.points_per_real || 1} ponto(s)</p>
            </div>
            <Badge variant={settings?.loyalty_enabled ? 'default' : 'secondary'} className={settings?.loyalty_enabled ? 'bg-emerald-500/20 text-emerald-300' : ''}>{settings?.loyalty_enabled ? 'Ativo' : 'Inativo'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Rewards Grid */}
      {isLoading ? <ListSkeleton count={3} /> : (rewards || []).length === 0 ? (
        <EmptyState icon={<Gift className="h-8 w-8" />} title="Nenhuma recompensa criada" description="Ainda n?o existem recompensas cadastradas." {...(canManage ? { actionLabel: 'Criar Recompensa', onAction: () => { setEditing(null); setFormOpen(true); } } : {})} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {(rewards || []).map((r: any) => (
            <Card key={r.id} className="glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Award className="h-6 w-6 text-amber-400" /></div>
                  <Badge variant={r.is_active ? 'default' : 'secondary'} className={r.is_active ? 'bg-emerald-500/20 text-emerald-300' : ''}>{r.is_active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                <h3 className="font-semibold mb-1">{r.name}</h3>
                {r.description && <p className="text-sm text-muted-foreground mb-3">{r.description}</p>}
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary" className="bg-primary/15 text-primary">{getRewardTypeLabel(r.reward_type)}</Badge>
                  <span className="text-lg font-bold text-amber-400">{r.points_required} pts</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Valor: {formatCurrency(r.reward_value)}</p>
                {canManage && <div className="flex gap-2 pt-3 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(r); setFormOpen(true); }} className="flex-1"><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteId(r.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Top Clients */}
      <Card className="glass border-border/50">
        <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><Star className="h-5 w-5 text-amber-400" /> Clientes com Mais Pontos</CardTitle></CardHeader>
        <CardContent>
          {(topClients || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente com pontos ainda.</p> : (
            <div className="space-y-2">
              {(topClients || []).map((c: any, i: number) => (
                <div key={c.phone} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 text-sm font-bold">{i + 1}</div>
                  <div className="flex-1"><p className="font-medium">{c.full_name}</p><p className="text-xs text-muted-foreground">{c.phone}</p></div>
                  <span className="font-bold text-amber-400">{c.loyalty_points} pts</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RewardFormDialog open={formOpen} onOpenChange={setFormOpen} reward={editing} onSaved={() => queryClient.invalidateQueries({ queryKey: ['loyalty-rewards'] })} />
      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} title="Excluir Recompensa" description="Tem certeza que deseja excluir esta recompensa?" confirmLabel="Excluir" destructive onConfirm={async () => { if (deleteId) { await supabase.from('loyalty_rewards').delete().eq('id', deleteId); toast.success('Recompensa excluída!'); queryClient.invalidateQueries({ queryKey: ['loyalty-rewards'] }); } setDeleteId(null); }} />
    </div>
  );
}

function RewardFormDialog({ open, onOpenChange, reward, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; reward: LoyaltyReward | null; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const [type, setType] = useState<RewardType>('discount');
  const [value, setValue] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (reward) { setName(reward.name); setDescription(reward.description); setPoints(String(reward.points_required)); setType(reward.reward_type); setValue(String(reward.reward_value).replace('.', ',')); setIsActive(reward.is_active); }
    else { setName(''); setDescription(''); setPoints(''); setType('discount'); setValue(''); setIsActive(true); }
  }, [reward, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name, description, points_required: parseInt(points) || 0, reward_type: type, reward_value: parseFloat(value.replace(',', '.')) || 0, is_active: isActive };
    try {
      if (reward) { const { error } = await supabase.from('loyalty_rewards').update(payload).eq('id', reward.id); if (error) throw error; toast.success('Recompensa atualizada!'); }
      else { const { error } = await supabase.from('loyalty_rewards').insert(payload); if (error) throw error; toast.success('Recompensa criada!'); }
      onSaved(); onOpenChange(false);
    } catch (err: any) { toast.error(err.message || 'Erro ao salvar.'); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 max-w-md">
        <DialogHeader><DialogTitle className="font-playfair text-xl">{reward ? 'Editar Recompensa' : 'Nova Recompensa'}</DialogTitle><DialogDescription>{reward ? 'Atualize os dados da recompensa.' : 'Crie uma nova recompensa.'}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="name">Nome *</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background/50" /></div>
          <div className="space-y-2"><Label htmlFor="description">Descrição</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background/50" rows={2} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="points">Pontos Necessários</Label><Input id="points" type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} className="bg-background/50" /></div>
            <div className="space-y-2"><Label>Tipo</Label><Select value={type} onValueChange={(v) => setType(v as RewardType)}><SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="discount">Desconto</SelectItem><SelectItem value="free_service">Serviço Grátis</SelectItem><SelectItem value="product">Produto Grátis</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="value">Valor (R$)</Label><Input id="value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" className="bg-background/50" /></div>
          <div className="flex items-center justify-between"><Label htmlFor="active">Recompensa ativa</Label><Switch checked={isActive} onCheckedChange={setIsActive} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading} className="gold-gradient text-charcoal font-semibold">{loading ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
