'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatedCounter } from '@/components/animated-counter';
import { CardSkeleton, ListSkeleton } from '@/components/skeletons';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDateLong, getAppointmentStatusLabel, getAppointmentStatusColor, getCollaboratorColor } from '@/lib/format';
import { CalendarDays, TrendingUp, Users, Package, DollarSign, Plus, ShoppingCart, UserPlus, Clock } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { formatCurrency as fmtBRL } from '@/lib/format';

export default function DashboardPage() {
  const { user } = useAuth();
  const [chartRange, setChartRange] = useState<7 | 30>(7);

  const today = new Date().toISOString().split('T')[0];
  const firstName = user?.full_name?.split(' ')[0] || 'Usuário';

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const [todayAppts, todaySales, monthSales, newClients, lowStock] = await Promise.all([
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', today).neq('status', 'cancelled'),
        supabase.from('sales').select('total_amount').gte('created_at', `${today}T00:00:00`),
        supabase.from('sales').select('total_amount').gte('created_at', `${today.slice(0, 8)}01T00:00:00`),
        supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', `${today.slice(0, 8)}01T00:00:00`),
        supabase.from('inventory').select('product_id, current_stock, minimum_stock').lt('current_stock', 'minimum_stock'),
      ]);

      const todayRevenue = (todaySales.data || []).reduce((sum, s) => sum + Number(s.total_amount), 0);
      const monthRevenue = (monthSales.data || []).reduce((sum, s) => sum + Number(s.total_amount), 0);

      return {
        todayAppointments: todayAppts.count || 0,
        todayRevenue,
        monthRevenue,
        newClients: newClients.count || 0,
        lowStock: (lowStock.data || []).length,
      };
    },
  });

  const { data: revenueChart, isLoading: chartLoading } = useQuery({
    queryKey: ['revenue-chart', chartRange],
    queryFn: async () => {
      const days = chartRange;
      const dates: { date: string; label: string; revenue: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dates.push({ date: dateStr, label, revenue: 0 });
      }

      const startDate = dates[0].date;
      const { data: sales } = await supabase
        .from('sales')
        .select('total_amount, created_at')
        .gte('created_at', `${startDate}T00:00:00`);

      (sales || []).forEach((sale) => {
        const saleDate = sale.created_at.split('T')[0];
        const entry = dates.find((d) => d.date === saleDate);
        if (entry) entry.revenue += Number(sale.total_amount);
      });

      return dates;
    },
  });

  const { data: topServices } = useQuery({
    queryKey: ['top-services'],
    queryFn: async () => {
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('item_type, service_id, product_id, quantity, total_price, sale:sales!inner(created_at)')
        .eq('item_type', 'service')
        .gte('sale.created_at', `${today.slice(0, 8)}01T00:00:00`);

      const serviceMap = new Map<string, { name: string; revenue: number; count: number }>();
      const serviceIds = new Set<string>();
      (saleItems || []).forEach((item: any) => {
        if (item.service_id) serviceIds.add(item.service_id);
      });

      let services: any[] = [];
      if (serviceIds.size > 0) {
        const { data: svcData } = await supabase
          .from('services')
          .select('id, name')
          .in('id', Array.from(serviceIds));
        services = svcData || [];
      }

      const svcNameMap = new Map(services.map((s) => [s.id, s.name]));

      (saleItems || []).forEach((item: any) => {
        if (!item.service_id) return;
        const name = svcNameMap.get(item.service_id) || 'Desconhecido';
        const existing = serviceMap.get(item.service_id) || { name, revenue: 0, count: 0 };
        existing.revenue += Number(item.total_price);
        existing.count += item.quantity;
        serviceMap.set(item.service_id, existing);
      });

      return Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    },
  });

  const { data: topBarbers } = useQuery({
    queryKey: ['top-barbers'],
    queryFn: async () => {
      const { data: sales } = await supabase
        .from('sales')
        .select('total_amount, collaborator_id, collaborator:collaborators!inner(full_name)')
        .gte('created_at', `${today.slice(0, 8)}01T00:00:00`)
        .not('collaborator_id', 'is', null);

      const barberMap = new Map<string, { name: string; revenue: number }>();
      (sales || []).forEach((sale: any) => {
        const id = sale.collaborator_id;
        const name = sale.collaborator?.full_name || 'Desconhecido';
        const existing = barberMap.get(id) || { name, revenue: 0 };
        existing.revenue += Number(sale.total_amount);
        barberMap.set(id, existing);
      });

      return Array.from(barberMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    },
  });

  const { data: todayAppointments } = useQuery({
    queryKey: ['today-appointments', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          client:clients(full_name),
          collaborator:collaborators(full_name),
          service:services(name, duration_minutes)
        `)
        .eq('appointment_date', today)
        .order('start_time')
        .neq('status', 'cancelled');
      return data || [];
    },
    refetchInterval: 30000,
  });

  const kpiCards = [
    { label: 'Agendamentos Hoje', value: kpis?.todayAppointments || 0, icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Faturamento do Dia', value: kpis?.todayRevenue || 0, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', isCurrency: true },
    { label: 'Faturamento do Mês', value: kpis?.monthRevenue || 0, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10', isCurrency: true },
    { label: 'Novos Clientes', value: kpis?.newClients || 0, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Estoque Baixo', value: kpis?.lowStock || 0, icon: Package, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  const chartConfig = {
    revenue: { label: 'Faturamento', color: 'hsl(var(--chart-1))' },
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Olá, ${firstName}!`} description={formatDateLong(new Date())}>
        <Link href="/app/appointments">
          <Button className="gold-gradient text-charcoal font-semibold hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
          </Button>
        </Link>
        <Link href="/app/pos">
          <Button variant="outline">
            <ShoppingCart className="h-4 w-4 mr-2" /> Nova Venda
          </Button>
        </Link>
        <Link href="/app/clients">
          <Button variant="outline">
            <UserPlus className="h-4 w-4 mr-2" /> Cadastrar Cliente
          </Button>
        </Link>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpisLoading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold font-playfair">
                    {kpi.isCurrency ? (
                      <AnimatedCounter value={kpi.value} format={(n) => fmtBRL(n)} />
                    ) : (
                      <AnimatedCounter value={kpi.value} />
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Revenue Chart + Top Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass border-border/50 lg:col-span-2 animate-fade-in">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-playfair text-lg">Faturamento</CardTitle>
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
              <button
                onClick={() => setChartRange(7)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartRange === 7 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                7 dias
              </button>
              <button
                onClick={() => setChartRange(30)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartRange === 30 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                30 dias
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader>
            <CardTitle className="font-playfair text-lg">Top 5 Serviços</CardTitle>
          </CardHeader>
          <CardContent>
            {topServices && topServices.length > 0 ? (
              <div className="space-y-3">
                {topServices.map((svc: any, i: number) => (
                  <div key={svc.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{svc.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full gold-gradient rounded-full"
                            style={{ width: `${(svc.revenue / (topServices[0]?.revenue || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtBRL(svc.revenue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço vendido este mês.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments Timeline + Top Barbers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass border-border/50 lg:col-span-2 animate-fade-in">
          <CardHeader>
            <CardTitle className="font-playfair text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Agenda de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!todayAppointments ? (
              <ListSkeleton count={4} />
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
                {todayAppointments.map((apt: any) => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div className="w-1 h-12 rounded-full" style={{ backgroundColor: apt.collaborator_id ? getCollaboratorColor(apt.collaborator_id) : '#D4A843' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.client?.full_name || apt.client_name || 'Cliente não identificado'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {apt.service?.name || 'Serviço não definido'} • {apt.collaborator?.full_name || 'Sem barbeiro'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{apt.start_time?.slice(0, 5)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getAppointmentStatusColor(apt.status)}`}>
                        {getAppointmentStatusLabel(apt.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento para hoje.</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader>
            <CardTitle className="font-playfair text-lg">Top Barbeiros do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {topBarbers && topBarbers.length > 0 ? (
              <div className="space-y-3">
                {topBarbers.map((barber: any, i: number) => (
                  <div key={barber.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{barber.name}</p>
                      <p className="text-xs text-muted-foreground">{fmtBRL(barber.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de barbeiros este mês.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
