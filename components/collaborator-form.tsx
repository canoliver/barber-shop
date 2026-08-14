'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth-context';
import { getWeekdayShort } from '@/lib/format';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Collaborator, Profile } from '@/lib/types';

interface CollaboratorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator?: Collaborator | null;
  onSaved: () => void;
}

const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '0'];
const WEEKDAY_LABELS: Record<string, string> = {
  '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb',
};

export function CollaboratorForm({ open, onOpenChange, collaborator, onSaved }: CollaboratorFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [commission, setCommission] = useState('40');
  const [workDays, setWorkDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('19:00');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (collaborator) {
      setFullName(collaborator.full_name);
      setNickname(collaborator.nickname);
      setPhone(collaborator.phone);
      setEmail(collaborator.email);
      setSpecialty(collaborator.specialty);
      setCommission(String(collaborator.commission_percentage));
      setWorkDays(collaborator.work_days || []);
      setWorkStart(collaborator.work_hours_start?.slice(0, 5) || '09:00');
      setWorkEnd(collaborator.work_hours_end?.slice(0, 5) || '19:00');
      setBreakStart(collaborator.break_start?.slice(0, 5) || '');
      setBreakEnd(collaborator.break_end?.slice(0, 5) || '');
      setAvatarUrl(collaborator.avatar_url);
      setProfileId(collaborator.profile_id);
    } else {
      resetForm();
    }
  }, [collaborator, open]);

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'barber')
      .eq('is_active', true);
    setAvailableProfiles(data || []);
  };

  const resetForm = () => {
    setFullName('');
    setNickname('');
    setPhone('');
    setEmail('');
    setSpecialty('');
    setCommission('40');
    setWorkDays(['1', '2', '3', '4', '5']);
    setWorkStart('09:00');
    setWorkEnd('19:00');
    setBreakStart('');
    setBreakEnd('');
    setAvatarUrl('');
    setProfileId(null);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `collaborators/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
      toast.success('Foto enviada com sucesso!');
    } catch {
      toast.error('Erro ao enviar foto.');
    }
    setLoading(false);
  };

  const toggleWorkDay = (day: string) => {
    setWorkDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Nome completo é obrigatório.');
      return;
    }
    setLoading(true);
    const payload = {
      full_name: fullName,
      nickname,
      phone,
      email,
      specialty,
      commission_percentage: parseFloat(commission) || 0,
      work_days: workDays,
      work_hours_start: workStart,
      work_hours_end: workEnd,
      break_start: breakStart || null,
      break_end: breakEnd || null,
      avatar_url: avatarUrl,
      profile_id: profileId,
      is_active: true,
    };

    try {
      if (collaborator) {
        const { error } = await supabase.from('collaborators').update(payload).eq('id', collaborator.id);
        if (error) throw error;
        toast.success('Colaborador atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('collaborators').insert(payload);
        if (error) throw error;
        toast.success('Colaborador cadastrado com sucesso!');
      }
      onSaved();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar colaborador.');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl">{collaborator ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
          <DialogDescription>{collaborator ? 'Atualize os dados do colaborador.' : 'Cadastre um novo barbeiro ou funcionário.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary/30" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-2xl font-bold">
                  {fullName.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full gold-gradient flex items-center justify-center cursor-pointer text-charcoal">
                <Upload className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div className="flex-1">
              <Label htmlFor="fullName">Nome Completo *</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do colaborador" required className="bg-background/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Apelido</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Apelido" className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidade</Label>
              <Input id="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex: Cortes clássicos" className="bg-background/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-background/50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="commission">Comissão (%)</Label>
            <Input id="commission" type="number" min="0" max="100" step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} className="bg-background/50" />
          </div>

          <div className="space-y-2">
            <Label>Conta de Usuário (para login)</Label>
            <Select value={profileId || 'none'} onValueChange={(v) => setProfileId(v === 'none' ? null : v)}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Vincular a um usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem conta de usuário</SelectItem>
                {availableProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.email || 'sem email'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Work Days */}
          <div className="space-y-2">
            <Label>Dias de Trabalho</Label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={workDays.includes(day)} onCheckedChange={() => toggleWorkDay(day)} />
                  <span className="text-sm">{WEEKDAY_LABELS[day]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Work Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workStart">Início do Expediente</Label>
              <Input id="workStart" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workEnd">Fim do Expediente</Label>
              <Input id="workEnd" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="bg-background/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakStart">Início do Intervalo</Label>
              <Input id="breakStart" type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="breakEnd">Fim do Intervalo</Label>
              <Input id="breakEnd" type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="bg-background/50" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
