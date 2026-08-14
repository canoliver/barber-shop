'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useRequireRole } from '@/lib/auth-guards';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatCurrency, getRoleLabel, getRoleColor, formatDate } from '@/lib/format';
import { Save, Upload, UserCog, Loader2, Store, Calendar, Bell, Gift, Database } from 'lucide-react';
import { toast } from 'sonner';
import type { Settings, Profile, UserRole } from '@/lib/types';

export default function SettingsPage() {
  useRequireRole(['admin']);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [roleChangeId, setRoleChangeId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('barber');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
      return data as Settings | null;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      return data as Profile[];
    },
  });

  const [form, setForm] = useState<Partial<Settings>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const update = (key: keyof Settings, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const shopName = form.shop_name?.trim();
    if (!shopName) {
      toast.error('Informe o nome da barbearia.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('settings')
      .update({ ...form, shop_name: shopName })
      .eq('id', 1)
      .select('*')
      .single();

    if (error || !data) {
      toast.error(error?.message || 'Não foi possível salvar as configurações.');
    } else {
      const savedSettings = data as Settings;
      setForm(savedSettings);
      queryClient.setQueryData(['settings'], savedSettings);
      queryClient.invalidateQueries({ queryKey: ['public-brand'] });
      toast.success('Configurações salvas e aplicadas!');
    }
    setSaving(false);
  };
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('barbershop').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro ao enviar logo.'); return; }
    const { data: { publicUrl } } = supabase.storage.from('barbershop').getPublicUrl(path);
    update('logo_url', `${publicUrl}?v=${Date.now()}`);
    toast.success('Logo atualizado!');
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', deactivateId);
    if (error) toast.error('Erro ao desativar usuário.');
    else { toast.success('Usuário desativado!'); queryClient.invalidateQueries({ queryKey: ['profiles'] }); }
    setDeactivateId(null);
  };

  const handleRoleChange = async () => {
    if (!roleChangeId) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', roleChangeId);
    if (error) toast.error('Erro ao alterar função.');
    else { toast.success('Função alterada!'); queryClient.invalidateQueries({ queryKey: ['profiles'] }); }
    setRoleChangeId(null);
  };

  const exportData = async () => {
    const tables = ['clients', 'services', 'collaborators', 'products', 'appointments', 'sales', 'commissions', 'financial_transactions'];
    const data: any = {};
    for (const t of tables) {
      const { data: rows } = await supabase.from(t).select('*');
      data[t] = rows;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `barberpro-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Dados exportados!');
  };

  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie as configurações do sistema.">
        <Button onClick={handleSave} disabled={saving} className="gold-gradient text-charcoal font-semibold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Salvar</>}</Button>
      </PageHeader>

      <div className="space-y-6">
        {/* Barbershop Profile */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Perfil da Barbearia</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.logo_url ? <img src={form.logo_url} alt="Logo" className="w-20 h-20 rounded-xl object-cover border border-border" /> : <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground"><Store className="h-8 w-8" /></div>}
                <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gold-gradient flex items-center justify-center cursor-pointer text-charcoal"><Upload className="h-3.5 w-3.5" /><input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} /></label>
              </div>
              <div className="flex-1 space-y-2"><Label htmlFor="shopName">Nome da Barbearia</Label><Input id="shopName" value={form.shop_name || ''} onChange={(e) => update('shop_name', e.target.value)} className="bg-background/50" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="phone">Telefone</Label><Input id="phone" value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} className="bg-background/50" /></div>
              <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" value={form.email || ''} onChange={(e) => update('email', e.target.value)} className="bg-background/50" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={form.cnpj || ''} onChange={(e) => update('cnpj', e.target.value)} className="bg-background/50" /></div>
              <div className="space-y-2"><Label htmlFor="address">Endereço</Label><Input id="address" value={form.address || ''} onChange={(e) => update('address', e.target.value)} className="bg-background/50" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="opening">Abertura</Label><Input id="opening" type="time" value={form.opening_time || '09:00'} onChange={(e) => update('opening_time', e.target.value)} className="bg-background/50" /></div>
              <div className="space-y-2"><Label htmlFor="closing">Fechamento</Label><Input id="closing" type="time" value={form.closing_time || '19:00'} onChange={(e) => update('closing_time', e.target.value)} className="bg-background/50" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label htmlFor="instagram">Instagram</Label><Input id="instagram" value={form.instagram || ''} onChange={(e) => update('instagram', e.target.value)} className="bg-background/50" /></div>
              <div className="space-y-2"><Label htmlFor="facebook">Facebook</Label><Input id="facebook" value={form.facebook || ''} onChange={(e) => update('facebook', e.target.value)} className="bg-background/50" /></div>
              <div className="space-y-2"><Label htmlFor="whatsapp">WhatsApp</Label><Input id="whatsapp" value={form.whatsapp || ''} onChange={(e) => update('whatsapp', e.target.value)} className="bg-background/50" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Appointment Settings */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Agendamentos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Intervalo de Tempo</Label><Select value={String(form.slot_interval_minutes || 30)} onValueChange={(v) => update('slot_interval_minutes', parseInt(v))}><SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 minutos</SelectItem><SelectItem value="30">30 minutos</SelectItem><SelectItem value="60">1 hora</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Máximo de Dias Antecipados</Label><Input type="number" value={form.max_advance_booking_days || 30} onChange={(e) => update('max_advance_booking_days', parseInt(e.target.value))} className="bg-background/50" /></div>
            </div>
            <div className="flex items-center justify-between"><div><Label>Agendamento Online</Label><p className="text-sm text-muted-foreground">Permitir agendamentos via link</p></div><Switch checked={form.allow_online_booking ?? true} onCheckedChange={(v) => update('allow_online_booking', v)} /></div>
            <div className="space-y-2"><Label htmlFor="policy">Política de Cancelamento</Label><Textarea id="policy" value={form.cancellation_policy || ''} onChange={(e) => update('cancellation_policy', e.target.value)} className="bg-background/50" rows={3} /></div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Notificações</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between"><div><Label>Notificações por E-mail</Label><p className="text-sm text-muted-foreground">Enviar e-mails para novos agendamentos</p></div><Switch checked={form.email_notifications ?? true} onCheckedChange={(v) => update('email_notifications', v)} /></div>
          </CardContent>
        </Card>

        {/* Loyalty Settings */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Fidelidade</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><div><Label>Programa Ativo</Label><p className="text-sm text-muted-foreground">Ativar programa de fidelidade</p></div><Switch checked={form.loyalty_enabled ?? true} onCheckedChange={(v) => update('loyalty_enabled', v)} /></div>
            <div className="space-y-2"><Label htmlFor="points">Pontos por R$1,00</Label><Input id="points" type="number" step="0.1" value={form.points_per_real || 1} onChange={(e) => update('points_per_real', parseFloat(e.target.value))} className="bg-background/50" /></div>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" /> Usuários do Sistema</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Função</TableHead><TableHead>Status</TableHead><TableHead>Criado em</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(profiles || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}{p.id === user?.id && ' (Você)'}</TableCell>
                      <TableCell><Badge variant="secondary" className={getRoleColor(p.role)}>{getRoleLabel(p.role)}</Badge></TableCell>
                      <TableCell><Badge variant={p.is_active ? 'default' : 'secondary'} className={p.is_active ? 'bg-emerald-500/20 text-emerald-300' : ''}>{p.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {p.id !== user?.id && (
                          <div className="flex gap-1 justify-end">
                            <Select value={p.role} onValueChange={(v) => { setRoleChangeId(p.id); setNewRole(v as UserRole); }}>
                              <SelectTrigger className="h-8 w-32 bg-background/50"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="admin">Administrador</SelectItem><SelectItem value="barber">Barbeiro</SelectItem><SelectItem value="receptionist">Recepcionista</SelectItem></SelectContent>
                            </Select>
                            {p.is_active && <Button size="sm" variant="outline" onClick={() => setDeactivateId(p.id)} className="h-8 text-destructive">Desativar</Button>}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Data Backup */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> Backup de Dados</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Exporte todos os dados do sistema em formato JSON para backup.</p>
            <Button onClick={exportData} variant="outline"><Database className="h-4 w-4 mr-2" /> Exportar Dados (JSON)</Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={!!deactivateId} onOpenChange={(o) => !o && setDeactivateId(null)} title="Desativar Usuário" description="O usuário perderá acesso ao sistema. Pode ser reativado depois." confirmLabel="Desativar" destructive onConfirm={handleDeactivate} />
      <ConfirmDialog open={!!roleChangeId} onOpenChange={(o) => !o && setRoleChangeId(null)} title="Alterar Função" description={`Alterar a função para ${getRoleLabel(newRole)}? Isso mudará as permissões do usuário.`} confirmLabel="Confirmar" onConfirm={handleRoleChange} />
    </div>
  );
}
