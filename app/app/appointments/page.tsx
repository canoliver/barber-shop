'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/states';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppointmentForm } from '@/components/appointment-form';
import {
  formatCurrency, getAppointmentStatusLabel, getAppointmentStatusColor,
  getCollaboratorColor, getWeekdayShort, formatTime,
} from '@/lib/format';
import {
  Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock,
  CheckCircle2, XCircle, Pencil, Trash2, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Appointment, Collaborator } from '@/lib/types';

type ViewMode = 'day' | 'week' | 'month';

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [collaboratorFilter, setCollaboratorFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>('');
  const [defaultCollaborator, setDefaultCollaborator] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);

  const dateStr = currentDate.toISOString().split('T')[0];

  const { data: collaborators } = useQuery({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const { data } = await supabase.from('collaborators').select('*').eq('is_active', true).order('full_name');
      return (data || []) as Collaborator[];
    },
  });

  const { data: appointments, isLoading, isError, refetch } = useQuery({
    queryKey: ['appointments', dateStr, viewMode, collaboratorFilter],
    queryFn: async () => {
      const start = new Date(currentDate);
      const end = new Date(currentDate);
      if (viewMode === 'day') { /* same day */ }
      else if (viewMode === 'week') { start.setDate(start.getDate() - start.getDay()); end.setDate(end.getDate() - end.getDay() + 6); }
      else if (viewMode === 'month') { start.setDate(1); end.setMonth(end.getMonth() + 1); end.setDate(0); }

      let query = supabase
        .from('appointments')
        .select(`*, client:clients(full_name, phone), collaborator:collaborators(full_name), service:services(name, price, duration_minutes)`)
        .gte('appointment_date', start.toISOString().split('T')[0])
        .lte('appointment_date', end.toISOString().split('T')[0])
        .order('start_time');

      const { data, error } = await query;
      if (error) throw error;
      let result = data as Appointment[];
      if (collaboratorFilter !== 'all') {
        result = result.filter(a => a.collaborator_id === collaboratorFilter);
      }
      return result;
    },
  });

  const navigateDate = (direction: number) => {
    const d = new Date(currentDate);
    if (viewMode === 'day') d.setDate(d.getDate() + direction);
    else if (viewMode === 'week') d.setDate(d.getDate() + direction * 7);
    else if (viewMode === 'month') d.setMonth(d.getMonth() + direction);
    setCurrentDate(d);
  };

  const handleNew = (date?: string, collaboratorId?: string) => {
    setEditing(null);
    setDefaultDate(date || dateStr);
    setDefaultCollaborator(collaboratorId || '');
    setFormOpen(true);
  };

  const handleEdit = (a: Appointment) => {
    setEditing(a);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('appointments').delete().eq('id', deleteId);
    if (error) toast.error('Erro ao excluir agendamento.');
    else { toast.success('Agendamento excluído!'); queryClient.invalidateQueries({ queryKey: ['appointments'] }); }
    setDeleteId(null);
  };

  const updateStatus = async (apt: Appointment, status: Appointment['status']) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', apt.id);
    if (error) toast.error('Erro ao atualizar status.');
    else { toast.success('Status atualizado!'); queryClient.invalidateQueries({ queryKey: ['appointments'] }); setDetailAppt(null); }
  };

  const formatDateLabel = () => {
    if (viewMode === 'day') return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (viewMode === 'week') {
      const start = new Date(currentDate); start.setDate(start.getDate() - start.getDay());
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
    }
    return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Group appointments by date for day/week view
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    (appointments || []).forEach((a: Appointment) => {
      const date = a.appointment_date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(a);
    });
    return map;
  }, [appointments]);

  // Generate days for week view
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const days: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }
    return days;
  }, [currentDate, viewMode]);

  // Generate calendar for month view
  const monthDays = useMemo(() => {
    if (viewMode !== 'month') return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    // Next month padding
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      days.push({ date: d, isCurrentMonth: false });
    }
    return days;
  }, [currentDate, viewMode]);

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Agendamentos" description="Gerencie os agendamentos da barbearia.">
        <Button onClick={() => handleNew()} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
        </Button>
      </PageHeader>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[180px]">{formatDateLabel()}</span>
        </div>
        <div className="flex gap-2 ml-auto">
          <div className="flex bg-secondary/50 rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <Select value={collaboratorFilter} onValueChange={setCollaboratorFilter}>
            <SelectTrigger className="w-48 bg-background/50"><SelectValue placeholder="Todos barbeiros" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos barbeiros</SelectItem>
              {(collaborators || []).map((c: Collaborator) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Day View */}
      {viewMode === 'day' && (
        <DayView appointments={appointments || []} isLoading={isLoading} onEdit={handleEdit} onDelete={(id) => setDeleteId(id)} onNew={handleNew} dateStr={dateStr} />
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const ds = day.toISOString().split('T')[0];
            const dayAppts = appointmentsByDate.get(ds) || [];
            const isToday = ds === new Date().toISOString().split('T')[0];
            return (
              <div key={ds} className={`glass rounded-lg p-3 min-h-[200px] ${isToday ? 'border-primary/50' : 'border-border/50'}`}>
                <div className={`text-center mb-2 pb-2 border-b border-border/50 ${isToday ? 'text-primary' : ''}`}>
                  <p className="text-xs text-muted-foreground">{getWeekdayShort(String(day.getDay()))}</p>
                  <p className="font-bold text-lg">{day.getDate()}</p>
                </div>
                <div className="space-y-1.5">
                  {dayAppts.slice(0, 4).map((a) => (
                    <button key={a.id} onClick={() => setDetailAppt(a)} className="w-full text-left">
                      <div className="rounded-md p-1.5 text-xs hover:opacity-80 transition-opacity" style={{ backgroundColor: `${getCollaboratorColor(a.collaborator_id || '')}20`, borderLeft: `3px solid ${getCollaboratorColor(a.collaborator_id || '')}` }}>
                        <p className="font-medium">{a.start_time?.slice(0, 5)}</p>
                        <p className="truncate">{a.client?.full_name || a.client_name || 'Cliente'}</p>
                      </div>
                    </button>
                  ))}
                  {dayAppts.length > 4 && <p className="text-xs text-muted-foreground text-center">+{dayAppts.length - 4} mais</p>}
                  {dayAppts.length === 0 && (
                    <button onClick={() => handleNew(ds)} className="w-full text-xs text-muted-foreground hover:text-primary py-2">+ Adicionar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="glass rounded-xl p-4 border border-border/50">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map(({ date, isCurrentMonth }) => {
              const ds = date.toISOString().split('T')[0];
              const dayAppts = appointmentsByDate.get(ds) || [];
              const isToday = ds === new Date().toISOString().split('T')[0];
              return (
                <button
                  key={ds}
                  onClick={() => { setCurrentDate(date); setViewMode('day'); }}
                  className={`min-h-[80px] p-1.5 rounded-lg border text-left transition-all hover:border-primary/50 ${isCurrentMonth ? 'bg-background/30 border-border/50' : 'bg-transparent border-transparent opacity-40'} ${isToday ? 'border-primary/50 gold-glow' : ''}`}
                >
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>{date.getDate()}</p>
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map((a) => (
                      <div key={a.id} className="text-[10px] truncate px-1 py-0.5 rounded" style={{ backgroundColor: `${getCollaboratorColor(a.collaborator_id || '')}30` }}>
                        {a.start_time?.slice(0, 5)} {a.client?.full_name || a.client_name || ''}
                      </div>
                    ))}
                    {dayAppts.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayAppts.length - 3}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AppointmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        appointment={editing}
        defaultDate={defaultDate}
        defaultCollaboratorId={defaultCollaborator}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['appointments'] })}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir Agendamento"
        description="Tem certeza que deseja excluir este agendamento?"
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
      <AppointmentDetailDialog
        appointment={detailAppt}
        onOpenChange={(o) => !o && setDetailAppt(null)}
        onEdit={(a) => { setDetailAppt(null); handleEdit(a); }}
        onDelete={(id) => { setDetailAppt(null); setDeleteId(id); }}
        onStatusChange={updateStatus}
      />
    </div>
  );
}

function DayView({ appointments, isLoading, onEdit, onDelete, onNew, dateStr }: {
  appointments: Appointment[];
  isLoading: boolean;
  onEdit: (a: Appointment) => void;
  onDelete: (id: string) => void;
  onNew: (date?: string, collaboratorId?: string) => void;
  dateStr: string;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const apptsByHour = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    appointments.forEach((a: Appointment) => {
      const h = parseInt(a.start_time?.split(':')[0] || '0');
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(a);
    });
    return map;
  }, [appointments]);

  if (isLoading) {
    return <div className="glass rounded-xl p-6 space-y-2">
      {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 bg-muted/50" />)}
    </div>;
  }

  return (
    <div className="glass rounded-xl border border-border/50 overflow-hidden">
      <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
        {hours.filter(h => h >= 7 && h <= 21).map(hour => {
          const hourAppts = apptsByHour.get(hour) || [];
          return (
            <div key={hour} className="flex border-b border-border/30 min-h-[60px]">
              <div className="w-16 p-2 text-xs text-muted-foreground font-medium border-r border-border/30">
                {String(hour).padStart(2, '0')}:00
              </div>
              <div className="flex-1 p-1.5 relative">
                {hourAppts.length > 0 ? (
                  <div className="space-y-1">
                    {hourAppts.map(a => (
                      <div
                        key={a.id}
                        onClick={() => onEdit(a)}
                        className="rounded-lg p-2 cursor-pointer hover:opacity-80 transition-opacity group"
                        style={{ backgroundColor: `${getCollaboratorColor(a.collaborator_id || '')}20`, borderLeft: `4px solid ${getCollaboratorColor(a.collaborator_id || '')}` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.client?.full_name || a.client_name || 'Cliente'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {formatTime(a.start_time)} • {a.service?.name || 'Serviço'} • {a.collaborator?.full_name || ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getAppointmentStatusColor(a.status)}`}>
                              {getAppointmentStatusLabel(a.status)}
                            </span>
                            <button
                              type="button"
                              aria-label="Excluir agendamento"
                              title="Excluir agendamento"
                              onClick={(event) => { event.stopPropagation(); onDelete(a.id); }}
                              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button onClick={() => onNew(dateStr)} className="w-full h-full min-h-[48px] flex items-center justify-center text-xs text-muted-foreground/50 hover:text-primary transition-colors rounded-lg">
                    + Adicionar agendamento
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentDetailDialog({ appointment, onOpenChange, onEdit, onDelete, onStatusChange }: {
  appointment: Appointment | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (a: Appointment) => void;
  onDelete: (id: string) => void;
  onStatusChange: (a: Appointment, status: Appointment['status']) => void;
}) {
  if (!appointment) return null;
  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl">Detalhes do Agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-12 rounded-full" style={{ backgroundColor: getCollaboratorColor(appointment.collaborator_id || '') }} />
            <div>
              <p className="font-semibold">{appointment.client?.full_name || appointment.client_name || 'Cliente'}</p>
              <p className="text-sm text-muted-foreground">{appointment.service?.name || 'Serviço não definido'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Barbeiro:</span> <span className="font-medium">{appointment.collaborator?.full_name || '—'}</span></div>
            <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}</span></div>
            <div><span className="text-muted-foreground">Horário:</span> <span className="font-medium">{formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}</span></div>
            <div><span className="text-muted-foreground">Valor:</span> <span className="font-medium">{appointment.service ? formatCurrency(Number(appointment.service.price)) : '—'}</span></div>
          </div>
          {appointment.notes && <div className="text-sm"><span className="text-muted-foreground">Observações:</span> <p>{appointment.notes}</p></div>}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span className={`text-xs px-2 py-1 rounded-full border ${getAppointmentStatusColor(appointment.status)}`}>
              {getAppointmentStatusLabel(appointment.status)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/50">
          {appointment.status !== 'completed' && (
            <Button size="sm" onClick={() => onStatusChange(appointment, 'completed')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
            </Button>
          )}
          {appointment.status !== 'cancelled' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(appointment, 'cancelled')} className="text-destructive">
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          )}
          {appointment.status === 'completed' && (
            <Link href={`/app/pos?appointment=${appointment.id}`}>
              <Button size="sm" className="gold-gradient text-charcoal">
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Registrar Venda
              </Button>
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={() => onEdit(appointment)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(appointment.id)} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
