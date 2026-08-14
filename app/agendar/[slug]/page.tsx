'use client';

import { BrandLogo, BrandName } from '@/components/brand';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Scissors, Clock, DollarSign, CheckCircle2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { formatCurrency, maskPhone } from '@/lib/format';
import { toast } from 'sonner';
import type { Service, Collaborator, BookingLink, Appointment } from '@/lib/types';

const STEP_LABELS = ['service', 'datetime', 'info'] as const;
type Step = typeof STEP_LABELS[number];

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const slug = params.slug as string;

  const [step, setStep] = useState<Step>('service');
  const [link, setLink] = useState<BookingLink | null>(null);
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (authLoading) return;
    const bookingPath = `/agendar/${slug}`;
    if (!user) {
      router.replace(`/cliente/login?next=${encodeURIComponent(bookingPath)}`);
      return;
    }
    if (user.role !== 'client') {
      router.replace('/app');
      return;
    }
    if (user.must_change_password) {
      router.replace(`/cliente/primeiro-acesso?next=${encodeURIComponent(bookingPath)}`);
      return;
    }
    loadData();
  }, [slug, user, authLoading, router]);

  const loadData = async () => {
    const { data: linkData } = await supabase
      .from('booking_links')
      .select('*, collaborator:collaborators!inner(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (!linkData) { setLoading(false); return; }
    setLink(linkData as BookingLink);
    setCollaborator((linkData as any).collaborator as Collaborator);
    const { data: svcData } = await supabase.from('services').select('*').eq('is_active', true).order('name');
    setServices(svcData || []);

    if (user) {
      setClientName(user.full_name || '');
      setClientPhone(user.phone || '');
      setClientEmail(user.email || '');

      let { data: registeredClient } = await supabase
        .from('clients')
        .select('id, full_name, phone, email')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!registeredClient && user.email) {
        const fallback = await supabase
          .from('clients')
          .select('id, full_name, phone, email')
          .eq('email', user.email)
          .maybeSingle();
        registeredClient = fallback.data;
        if (registeredClient) {
          await supabase.from('clients').update({ auth_user_id: user.id }).eq('id', registeredClient.id);
        }
      }

      if (registeredClient) {
        setClientId(registeredClient.id);
        setClientName(registeredClient.full_name || user.full_name || '');
        setClientPhone(registeredClient.phone || user.phone || '');
        setClientEmail(registeredClient.email || user.email || '');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedDate && collaborator) { loadSlots(); }
  }, [selectedDate, collaborator]);

  useEffect(() => {
    if (!confirmed) return;

    const redirectTimer = window.setTimeout(() => {
      router.replace('/acompanhar?tab=agendamentos');
    }, 4000);

    return () => window.clearTimeout(redirectTimer);
  }, [confirmed, router]);
  const loadSlots = async () => {
    if (!collaborator) return;
    const dayOfWeek = String(new Date(selectedDate + 'T00:00:00').getDay());
    if (!(collaborator.work_days || []).includes(dayOfWeek)) { setAvailableSlots([]); return; }
    const { data: existing } = await supabase
      .from('appointments')
      .select('start_time, end_time, status')
      .eq('appointment_date', selectedDate)
      .eq('collaborator_id', collaborator.id)
      .neq('status', 'cancelled');
    const booked = new Set<string>();
    (existing || []).forEach((a: any) => booked.add(a.start_time?.slice(0, 5)));
    setBookedSlots(booked);
    const start = collaborator.work_hours_start?.slice(0, 5) || '09:00';
    const end = collaborator.work_hours_end?.slice(0, 5) || '19:00';
    const breakS = collaborator.break_start?.slice(0, 5);
    const breakE = collaborator.break_end?.slice(0, 5);
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const slots: string[] = [];
    let curMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (curMin < endMin) {
      const h = Math.floor(curMin / 60);
      const m = curMin % 60;
      const slot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!(breakS && breakE && slot >= breakS && slot < breakE)) { slots.push(slot); }
      curMin += 30;
    }
    setAvailableSlots(slots);
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: { date: Date; isCurrentMonth: boolean; isPast: boolean; isWorkDay: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false, isPast: d < new Date(new Date().setHours(0, 0, 0, 0)), isWorkDay: false });
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dow = String(d.getDay());
      const isWorkDay = (collaborator?.work_days || []).includes(dow);
      days.push({ date: d, isCurrentMonth: true, isPast: d < today, isWorkDay });
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      days.push({ date: d, isCurrentMonth: false, isPast: d < today, isWorkDay: false });
    }
    return days;
  };

  const handleSubmit = async () => {
    if (!clientName.trim() || !clientPhone.trim()) { toast.error('Nome e telefone sao obrigatorios.'); return; }
    if (!selectedService || !selectedDate || !selectedTime || !collaborator) return;
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', selectedDate)
        .eq('collaborator_id', collaborator.id)
        .eq('start_time', selectedTime + ':00')
        .neq('status', 'cancelled')
        .maybeSingle();
      if (existing) { toast.error('Este horario acabou de ser agendado. Escolha outro.'); setSubmitting(false); return; }
      const [h, m] = selectedTime.split(':').map(Number);
      const totalMin = h * 60 + m + selectedService.duration_minutes;
      const endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
      let appointmentClientId = clientId;
      if (!appointmentClientId && user) {
        const { data: createdClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            auth_user_id: user.id,
            full_name: clientName.trim(),
            phone: clientPhone.trim(),
            email: clientEmail.trim().toLowerCase() || user.email,
          })
          .select('id')
          .single();
        if (clientError) throw clientError;
        appointmentClientId = createdClient.id;
        setClientId(createdClient.id);
      }
      const { data, error } = await supabase.from('appointments').insert({
        client_id: appointmentClientId,
        collaborator_id: collaborator.id,
        service_id: selectedService.id,
        appointment_date: selectedDate,
        start_time: selectedTime + ':00',
        end_time: endTime + ':00',
        status: 'scheduled',
        source: 'link',
        client_name: clientName,
        client_phone: clientPhone,
      }).select().single();
      if (error) throw error;
      setConfirmed(data as Appointment);
      setStep('info');
    } catch (err: any) {
      toast.error('Erro ao agendar. Tente novamente.');
    }
    setSubmitting(false);
  };

  if (authLoading || !user || user.role !== 'client' || user.must_change_password || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!link || !collaborator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="glass-strong border-border/50 max-w-md text-center">
          <CardContent className="p-8">
            <Scissors className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-playfair text-xl font-bold mb-2">Link indisponivel</h1>
            <p className="text-sm text-muted-foreground">Este link de agendamento nao esta ativo ou nao existe.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />
        <Card className="glass-strong border-border/50 max-w-md w-full relative z-10 animate-scale-in">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h1 className="font-playfair text-2xl font-bold mb-2">Agendamento Confirmado!</h1>
            <p className="text-muted-foreground text-sm mb-6">Seu horario foi reservado com sucesso.</p>
            <div className="glass rounded-lg p-4 space-y-2 text-left text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Servico:</span> <span className="font-medium">{selectedService?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Barbeiro:</span> <span className="font-medium">{collaborator.full_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Horario:</span> <span className="font-medium">{selectedTime}</span></div>
            </div>
            <Button onClick={() => router.replace('/acompanhar?tab=agendamentos')} className="w-full mt-6 gold-gradient text-charcoal font-semibold">
              Ir para meus agendamentos
            </Button>
            <p className="text-xs text-muted-foreground mt-3">Você será redirecionado automaticamente para sua área.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-2xl mx-auto py-8">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="w-16 h-16 rounded-2xl mb-4" iconClassName="h-8 w-8" />
          <h1 className="font-playfair text-3xl font-bold gold-text"><BrandName /></h1>
          <p className="text-muted-foreground mt-2">Agendamento com {collaborator.full_name}</p>
          {link.custom_message && <p className="text-sm text-muted-foreground mt-1 italic">&quot;{link.custom_message}&quot;</p>}
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEP_LABELS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? 'bg-primary text-primary-foreground' :
                STEP_LABELS.indexOf(step) > i ? 'bg-emerald-500/30 text-emerald-300' : 'bg-secondary text-muted-foreground'
              }`}>
                {STEP_LABELS.indexOf(step) > i ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {i < 2 && <div className="w-8 h-0.5 bg-border" />}
            </div>
          ))}
        </div>

        <Card className="glass-strong border-border/50">
          <CardContent className="p-6">
            {step === 'service' && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="font-playfair text-xl font-semibold mb-4">Escolha o Servico</h2>
                <div className="space-y-2">
                  {services.map(s => (
                    <button key={s.id} onClick={() => { setSelectedService(s); setStep('datetime'); }}
                      className={`w-full text-left p-4 rounded-lg border transition-all hover:border-primary/50 ${selectedService?.id === s.id ? 'border-primary bg-primary/10' : 'border-border bg-background/30'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-bold text-primary">{formatCurrency(s.price)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Clock className="h-3 w-3" />{s.duration_minutes}min</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'datetime' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-playfair text-xl font-semibold">Escolha Data e Horario</h2>
                  <Button variant="ghost" size="sm" onClick={() => setStep('service')}><ChevronLeft className="h-4 w-4" /> Voltar</Button>
                </div>
                <div className="glass rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="icon" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d); }} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="font-medium capitalize">{currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                    <Button variant="ghost" size="icon" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d); }} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="text-center text-xs text-muted-foreground font-medium">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {generateCalendarDays().map(({ date, isCurrentMonth, isPast, isWorkDay }, i) => {
                      const ds = date.toISOString().split('T')[0];
                      const isSelected = ds === selectedDate;
                      return (
                        <button key={i} disabled={isPast || !isWorkDay} onClick={() => setSelectedDate(ds)}
                          className={`aspect-square rounded-lg text-sm transition-all ${
                            !isCurrentMonth ? 'opacity-30' : isSelected ? 'bg-primary text-primary-foreground font-bold' :
                            isPast ? 'opacity-30 cursor-not-allowed' : isWorkDay ? 'hover:bg-primary/20 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                          }`}>
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedDate && (
                  <div>
                    <p className="text-sm font-medium mb-2">Horarios disponiveis para {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {availableSlots.map(slot => {
                          const isBooked = bookedSlots.has(slot);
                          return (
                            <button key={slot} disabled={isBooked} onClick={() => setSelectedTime(slot)}
                              className={`py-2 rounded-lg text-sm font-medium transition-all ${isBooked ? 'bg-secondary/30 text-muted-foreground/50 cursor-not-allowed line-through' : selectedTime === slot ? 'bg-primary text-primary-foreground' : 'bg-background/50 hover:bg-primary/20 border border-border'}`}>
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Nenhum horario disponivel neste dia.</p>}
                  </div>
                )}
                {selectedTime && <Button onClick={() => setStep('info')} className="w-full gold-gradient text-charcoal font-semibold">Continuar</Button>}
              </div>
            )}

            {step === 'info' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h2 className="font-playfair text-xl font-semibold">Seus Dados</h2>
                  <Button variant="ghost" size="sm" onClick={() => setStep('datetime')}><ChevronLeft className="h-4 w-4" /> Voltar</Button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2"><Label htmlFor="name">Nome *</Label><Input id="name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Seu nome completo" required className="bg-background/50" /></div>
                  <div className="space-y-2"><Label htmlFor="phone">Telefone *</Label><Input id="phone" value={clientPhone} onChange={(e) => setClientPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" required className="bg-background/50" /></div>
                  <div className="space-y-2"><Label htmlFor="email">E-mail (opcional)</Label><Input id="email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="seu@email.com" className="bg-background/50" /></div>
                </div>
                <div className="glass rounded-lg p-4 space-y-2 text-sm">
                  <p className="font-medium mb-2">Resumo do Agendamento</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Servico:</span> <span>{selectedService?.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Barbeiro:</span> <span>{collaborator.full_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Data:</span> <span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Horario:</span> <span>{selectedTime}</span></div>
                  <div className="flex justify-between font-medium pt-2 border-t border-border/50"><span>Valor:</span> <span className="text-primary">{formatCurrency(selectedService?.price || 0)}</span></div>
                </div>
                <Button onClick={handleSubmit} disabled={submitting} className="w-full gold-gradient text-charcoal font-semibold">
                  {submitting ? 'Confirmando...' : 'Confirmar Agendamento'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
