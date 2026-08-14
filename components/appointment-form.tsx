'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { maskPhone } from '@/lib/format';
import type { Appointment, AppointmentStatus, AppointmentSource, Client, Collaborator, Service } from '@/lib/types';

interface AppointmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  defaultDate?: string;
  defaultCollaboratorId?: string;
  onSaved: () => void;
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'no_show', label: 'Não Compareceu' },
];

export function AppointmentForm({ open, onOpenChange, appointment, defaultDate, defaultCollaboratorId, onSaved }: AppointmentFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const [clientId, setClientId] = useState<string | null>(null);
  const [collaboratorId, setCollaboratorId] = useState<string>('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('scheduled');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<AppointmentSource>('manual');

  useEffect(() => {
    if (open) {
      loadData();
      if (appointment) {
        setClientId(appointment.client_id);
        setCollaboratorId(appointment.collaborator_id || '');
        setDate(appointment.appointment_date);
        setStartTime(appointment.start_time?.slice(0, 5) || '');
        setStatus(appointment.status);
        setNotes(appointment.notes);
        setSource(appointment.source);
        setSelectedServices(appointment.service_id ? [appointment.service_id] : []);
      } else {
        resetForm();
        if (defaultDate) setDate(defaultDate);
        if (defaultCollaboratorId) setCollaboratorId(defaultCollaboratorId);
      }
    }
  }, [open, appointment, defaultDate, defaultCollaboratorId]);

  const loadData = async () => {
    const [c, col, s] = await Promise.all([
      supabase.from('clients').select('*').order('full_name'),
      supabase.from('collaborators').select('*').eq('is_active', true).order('full_name'),
      supabase.from('services').select('*').eq('is_active', true).order('name'),
    ]);
    setClients(c.data || []);
    setCollaborators(col.data || []);
    setServices(s.data || []);
  };

  const resetForm = () => {
    setClientId(null); setSelectedClient(null); setCollaboratorId(''); setDate('');
    setStartTime(''); setStatus('scheduled'); setNotes(''); setSource('manual');
    setSelectedServices([]); setClientSearch('');
  };

  const filteredClients = clients.filter(c =>
    c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  ).slice(0, 5);

  const selectClient = (c: Client) => {
    setSelectedClient(c);
    setClientId(c.id);
    setClientSearch(c.full_name);
    setShowClientResults(false);
  };

  const handleQuickCreate = async () => {
    if (!newClientName.trim() || !newClientPhone.trim()) { toast.error('Nome e telefone são obrigatórios.'); return; }
    const { data, error } = await supabase.from('clients').insert({
      full_name: newClientName, phone: newClientPhone,
    }).select().single();
    if (error) { toast.error('Erro ao criar cliente.'); return; }
    setClients([...clients, data]);
    selectClient(data);
    setNewClientName(''); setNewClientPhone('');
    setQuickCreateOpen(false);
    toast.success('Cliente criado!');
  };

  const toggleService = (id: string) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const selectedServiceObjs = services.filter(s => selectedServices.includes(s.id));
  const totalDuration = selectedServiceObjs.reduce((sum, s) => sum + s.duration_minutes, 0);

  const calcEndTime = () => {
    if (!startTime || totalDuration === 0) return '';
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + totalDuration;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorId) { toast.error('Selecione um colaborador.'); return; }
    if (selectedServices.length === 0) { toast.error('Selecione pelo menos um serviço.'); return; }
    if (!date || !startTime) { toast.error('Data e hora são obrigatórias.'); return; }

    const endTime = calcEndTime();
    setLoading(true);

    try {
      const payload = {
        client_id: clientId,
        collaborator_id: collaboratorId,
        service_id: selectedServices[0],
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        status,
        notes,
        source,
        client_name: selectedClient?.full_name || '',
        client_phone: selectedClient?.phone || '',
        created_by: user?.id,
      };

      if (appointment) {
        const { error } = await supabase.from('appointments').update(payload).eq('id', appointment.id);
        if (error) throw error;
        toast.success('Agendamento atualizado!');
      } else {
        const { error } = await supabase.from('appointments').insert(payload);
        if (error) throw error;
        toast.success('Agendamento criado!');
      }
      onSaved();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar agendamento.');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl">{appointment ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          <DialogDescription>{appointment ? 'Atualize os dados do agendamento.' : 'Crie um novo agendamento.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Search */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <div className="relative">
              <Input
                placeholder="Buscar cliente por nome ou telefone..."
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setShowClientResults(true); }}
                onFocus={() => setShowClientResults(true)}
                className="bg-background/50"
              />
              {showClientResults && clientSearch && (
                <div className="absolute z-50 w-full mt-1 glass-strong rounded-lg border border-border/50 max-h-48 overflow-y-auto scrollbar-thin">
                  {filteredClients.map((c) => (
                    <button key={c.id} type="button" onClick={() => selectClient(c)} className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors text-sm">
                      <span className="font-medium">{c.full_name}</span>
                      <span className="text-muted-foreground ml-2">{c.phone}</span>
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                  )}
                  <button type="button" onClick={() => setQuickCreateOpen(true)} className="w-full text-left px-3 py-2 hover:bg-primary/10 transition-colors text-sm text-primary flex items-center gap-2 border-t border-border/50">
                    <UserPlus className="h-3.5 w-3.5" /> Criar novo cliente
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Create Client */}
          {quickCreateOpen && (
            <div className="glass rounded-lg p-3 space-y-2 border border-primary/30 animate-fade-in">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Novo Cliente</Label>
                <button type="button" onClick={() => setQuickCreateOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="bg-background/50" />
                <Input placeholder="Telefone" value={newClientPhone} onChange={(e) => setNewClientPhone(maskPhone(e.target.value))} className="bg-background/50" />
              </div>
              <Button type="button" size="sm" onClick={handleQuickCreate} className="gold-gradient text-charcoal">Criar e Selecionar</Button>
            </div>
          )}

          {/* Collaborator */}
          <div className="space-y-2">
            <Label>Colaborador *</Label>
            <Select value={collaboratorId} onValueChange={setCollaboratorId}>
              <SelectTrigger className="bg-background/50"><SelectValue placeholder="Selecione um barbeiro" /></SelectTrigger>
              <SelectContent>
                {collaborators.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Services */}
          <div className="space-y-2">
            <Label>Serviços *</Label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto scrollbar-thin">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                    selectedServices.includes(s.id)
                      ? 'bg-primary/15 border-primary text-primary'
                      : 'bg-background/50 border-border hover:border-primary/50'
                  }`}
                >
                  <span className="truncate">{s.name}</span>
                  <span className="text-xs whitespace-nowrap">{s.duration_minutes}min</span>
                </button>
              ))}
            </div>
            {totalDuration > 0 && (
              <p className="text-xs text-muted-foreground">
                Duração total: <span className="text-primary font-medium">{totalDuration} min</span>
                {startTime && <> • Término: <span className="text-primary font-medium">{calcEndTime()}</span></>}
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Horário *</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="bg-background/50" />
            </div>
          </div>

          {/* Status & Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus)}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={source} onValueChange={(v) => setSource(v as AppointmentSource)} disabled={!!appointment}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="link">Link Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas sobre o agendamento..." className="bg-background/50" rows={2} />
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
