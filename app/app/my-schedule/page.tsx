'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/states';
import { AppointmentForm } from '@/components/appointment-form';
import { getAppointmentStatusLabel, getAppointmentStatusColor, formatTime } from '@/lib/format';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';

export default function MySchedulePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState('');

  const { data: collaborator } = useQuery({
    queryKey: ['my-collaborator', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('collaborators').select('*').eq('profile_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const dateStr = currentDate.toISOString().split('T')[0];

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['my-appointments', dateStr, collaborator?.id],
    queryFn: async () => {
      if (!collaborator) return [];
      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(full_name, phone), service:services(name, price, duration_minutes)')
        .eq('collaborator_id', collaborator.id)
        .eq('appointment_date', dateStr)
        .order('start_time');
      return data || [];
    },
    enabled: !!collaborator,
  });

  const navigateDate = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  return (
    <div>
      <PageHeader title="Minha Agenda" description="Seus agendamentos do dia.">
        <Button onClick={() => { setDefaultDate(dateStr); setFormOpen(true); }} className="gold-gradient text-charcoal font-semibold"><Plus className="h-4 w-4 mr-2" /> Novo Agendamento</Button>
      </PageHeader>

      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm font-medium capitalize ml-2">{currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      {isLoading ? <ListSkeleton count={5} /> : (appointments || []).length === 0 ? (
        <EmptyState icon={<Calendar className="h-8 w-8" />} title="Nenhum agendamento hoje" description="Você não tem agendamentos para esta data." />
      ) : (
        <div className="space-y-2">
          {(appointments || []).map((a: any) => (
            <Card key={a.id} className="glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-center min-w-[60px]">
                  <p className="text-lg font-bold text-primary">{formatTime(a.start_time)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(a.end_time)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.client?.full_name || a.client_name || 'Cliente'}</p>
                  <p className="text-sm text-muted-foreground truncate">{a.service?.name || '—'}</p>
                  {a.notes && <p className="text-xs text-muted-foreground truncate mt-1">{a.notes}</p>}
                </div>
                <Badge className={`text-xs px-2 py-1 rounded-full border ${getAppointmentStatusColor(a.status)}`}>
                  {getAppointmentStatusLabel(a.status)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AppointmentForm open={formOpen} onOpenChange={setFormOpen} defaultDate={defaultDate} defaultCollaboratorId={collaborator?.id} onSaved={() => queryClient.invalidateQueries({ queryKey: ['my-appointments'] })} />
    </div>
  );
}
