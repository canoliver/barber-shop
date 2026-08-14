'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scissors, Calendar, Clock, Gift, Loader2, LogOut, User, Trash2, Lock, CheckCircle2, XCircle, Sparkles, ChevronLeft, ChevronRight, Check, Plus } from 'lucide-react';
import { formatCurrency, maskPhone } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { Service, Collaborator } from '@/lib/types';

interface AppointmentWithRelations {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  service: { name: string; price: number; duration_minutes: number }[] | { name: string; price: number; duration_minutes: number } | null;
  collaborator: { full_name: string }[] | { full_name: string } | null;
}

function getServiceName(s: AppointmentWithRelations['service']): string {
  if (!s) return 'Serviço';
  if (Array.isArray(s)) return s[0]?.name || 'Serviço';
  return s.name;
}
function getServicePrice(s: AppointmentWithRelations['service']): number | null {
  if (!s) return null;
  if (Array.isArray(s)) return s[0]?.price ?? null;
  return s.price;
}
function getCollaboratorName(c: AppointmentWithRelations['collaborator']): string {
  if (!c) return 'Barbeiro';
  if (Array.isArray(c)) return c[0]?.full_name || 'Barbeiro';
  return c.full_name;
}

export default function AcompanharPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('agendamentos');

  // Booking state
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [bookingStep, setBookingStep] = useState<'collaborator' | 'service' | 'datetime' | 'confirm'>('collaborator');
  const [submitting, setSubmitting] = useState(false);

  // Load or create client record
  const { data: clientData, isLoading: clientLoading } = useQuery({
    queryKey: ['client-data', user?.id],
    queryFn: async () => {
      if (!user) return null;
      let { data: client, error } = await supabase
        .from('clients')
        .select('id, full_name, email, phone, loyalty_points')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!client && !error) {
        const fallback = await supabase
          .from('clients')
          .select('id, full_name, email, phone, loyalty_points')
          .or(`email.eq.${user.email},phone.eq.${user.phone}`)
          .maybeSingle();
        client = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      if (!client) {
        const { data: newClient, error: insertError } = await supabase
          .from('clients')
          .insert({
            full_name: user.full_name,
            email: user.email,
            phone: user.phone || '',
            loyalty_points: 0,
          })
          .select('id, full_name, email, phone, loyalty_points')
          .maybeSingle();
        if (insertError) throw insertError;
        client = newClient;
      }
      return client;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Load collaborators
  const { data: collaborators, isLoading: collabLoading } = useQuery({
    queryKey: ['client-collaborators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return (data || []) as Collaborator[];
    },
  });

  // Load services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['client-services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Service[];
    },
  });

  // Load client appointments
  const { data: appointments, isLoading: apptsLoading } = useQuery({
    queryKey: ['client-appointments', clientData?.id],
    queryFn: async () => {
      if (!clientData) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, start_time, end_time, status, notes,
          service:services(name, price, duration_minutes),
          collaborator:collaborators(full_name)
        `)
        .eq('client_id', clientData.id)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data || []) as AppointmentWithRelations[];
    },
    enabled: !!clientData,
    refetchInterval: 30000,
  });

  // Load available slots when date or collaborator changes
  useEffect(() => {
    if (selectedDate && selectedCollaborator) {
      loadSlots();
    } else {
      setAvailableSlots([]);
      setBookedSlots(new Set());
    }
  }, [selectedDate, selectedCollaborator]);

  const loadSlots = async () => {
    if (!selectedCollaborator) return;
    const dayOfWeek = String(new Date(selectedDate + 'T00:00:00').getDay());
    if (!(selectedCollaborator.work_days || []).includes(dayOfWeek)) {
      setAvailableSlots([]);
      return;
    }
    const { data: existing } = await supabase
      .from('appointments')
      .select('start_time, end_time, status')
      .eq('appointment_date', selectedDate)
      .eq('collaborator_id', selectedCollaborator.id)
      .neq('status', 'cancelled');
    const booked = new Set<string>();
    (existing || []).forEach((a: any) => booked.add(a.start_time?.slice(0, 5)));
    setBookedSlots(booked);

    const start = selectedCollaborator.work_hours_start?.slice(0, 5) || '09:00';
    const end = selectedCollaborator.work_hours_end?.slice(0, 5) || '19:00';
    const breakS = selectedCollaborator.break_start?.slice(0, 5);
    const breakE = selectedCollaborator.break_end?.slice(0, 5);
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const slots: string[] = [];
    let curMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (curMin < endMin) {
      const h = Math.floor(curMin / 60);
      const m = curMin % 60;
      const slot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!(breakS && breakE && slot >= breakS && slot < breakE)) {
        slots.push(slot);
      }
      curMin += 30;
    }
    setAvailableSlots(slots);
  };

  const now = useMemo(() => new Date(), []);

  const isWithinOneDayBefore = (dateStr: string, timeStr: string) => {
    const apptDateTime = new Date(`${dateStr}T${timeStr}`);
    const diff = apptDateTime.getTime() - now.getTime();
    return diff > 24 * 60 * 60 * 1000;
  };

  const isPastOrToday = (dateStr: string, timeStr: string) => {
    const apptDateTime = new Date(`${dateStr}T${timeStr}`);
    return apptDateTime.getTime() <= now.getTime();
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Agendamento cancelado com sucesso.');
      await queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
    } catch {
      toast.error('Erro ao cancelar agendamento. Tente novamente.');
    }
    setCancellingId(null);
    setConfirmId(null);
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
      const isWorkDay = (selectedCollaborator?.work_days || []).includes(dow);
      days.push({ date: d, isCurrentMonth: true, isPast: d < today, isWorkDay });
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      days.push({ date: d, isCurrentMonth: false, isPast: d < today, isWorkDay: false });
    }
    return days;
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !selectedCollaborator || !clientData) return;
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', selectedDate)
        .eq('collaborator_id', selectedCollaborator.id)
        .eq('start_time', selectedTime + ':00')
        .neq('status', 'cancelled')
        .maybeSingle();
      if (existing) {
        toast.error('Este horário acabou de ser agendado. Escolha outro.');
        setSubmitting(false);
        return;
      }
      const [h, m] = selectedTime.split(':').map(Number);
      const totalMin = h * 60 + m + selectedService.duration_minutes;
      const endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
      const { error } = await supabase.from('appointments').insert({
        client_id: clientData.id,
        collaborator_id: selectedCollaborator.id,
        service_id: selectedService.id,
        appointment_date: selectedDate,
        start_time: selectedTime + ':00',
        end_time: endTime + ':00',
        status: 'scheduled',
        source: 'link',
        client_name: clientData.full_name,
        client_phone: clientData.phone,
      });
      if (error) throw error;
      toast.success('Agendamento realizado com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      // Reset booking
      setSelectedCollaborator(null);
      setSelectedService(null);
      setSelectedDate('');
      setSelectedTime('');
      setBookingStep('collaborator');
      setActiveTab('agendamentos');
    } catch {
      toast.error('Erro ao agendar. Tente novamente.');
    }
    setSubmitting(false);
  };

  if (clientLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.replace('/cliente/login');
    return null;
  }

  const upcoming = (appointments || []).filter(
    (a: AppointmentWithRelations) => a.status !== 'cancelled' && !isPastOrToday(a.appointment_date, a.start_time)
  );
  const past = (appointments || []).filter(
    (a: AppointmentWithRelations) => a.status !== 'cancelled' && isPastOrToday(a.appointment_date, a.start_time)
  );
  const cancelled = (appointments || []).filter((a: AppointmentWithRelations) => a.status === 'cancelled');

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center gold-glow">
              <Scissors className="h-6 w-6 text-charcoal" />
            </div>
            <div>
              <h1 className="font-playfair text-2xl font-bold gold-text">BarberPro</h1>
              <p className="text-xs text-muted-foreground">Área do Cliente</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={async () => { await signOut(); router.replace('/cliente/login'); }} className="text-muted-foreground hover:text-destructive">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Client Info Card */}
        <Card className="glass-strong border-border/50 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-playfair text-lg font-semibold">{clientData?.full_name || user.full_name}</p>
                <p className="text-sm text-muted-foreground">{clientData?.email || user.email}</p>
                {clientData?.phone && <p className="text-sm text-muted-foreground">{clientData.phone}</p>}
              </div>
            </div>

            {/* Loyalty Points */}
            <div className="mt-6 glass rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pontos de Fidelidade</p>
                  <p className="text-2xl font-bold gold-text">{clientData?.loyalty_points ?? 0}</p>
                </div>
              </div>
              <Sparkles className="h-5 w-5 text-gold/50" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="agendar" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo Agendamento
            </TabsTrigger>
            <TabsTrigger value="agendamentos" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Meus Agendamentos
            </TabsTrigger>
          </TabsList>

          {/* New Appointment Tab */}
          <TabsContent value="agendar" className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {(['collaborator', 'service', 'datetime', 'confirm'] as const).map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    bookingStep === s ? 'bg-primary text-primary-foreground' :
                    (['collaborator', 'service', 'datetime', 'confirm'] as const).indexOf(bookingStep) > i ? 'bg-emerald-500/30 text-emerald-300' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {(['collaborator', 'service', 'datetime', 'confirm'] as const).indexOf(bookingStep) > i ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  {i < 3 && <div className="w-8 h-0.5 bg-border" />}
                </div>
              ))}
            </div>

            <Card className="glass-strong border-border/50">
              <CardContent className="p-6">
                {/* Step 1: Choose collaborator */}
                {bookingStep === 'collaborator' && (
                  <div className="space-y-4 animate-fade-in">
                    <h2 className="font-playfair text-xl font-semibold mb-4">Escolha o Profissional</h2>
                    {collabLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : (collaborators || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum profissional disponível no momento.</p>
                    ) : (
                      <div className="space-y-2">
                        {(collaborators || []).map((c: Collaborator) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCollaborator(c); setBookingStep('service'); }}
                            className={`w-full text-left p-4 rounded-lg border transition-all hover:border-primary/50 ${selectedCollaborator?.id === c.id ? 'border-primary bg-primary/10' : 'border-border bg-background/30'}`}
                          >
                            <div className="flex items-center gap-3">
                              {c.avatar_url ? (
                                <img src={c.avatar_url} alt={c.full_name} className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium">{c.full_name}</p>
                                {c.specialty && <p className="text-sm text-muted-foreground">{c.specialty}</p>}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Choose service */}
                {bookingStep === 'service' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h2 className="font-playfair text-xl font-semibold">Escolha o Serviço</h2>
                      <Button variant="ghost" size="sm" onClick={() => setBookingStep('collaborator')}>
                        <ChevronLeft className="h-4 w-4" /> Voltar
                      </Button>
                    </div>
                    {servicesLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : (services || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço disponível no momento.</p>
                    ) : (
                      <div className="space-y-2">
                        {(services || []).map((s: Service) => (
                          <button
                            key={s.id}
                            onClick={() => { setSelectedService(s); setBookingStep('datetime'); }}
                            className={`w-full text-left p-4 rounded-lg border transition-all hover:border-primary/50 ${selectedService?.id === s.id ? 'border-primary bg-primary/10' : 'border-border bg-background/30'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{s.name}</p>
                                {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-bold text-primary">{formatCurrency(s.price)}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                  <Clock className="h-3 w-3" />{s.duration_minutes}min
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Choose date and time */}
                {bookingStep === 'datetime' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h2 className="font-playfair text-xl font-semibold">Escolha Data e Horário</h2>
                      <Button variant="ghost" size="sm" onClick={() => setBookingStep('service')}>
                        <ChevronLeft className="h-4 w-4" /> Voltar
                      </Button>
                    </div>
                    <div className="glass rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Button variant="ghost" size="icon" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d); }} className="h-8 w-8">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-medium capitalize">{currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                        <Button variant="ghost" size="icon" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d); }} className="h-8 w-8">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                          <div key={i} className="text-center text-xs text-muted-foreground font-medium">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {generateCalendarDays().map(({ date, isCurrentMonth, isPast, isWorkDay }, i) => {
                          const ds = date.toISOString().split('T')[0];
                          const isSelected = ds === selectedDate;
                          return (
                            <button
                              key={i}
                              disabled={isPast || !isWorkDay}
                              onClick={() => { setSelectedDate(ds); setSelectedTime(''); }}
                              className={`aspect-square rounded-lg text-sm transition-all ${
                                !isCurrentMonth ? 'opacity-30' :
                                isSelected ? 'bg-primary text-primary-foreground font-bold' :
                                isPast ? 'opacity-30 cursor-not-allowed' :
                                isWorkDay ? 'hover:bg-primary/20 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                              }`}
                            >
                              {date.getDate()}
                            </button>
                          );
                        })}
                      </div>
                      {!selectedCollaborator?.work_days?.includes(String(new Date().getDay())) && selectedDate === '' && (
                        <p className="text-xs text-muted-foreground text-center mt-3">
                          Os dias destacados são os dias disponíveis do profissional.
                        </p>
                      )}
                    </div>
                    {selectedDate && (
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Horários disponíveis para {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </p>
                        {availableSlots.length > 0 ? (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {availableSlots.map((slot) => {
                              const isBooked = bookedSlots.has(slot);
                              return (
                                <button
                                  key={slot}
                                  disabled={isBooked}
                                  onClick={() => setSelectedTime(slot)}
                                  className={`py-2 rounded-lg text-sm font-medium transition-all ${
                                    isBooked ? 'bg-secondary/30 text-muted-foreground/50 cursor-not-allowed line-through' :
                                    selectedTime === slot ? 'bg-primary text-primary-foreground' :
                                    'bg-background/50 hover:bg-primary/20 border border-border'
                                  }`}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum horário disponível neste dia.</p>
                        )}
                      </div>
                    )}
                    {selectedTime && (
                      <Button onClick={() => setBookingStep('confirm')} className="w-full gold-gradient text-charcoal font-semibold">
                        Continuar
                      </Button>
                    )}
                  </div>
                )}

                {/* Step 4: Confirm */}
                {bookingStep === 'confirm' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h2 className="font-playfair text-xl font-semibold">Confirmar Agendamento</h2>
                      <Button variant="ghost" size="sm" onClick={() => setBookingStep('datetime')}>
                        <ChevronLeft className="h-4 w-4" /> Voltar
                      </Button>
                    </div>
                    <div className="glass rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Serviço:</span> <span className="font-medium">{selectedService?.name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Profissional:</span> <span className="font-medium">{selectedCollaborator?.full_name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Data:</span> <span className="font-medium capitalize">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Horário:</span> <span className="font-medium">{selectedTime}</span></div>
                      <div className="flex justify-between font-medium pt-2 border-t border-border/50">
                        <span>Valor:</span> <span className="text-primary">{formatCurrency(selectedService?.price || 0)}</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleBooking}
                      disabled={submitting}
                      className="w-full gold-gradient text-charcoal font-semibold"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Agendamento'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Appointments Tab */}
          <TabsContent value="agendamentos" className="space-y-6">
            {/* Upcoming Appointments */}
            <div>
              <h2 className="font-playfair text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Próximos Agendamentos
              </h2>
              {apptsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : upcoming.length === 0 ? (
                <Card className="glass-strong border-border/50">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Você não tem agendamentos futuros.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setActiveTab('agendar')}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Fazer um agendamento
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((apt: AppointmentWithRelations) => {
                    const canCancel = isWithinOneDayBefore(apt.appointment_date, apt.start_time);
                    const isToday = new Date(apt.appointment_date).toDateString() === now.toDateString();
                    return (
                      <Card key={apt.id} className="glass-strong border-border/50 overflow-hidden">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge className={isToday ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}>
                                  {isToday ? 'Hoje' : 'Agendado'}
                                </Badge>
                              </div>
                              <p className="font-medium text-base">{getServiceName(apt.service)}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span className="capitalize">
                                  {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{apt.start_time?.slice(0, 5)} - {apt.end_time?.slice(0, 5)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Scissors className="h-4 w-4" />
                                <span>{getCollaboratorName(apt.collaborator)}</span>
                              </div>
                              {getServicePrice(apt.service) != null && (
                                <p className="text-sm font-medium text-primary pt-1">{formatCurrency(getServicePrice(apt.service)!)}</p>
                              )}
                            </div>
                          </div>

                          {/* Cancel Button */}
                          <div className="mt-4 pt-4 border-t border-border/50">
                            {canCancel ? (
                              confirmId === apt.id ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleCancel(apt.id)}
                                    disabled={cancellingId === apt.id}
                                    className="flex-1"
                                  >
                                    {cancellingId === apt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                                    Confirmar cancelamento
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                                    Voltar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmId(apt.id)}
                                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Excluir Agendamento
                                </Button>
                              )
                            ) : (
                              <Button size="sm" variant="outline" disabled className="w-full opacity-50 cursor-not-allowed">
                                <Lock className="h-4 w-4 mr-1" /> Cancelamento indisponível
                              </Button>
                            )}
                            {!canCancel && !isPastOrToday(apt.appointment_date, apt.start_time) && (
                              <p className="text-xs text-muted-foreground text-center mt-2">
                                O cancelamento só é permitido até 1 dia antes do agendamento.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Appointments */}
            {past.length > 0 && (
              <div className="mb-6">
                <h2 className="font-playfair text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Agendamentos Anteriores
                </h2>
                <div className="space-y-3">
                  {past.map((apt: AppointmentWithRelations) => (
                    <Card key={apt.id} className="glass-strong border-border/50 opacity-70">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{getServiceName(apt.service)}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às {apt.start_time?.slice(0, 5)}
                            </p>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Concluído
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Cancelled Appointments */}
            {cancelled.length > 0 && (
              <div className="mb-6">
                <h2 className="font-playfair text-lg font-semibold mb-4 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Cancelados
                </h2>
                <div className="space-y-3">
                  {cancelled.map((apt: AppointmentWithRelations) => (
                    <Card key={apt.id} className="glass-strong border-border/50 opacity-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm line-through">{getServiceName(apt.service)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} às {apt.start_time?.slice(0, 5)}
                            </p>
                          </div>
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> Cancelado
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
