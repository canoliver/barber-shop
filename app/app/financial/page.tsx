'use client';

import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ChartContainer } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency, formatDate, getPaymentMethodLabel } from '@/lib/format';
import { TrendingUp, TrendingDown, Plus, Download, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import type { TransactionType, PaymentMethod } from '@/lib/types';

export default function FinancialPage() {
  useRequireRole(['admin']);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transOpen, setTransOpen] = useState(false);
  const [transType, setTransType] = useState<TransactionType>('income');
  const [transCategory, setTransCategory] = useState('');
  const [transDescription, setTransDescription] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transMethod, setTransMethod] = useState<PaymentMethod>('cash');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['financial-transactions', startDate, endDate],
    queryFn: async () => {
      let query = supabase.from('financial_transactions').select('*').order('date', { ascending: false });
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      const { data } = await query;
      return data || [];
    },
  });

  const totalIncome = (transactions || []).filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
  const totalExpense = (transactions || []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Monthly chart data
  const monthlyData = (() => {
    const months: { label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const monthStr = d.toLocaleDateString('pt-BR', { month: 'short' });
      const yearMonth = d.toISOString().slice(0, 7);
      const income = (transactions || []).filter((t: any) => t.type === 'income' && t.date.startsWith(yearMonth)).reduce((s: number, t: any) => s + t.amount, 0);
      const expense = (transactions || []).filter((t: any) => t.type === 'expense' && t.date.startsWith(yearMonth)).reduce((s: number, t: any) => s + t.amount, 0);
      months.push({ label: monthStr, income, expense });
    }
    return months;
  })();

  // Category breakdown
  const categoryData = (() => {
    const map = new Map<string, number>();
    (transactions || []).forEach((t: any) => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]: [string, number]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value).slice(0, 6);
  })();

  const PIE_COLORS = ['#D4A843', '#C47F17', '#E8B558', '#A06B12', '#F0C674', '#8B5E12'];

  const handleAddTransaction = async () => {
    const amount = parseFloat(transAmount.replace(',', '.')) || 0;
    if (amount <= 0) { toast.error('Informe um valor válido.'); return; }
    const { error } = await supabase.from('financial_transactions').insert({
      type: transType, category: transCategory || (transType === 'income' ? 'Receita' : 'Despesa'),
      description: transDescription, amount, payment_method: transMethod, date: transDate, created_by: user?.id,
    });
    if (error) { toast.error('Erro ao registrar transação.'); return; }
    toast.success('Transação registrada!');
    setTransOpen(false); setTransAmount(''); setTransCategory(''); setTransDescription('');
    queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('BarberPro - Relatório Financeiro', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Período: ${startDate || 'Início'} a ${endDate || 'Hoje'}`, 105, 28, { align: 'center' });
    doc.text(`Total Receitas: R$ ${totalIncome.toFixed(2)}`, 20, 40);
    doc.text(`Total Despesas: R$ ${totalExpense.toFixed(2)}`, 20, 47);
    doc.text(`Saldo: R$ ${balance.toFixed(2)}`, 20, 54);
    doc.line(20, 58, 190, 58);
    let y = 65;
    doc.text('Data', 20, y); doc.text('Tipo', 50, y); doc.text('Categoria', 75, y); doc.text('Descrição', 110, y); doc.text('Valor', 180, y);
    y += 7; doc.line(20, y - 3, 190, y - 3);
    (transactions || []).forEach((t: any) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(formatDate(t.date), 20, y);
      doc.text(t.type === 'income' ? 'Entrada' : 'Saída', 50, y);
      doc.text(t.category.substring(0, 20), 75, y);
      doc.text((t.description || '').substring(0, 30), 110, y);
      doc.text(`R$ ${t.amount.toFixed(2)}`, 180, y);
      y += 7;
    });
    doc.save('relatorio-financeiro.pdf');
  };

  return (
    <div>
      <PageHeader title="Financeiro" description="Gestão financeira da barbearia.">
        <Button variant="outline" onClick={exportPDF}><Download className="h-4 w-4 mr-2" /> Exportar PDF</Button>
        <Button onClick={() => setTransOpen(true)} className="gold-gradient text-charcoal font-semibold"><Plus className="h-4 w-4 mr-2" /> Nova Transação</Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-6 w-6 text-emerald-400" /></div>
            <div><p className="text-sm text-muted-foreground">Receitas</p><p className="text-xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center"><TrendingDown className="h-6 w-6 text-red-400" /></div>
            <div><p className="text-sm text-muted-foreground">Despesas</p><p className="text-xl font-bold text-red-400">{formatCurrency(totalExpense)}</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-primary/30 animate-fade-in gold-glow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center"><DollarSign className="h-6 w-6 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Saldo</p><p className="text-xl font-bold text-primary">{formatCurrency(balance)}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-background/50" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-background/50" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg">Receitas vs Despesas</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas" />
                  <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg">Por Categoria</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ChartContainer config={{}} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>
                      {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-16">Sem dados para exibir.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="glass border-border/50">
        <CardHeader><CardTitle className="font-playfair text-lg">Transações</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : (transactions || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(transactions || []).map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{formatDate(t.date)}</TableCell>
                      <TableCell><Badge variant="secondary" className={t.type === 'income' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}>{t.type === 'income' ? 'Entrada' : 'Saída'}</Badge></TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell className="text-muted-foreground">{t.description || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{t.payment_method ? getPaymentMethodLabel(t.payment_method) : '—'}</TableCell>
                      <TableCell className={`text-right font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={transOpen} onOpenChange={setTransOpen}>
        <DialogContent className="glass-strong border-border/50 max-w-md">
          <DialogHeader><DialogTitle className="font-playfair text-xl">Nova Transação</DialogTitle><DialogDescription>Registre uma receita ou despesa manual.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={transType === 'income' ? 'default' : 'outline'} onClick={() => setTransType('income')} className="flex-1"><TrendingUp className="h-4 w-4 mr-2" /> Receita</Button>
              <Button variant={transType === 'expense' ? 'default' : 'outline'} onClick={() => setTransType('expense')} className="flex-1"><TrendingDown className="h-4 w-4 mr-2" /> Despesa</Button>
            </div>
            <div className="space-y-2"><Label htmlFor="transAmount">Valor (R$)</Label><Input id="transAmount" value={transAmount} onChange={(e) => setTransAmount(e.target.value)} placeholder="0,00" className="bg-background/50" /></div>
            <div className="space-y-2"><Label htmlFor="transCategory">Categoria</Label><Input id="transCategory" value={transCategory} onChange={(e) => setTransCategory(e.target.value)} placeholder="Ex: Aluguel, Material" className="bg-background/50" /></div>
            <div className="space-y-2"><Label htmlFor="transDescription">Descrição</Label><Textarea id="transDescription" value={transDescription} onChange={(e) => setTransDescription(e.target.value)} className="bg-background/50" rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2"><Label>Data</Label><Input type="date" value={transDate} onChange={(e) => setTransDate(e.target.value)} className="bg-background/50" /></div>
              <div className="space-y-2"><Label>Pagamento</Label><Select value={transMethod} onValueChange={(v) => setTransMethod(v as PaymentMethod)}><SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Dinheiro</SelectItem><SelectItem value="credit_card">Cartão de Crédito</SelectItem><SelectItem value="debit_card">Cartão de Débito</SelectItem><SelectItem value="pix">PIX</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setTransOpen(false)}>Cancelar</Button><Button onClick={handleAddTransaction} className="gold-gradient text-charcoal font-semibold">Registrar</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
