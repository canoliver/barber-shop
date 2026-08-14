'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRequireRole } from '@/lib/auth-guards';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ChartContainer } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/format';
import { Download, BarChart3, TrendingUp, Users, Package, DollarSign, Wallet } from 'lucide-react';
import jsPDF from 'jspdf';

type ReportType = 'revenue' | 'services' | 'collaborators' | 'clients' | 'products' | 'cashflow';

export default function ReportsPage() {
  useRequireRole(['admin']);
  const [reportType, setReportType] = useState<ReportType>('revenue');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: sales } = useQuery({
    queryKey: ['report-sales', startDate, endDate],
    queryFn: async () => {
      let q = supabase.from('sales').select('*, client:clients(full_name), collaborator:collaborators(full_name), sale_items(*, service:services(name), product:products(name))').order('created_at', { ascending: false });
      if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ['report-transactions', startDate, endDate],
    queryFn: async () => {
      let q = supabase.from('financial_transactions').select('*').order('date', { ascending: false });
      if (startDate) q = q.gte('date', startDate);
      if (endDate) q = q.lte('date', endDate);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['report-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Revenue report data
  const revenueData = (() => {
    const map = new Map<string, { date: string; revenue: number }>();
    (sales || []).forEach((s: any) => {
      const d = s.created_at.split('T')[0];
      const existing = map.get(d) || { date: d, revenue: 0 };
      existing.revenue += Number(s.total_amount);
      map.set(d, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  // Services report
  const servicesData = (() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    (sales || []).forEach((s: any) => {
      (s.sale_items || []).forEach((item: any) => {
        if (item.item_type === 'service' && item.service?.name) {
          const existing = map.get(item.service.name) || { name: item.service.name, count: 0, revenue: 0 };
          existing.count += item.quantity;
          existing.revenue += Number(item.total_price);
          map.set(item.service.name, existing);
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  })();

  // Collaborators report
  const collaboratorsData = (() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    (sales || []).forEach((s: any) => {
      if (s.collaborator?.full_name) {
        const existing = map.get(s.collaborator.full_name) || { name: s.collaborator.full_name, revenue: 0, count: 0 };
        existing.revenue += Number(s.total_amount);
        existing.count += 1;
        map.set(s.collaborator.full_name, existing);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  })();

  // Products report
  const productsData = (() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    (sales || []).forEach((s: any) => {
      (s.sale_items || []).forEach((item: any) => {
        if (item.item_type === 'product' && item.product?.name) {
          const existing = map.get(item.product.name) || { name: item.product.name, count: 0, revenue: 0 };
          existing.count += item.quantity;
          existing.revenue += Number(item.total_price);
          map.set(item.product.name, existing);
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  })();

  // Cash flow data
  const cashFlowData = (() => {
    const map = new Map<string, { date: string; income: number; expense: number }>();
    (transactions || []).forEach((t: any) => {
      const d = t.date;
      const existing = map.get(d) || { date: d, income: 0, expense: 0 };
      if (t.type === 'income') existing.income += Number(t.amount);
      else existing.expense += Number(t.amount);
      map.set(d, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const totalRevenue = (sales || []).reduce((s: number, sale: any) => s + Number(sale.total_amount), 0);
  const totalIncome = (transactions || []).filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
  const totalExpense = (transactions || []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);

  const reportTypes: { value: ReportType; label: string; icon: typeof DollarSign }[] = [
    { value: 'revenue', label: 'Faturamento', icon: DollarSign },
    { value: 'services', label: 'Serviços', icon: BarChart3 },
    { value: 'collaborators', label: 'Colaboradores', icon: TrendingUp },
    { value: 'clients', label: 'Clientes', icon: Users },
    { value: 'products', label: 'Produtos', icon: Package },
    { value: 'cashflow', label: 'Fluxo de Caixa', icon: Wallet },
  ];

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('BarberPro - Relatório', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Tipo: ${reportTypes.find(r => r.value === reportType)?.label}`, 105, 28, { align: 'center' });
    doc.text(`Período: ${startDate} a ${endDate}`, 105, 35, { align: 'center' });
    doc.line(20, 40, 190, 40);
    let y = 50;
    if (reportType === 'revenue') {
      doc.text(`Faturamento Total: R$ ${totalRevenue.toFixed(2)}`, 20, y); y += 10;
      doc.text('Data', 20, y); doc.text('Faturamento', 100, y); y += 7; doc.line(20, y - 3, 190, y - 3);
      revenueData.forEach(r => { if (y > 270) { doc.addPage(); y = 20; } doc.text(formatDate(r.date), 20, y); doc.text(`R$ ${r.revenue.toFixed(2)}`, 100, y); y += 7; });
    } else if (reportType === 'services') {
      doc.text('Serviço', 20, y); doc.text('Qtd', 100, y); doc.text('Receita', 150, y); y += 7; doc.line(20, y - 3, 190, y - 3);
      servicesData.forEach(s => { if (y > 270) { doc.addPage(); y = 20; } doc.text(s.name.substring(0, 30), 20, y); doc.text(String(s.count), 100, y); doc.text(`R$ ${s.revenue.toFixed(2)}`, 150, y); y += 7; });
    } else if (reportType === 'collaborators') {
      doc.text('Colaborador', 20, y); doc.text('Vendas', 100, y); doc.text('Receita', 150, y); y += 7; doc.line(20, y - 3, 190, y - 3);
      collaboratorsData.forEach(c => { if (y > 270) { doc.addPage(); y = 20; } doc.text(c.name.substring(0, 30), 20, y); doc.text(String(c.count), 100, y); doc.text(`R$ ${c.revenue.toFixed(2)}`, 150, y); y += 7; });
    } else if (reportType === 'cashflow') {
      doc.text(`Total Receitas: R$ ${totalIncome.toFixed(2)}`, 20, y); y += 7;
      doc.text(`Total Despesas: R$ ${totalExpense.toFixed(2)}`, 20, y); y += 7;
      doc.text(`Saldo: R$ ${(totalIncome - totalExpense).toFixed(2)}`, 20, y); y += 10;
      doc.text('Data', 20, y); doc.text('Receitas', 80, y); doc.text('Despesas', 130, y); y += 7; doc.line(20, y - 3, 190, y - 3);
      cashFlowData.forEach(c => { if (y > 270) { doc.addPage(); y = 20; } doc.text(formatDate(c.date), 20, y); doc.text(`R$ ${c.income.toFixed(2)}`, 80, y); doc.text(`R$ ${c.expense.toFixed(2)}`, 130, y); y += 7; });
    }
    doc.save(`relatorio-${reportType}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Relatórios" description="Análises e relatórios da barbearia.">
        <Button variant="outline" onClick={exportPDF}><Download className="h-4 w-4 mr-2" /> Exportar PDF</Button>
      </PageHeader>

      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {reportTypes.map(rt => {
          const Icon = rt.icon;
          return (
            <button key={rt.value} onClick={() => setReportType(rt.value)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${reportType === rt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-4 w-4" /> {rt.label}
            </button>
          );
        })}
      </div>

      {/* Date Filters */}
      <div className="flex gap-3 mb-6">
        <div className="space-y-1"><Label>Data Inicial</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background/50" /></div>
        <div className="space-y-1"><Label>Data Final</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background/50" /></div>
      </div>

      {/* Report Content */}
      {reportType === 'revenue' && (
        <div className="space-y-4">
          <Card className="glass border-border/50 animate-fade-in">
            <CardHeader><CardTitle className="font-playfair text-lg">Faturamento Total: {formatCurrency(totalRevenue)}</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => formatDate(v)} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                    <Line dataKey="revenue" stroke="#D4A843" strokeWidth={2} dot={{ fill: '#D4A843' }} name="Faturamento" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === 'services' && (
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="font-playfair text-lg">Desempenho por Serviço</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Serviço</TableHead><TableHead className="text-center">Quantidade</TableHead><TableHead className="text-right">Receita</TableHead></TableRow></TableHeader>
                <TableBody>
                  {servicesData.map(s => <TableRow key={s.name}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-center">{s.count}</TableCell><TableCell className="text-right font-bold text-primary">{formatCurrency(s.revenue)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'collaborators' && (
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="font-playfair text-lg">Desempenho por Colaborador</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead className="text-center">Vendas</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Ticket Médio</TableHead></TableRow></TableHeader>
                <TableBody>
                  {collaboratorsData.map(c => <TableRow key={c.name}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-center">{c.count}</TableCell><TableCell className="text-right font-bold text-primary">{formatCurrency(c.revenue)}</TableCell><TableCell className="text-right">{formatCurrency(c.count > 0 ? c.revenue / c.count : 0)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'clients' && (
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="font-playfair text-lg">Relatório de Clientes</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">Total Clientes</p><p className="text-xl font-bold">{(clients || []).length}</p></div>
              <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">Novos (período)</p><p className="text-xl font-bold">{(clients || []).filter((c: any) => c.created_at >= `${startDate}T00:00:00`).length}</p></div>
              <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">Com pontos</p><p className="text-xl font-bold">{(clients || []).filter((c: any) => c.loyalty_points > 0).length}</p></div>
              <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">Clientes ativos</p><p className="text-xl font-bold">{(sales || []).filter((s: any, i: number, arr: any[]) => arr.findIndex(x => x.client_id === s.client_id) === i).length}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'products' && (
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="font-playfair text-lg">Vendas por Produto</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-center">Quantidade</TableHead><TableHead className="text-right">Receita</TableHead></TableRow></TableHeader>
                <TableBody>
                  {productsData.map(p => <TableRow key={p.name}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-center">{p.count}</TableCell><TableCell className="text-right font-bold text-primary">{formatCurrency(p.revenue)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'cashflow' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="glass border-border/50"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total Receitas</p><p className="text-xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p></CardContent></Card>
            <Card className="glass border-border/50"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total Despesas</p><p className="text-xl font-bold text-red-400">{formatCurrency(totalExpense)}</p></CardContent></Card>
            <Card className="glass border-primary/30 gold-glow"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Saldo</p><p className="text-xl font-bold text-primary">{formatCurrency(totalIncome - totalExpense)}</p></CardContent></Card>
          </div>
          <Card className="glass border-border/50">
            <CardHeader><CardTitle className="font-playfair text-lg">Fluxo de Caixa</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(v) => formatDate(v)} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <Bar dataKey="income" fill="#10b981" name="Receitas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#ef4444" name="Despesas" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
