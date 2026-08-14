'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { LoadingState, ErrorState, EmptyState } from '@/components/states';
import { ClientForm } from '@/components/client-form';
import { getInitials, formatCurrency, formatDate, formatPhone, getAppointmentStatusLabel, getAppointmentStatusColor } from '@/lib/format';
import { ArrowLeft, Pencil, Calendar, DollarSign, Gift, Star, Clock, Heart } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clientId = params.id as string;
  const [formOpen, setFormOpen] = useState(false);

  const { data: client, isLoading, isError, refetch } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: appointments } = useQuery({
    queryKey: ['client-appointments', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select(`*, service:services(name, price), collaborator:collaborators(full_name)`)
        .eq('client_id', clientId)
        .order('appointment_date', { ascending: false });
      return data || [];
    },
    enabled: !!clientId,
  });

  const { data: sales } = useQuery({
    queryKey: ['client-sales', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <LoadingState />;
  if (isError || !client) return <ErrorState onRetry={refetch} />;

  const totalSpent = (sales || []).reduce((sum: number, s: any) => sum + Number(s.total_amount), 0);
  const completedAppts = (appointments || []).filter((a: any) => a.status === 'completed');
  const lastVisit = completedAppts[0]?.appointment_date;
  const lastVisitDate = lastVisit ? formatDate(lastVisit) : 'Sem visitas';

  // Favorite service
  const serviceCount = new Map<string, { name: string; count: number }>();
  (appointments || []).forEach((a: any) => {
    if (a.service?.name) {
      const existing = serviceCount.get(a.service.name) || { name: a.service.name, count: 0 };
      existing.count++;
      serviceCount.set(a.service.name, existing);
    }
  });
  const favService = Array.from(serviceCount.values()).sort((a, b) => b.count - a.count)[0];

  // Favorite barber
  const barberCount = new Map<string, string>();
  (appointments || []).forEach((a: any) => {
    if (a.collaborator?.full_name) {
      barberCount.set(a.collaborator.full_name, (barberCount.get(a.collaborator.full_name) || '') + 'x');
    }
  });
  const favBarber = Array.from(barberCount.entries())[0]?.[0];

  const stats = [
    { label: 'Total Gasto', value: formatCurrency(totalSpent), icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Visitas', value: String(completedAppts.length), icon: Calendar, color: 'text-blue-400' },
    { label: 'Pontos', value: String(client.loyalty_points), icon: Gift, color: 'text-amber-400' },
    { label: 'Última Visita', value: lastVisitDate, icon: Clock, color: 'text-purple-400' },
  ];

  return (
    <div>
      <Button variant="ghost" onClick={() => router.push('/app/clients')} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>

      <PageHeader title={client.full_name} description="Perfil e histórico do cliente.">
        <Button onClick={() => setFormOpen(true)} variant="outline">
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </Button>
      </PageHeader>

      {/* Client Info Card */}
      <Card className="glass border-border/50 mb-6 animate-fade-in">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20 border-2 border-primary/30">
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{getInitials(client.full_name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                <p className="font-medium">{formatPhone(client.phone)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">E-mail</p>
                <p className="font-medium">{client.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nascimento</p>
                <p className="font-medium">{client.birth_date ? formatDate(client.birth_date) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cadastrado em</p>
                <p className="font-medium">{formatDate(client.created_at)}</p>
              </div>
              {client.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{client.notes}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="glass border-border/50 animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center">
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Favorites */}
      {(favService || favBarber) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {favService && (
            <Card className="glass border-border/50 animate-fade-in">
              <CardContent className="p-4 flex items-center gap-3">
                <Star className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Serviço Favorito</p>
                  <p className="font-medium">{favService.name} ({favService.count}x)</p>
                </div>
              </CardContent>
            </Card>
          )}
          {favBarber && (
            <Card className="glass border-border/50 animate-fade-in">
              <CardContent className="p-4 flex items-center gap-3">
                <Heart className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Barbeiro Favorito</p>
                  <p className="font-medium">{favBarber}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Appointment History */}
      <Card className="glass border-border/50 mb-6 animate-fade-in">
        <CardHeader><CardTitle className="font-playfair text-lg">Histórico de Agendamentos</CardTitle></CardHeader>
        <CardContent>
          {(appointments || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Barbeiro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(appointments || []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{formatDate(a.appointment_date)}</TableCell>
                      <TableCell>{a.service?.name || '—'}</TableCell>
                      <TableCell>{a.collaborator?.full_name || '—'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getAppointmentStatusColor(a.status)}`}>
                          {getAppointmentStatusLabel(a.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{a.service ? formatCurrency(Number(a.service.price)) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientForm open={formOpen} onOpenChange={setFormOpen} client={client} onSaved={() => queryClient.invalidateQueries({ queryKey: ['client', clientId] })} />
    </div>
  );
}
