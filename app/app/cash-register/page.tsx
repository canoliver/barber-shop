'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
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
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { formatCurrency, formatDate, formatTime, getPaymentMethodLabel } from '@/lib/format';
import { Wallet, TrendingUp, TrendingDown, Lock, Unlock, DollarSign, History } from 'lucide-react';
import { toast } from 'sonner';
import type { CashRegister, PaymentMethod, TransactionType } from '@/lib/types';

export default function CashRegisterPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [openBalance, setOpenBalance] = useState('');
  const [closeBalance, setCloseBalance] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [transType, setTransType] = useState<TransactionType>('income');
  const [transAmount, setTransAmount] = useState('');
  const [transCategory, setTransCategory] = useState('');
  const [transDescription, setTransDescription] = useState('');
  const [transMethod, setTransMethod] = useState<PaymentMethod>('cash');

  const { data: currentCash, isLoading, isError, refetch } = useQuery({
    queryKey: ['current-cash'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_register')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .maybeSingle();
      return data as CashRegister | null;
    },
  });

  const { data: cashHistory } = useQuery({
    queryKey: ['cash-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_register')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(20);
      return data as CashRegister[];
    },
  });

  const { data: todayTransactions } = useQuery({
    queryKey: ['cash-transactions', currentCash?.id],
    queryFn: async () => {
      if (!currentCash) return [];
      const { data } = await supabase
        .from('financial_transactions')
        .select('*')
        .gte('date', currentCash.opened_at.split('T')[0])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentCash,
  });

  const handleOpenCash = async () => {
    const balance = parseFloat(openBalance.replace(',', '.')) || 0;
    const { error } = await supabase.from('cash_register').insert({
      opened_by: user?.id,
      opening_balance: balance,
      status: 'open',
    });
    if (error) { toast.error('Erro ao abrir caixa.'); return; }
    toast.success('Caixa aberto!');
    setOpenBalance('');
    queryClient.invalidateQueries({ queryKey: ['current-cash'] });
  };

  const handleCloseCash = async () => {
    if (!currentCash) return;
    const counted = parseFloat(closeBalance.replace(',', '.')) || 0;
    const { error } = await supabase.from('cash_register').update({
      closing_balance: counted,
      status: 'closed',
      closed_by: user?.id,
      closed_at: new Date().toISOString(),
      notes: closeNotes,
    }).eq('id', currentCash.id);
    if (error) { toast.error('Erro ao fechar caixa.'); return; }
    toast.success('Caixa fechado!');
    setCloseBalance(''); setCloseNotes(''); setCloseDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['current-cash'] });
    queryClient.invalidateQueries({ queryKey: ['cash-history'] });
  };

  const handleAddTransaction = async () => {
    const amount = parseFloat(transAmount.replace(',', '.')) || 0;
    if (amount <= 0) { toast.error('Informe um valor válido.'); return; }
    const { error } = await supabase.from('financial_transactions').insert({
      type: transType,
      category: transCategory || (transType === 'income' ? 'Outras Receitas' : 'Despesas'),
      description: transDescription,
      amount,
      payment_method: transMethod,
      date: new Date().toISOString().split('T')[0],
      created_by: user?.id,
    });
    if (error) { toast.error('Erro ao registrar transação.'); return; }
    toast.success(transType === 'income' ? 'Entrada registrada!' : 'Saída registrada!');
    setTransOpen(false); setTransAmount(''); setTransCategory(''); setTransDescription('');
    queryClient.invalidateQueries({ queryKey: ['cash-transactions'] });
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  const expectedBalance = currentCash
    ? currentCash.opening_balance + (todayTransactions || []).filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0)
      - (todayTransactions || []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0)
    : 0;

  return (
    <div>
      <PageHeader title="Caixa" description="Controle de caixa da barbearia." />

      {isLoading ? <ListSkeleton count={3} /> : !currentCash ? (
        <Card className="glass border-border/50 max-w-md mx-auto animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-xl flex items-center gap-2"><Unlock className="h-5 w-5 text-primary" /> Abrir Caixa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openBalance">Saldo de Abertura (R$)</Label>
              <Input id="openBalance" value={openBalance} onChange={(e) => setOpenBalance(e.target.value)} placeholder="0,00" className="bg-background/50" />
            </div>
            <Button onClick={handleOpenCash} className="w-full gold-gradient text-charcoal font-semibold"><Wallet className="h-4 w-4 mr-2" /> Abrir Caixa</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current Cash Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card className="glass border-border/50 animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><Wallet className="h-4 w-4 text-blue-400" /></div><p className="text-sm text-muted-foreground">Saldo Inicial</p></div>
                <p className="text-xl font-bold">{formatCurrency(currentCash.opening_balance)}</p>
              </CardContent>
            </Card>
            <Card className="glass border-border/50 animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-emerald-400" /></div><p className="text-sm text-muted-foreground">Entradas</p></div>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency((todayTransactions || []).filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0))}</p>
              </CardContent>
            </Card>
            <Card className="glass border-border/50 animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center"><TrendingDown className="h-4 w-4 text-red-400" /></div><p className="text-sm text-muted-foreground">Saídas</p></div>
                <p className="text-xl font-bold text-red-400">{formatCurrency((todayTransactions || []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0))}</p>
              </CardContent>
            </Card>
            <Card className="glass border-primary/30 animate-fade-in gold-glow">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center"><DollarSign className="h-4 w-4 text-primary" /></div><p className="text-sm text-muted-foreground">Saldo Esperado</p></div>
                <p className="text-xl font-bold text-primary">{formatCurrency(expectedBalance)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 mb-4">
            <Button onClick={() => setTransOpen(true)} variant="outline"><TrendingUp className="h-4 w-4 mr-2 text-emerald-400" /> Nova Entrada</Button>
            <Button onClick={() => { setTransType('expense'); setTransOpen(true); }} variant="outline"><TrendingDown className="h-4 w-4 mr-2 text-red-400" /> Nova Saída</Button>
            <Button onClick={() => setCloseDialogOpen(true)} className="ml-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"><Lock className="h-4 w-4 mr-2" /> Fechar Caixa</Button>
          </div>

          {/* Transactions */}
          <Card className="glass border-border/50 mb-6">
            <CardHeader><CardTitle className="font-playfair text-lg">Transações do Caixa</CardTitle></CardHeader>
            <CardContent>
              {(todayTransactions || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(todayTransactions || []).map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell><Badge variant="secondary" className={t.type === 'income' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}>{t.type === 'income' ? 'Entrada' : 'Saída'}</Badge></TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell className="text-muted-foreground">{t.description || '—'}</TableCell>
                          <TableCell className={`text-right font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(t.amount)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* History */}
      <Card className="glass border-border/50">
        <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Histórico de Caixa</CardTitle></CardHeader>
        <CardContent>
          {(cashHistory || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro de caixa.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Abertura</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Saldo Inicial</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Saldo Final</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(cashHistory || []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{formatDate(c.opened_at)} {formatTime(c.opened_at.split('T')[1]?.slice(0, 5) || '')}</TableCell>
                      <TableCell><Badge variant="secondary" className={c.status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-secondary text-muted-foreground'}>{c.status === 'open' ? 'Aberto' : 'Fechado'}</Badge></TableCell>
                      <TableCell className="text-right">{formatCurrency(c.opening_balance)}</TableCell>
                      <TableCell className="text-right text-emerald-400">{formatCurrency(c.total_income)}</TableCell>
                      <TableCell className="text-right text-red-400">{formatCurrency(c.total_expenses)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(c.closing_balance || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <Dialog open={transOpen} onOpenChange={setTransOpen}>
        <DialogContent className="glass-strong border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-playfair text-xl">{transType === 'income' ? 'Nova Entrada' : 'Nova Saída'}</DialogTitle>
            <DialogDescription>Registre uma movimentação manual no caixa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={transType === 'income' ? 'default' : 'outline'} onClick={() => setTransType('income')} className="flex-1"><TrendingUp className="h-4 w-4 mr-2" /> Entrada</Button>
              <Button variant={transType === 'expense' ? 'default' : 'outline'} onClick={() => setTransType('expense')} className="flex-1"><TrendingDown className="h-4 w-4 mr-2" /> Saída</Button>
            </div>
            <div className="space-y-2"><Label htmlFor="transAmount">Valor (R$)</Label><Input id="transAmount" value={transAmount} onChange={(e) => setTransAmount(e.target.value)} placeholder="0,00" className="bg-background/50" /></div>
            <div className="space-y-2"><Label htmlFor="transCategory">Categoria</Label><Input id="transCategory" value={transCategory} onChange={(e) => setTransCategory(e.target.value)} placeholder="Ex: Material de limpeza" className="bg-background/50" /></div>
            <div className="space-y-2"><Label htmlFor="transDescription">Descrição</Label><Textarea id="transDescription" value={transDescription} onChange={(e) => setTransDescription(e.target.value)} className="bg-background/50" rows={2} /></div>
            <div className="space-y-2"><Label>Forma de Pagamento</Label><Select value={transMethod} onValueChange={(v) => setTransMethod(v as PaymentMethod)}><SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Dinheiro</SelectItem><SelectItem value="credit_card">Cartão de Crédito</SelectItem><SelectItem value="debit_card">Cartão de Débito</SelectItem><SelectItem value="pix">PIX</SelectItem></SelectContent></Select></div>
            <DialogFooter><Button variant="outline" onClick={() => setTransOpen(false)}>Cancelar</Button><Button onClick={handleAddTransaction} className="gold-gradient text-charcoal font-semibold">Registrar</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Cash Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="glass-strong border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-playfair text-xl">Fechar Caixa</DialogTitle>
            <DialogDescription>Confirme o fechamento do caixa atual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="glass rounded-lg p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo Esperado:</span><span className="font-bold text-primary">{formatCurrency(expectedBalance)}</span></div>
            </div>
            <div className="space-y-2"><Label htmlFor="closeBalance">Saldo Contado (R$)</Label><Input id="closeBalance" value={closeBalance} onChange={(e) => setCloseBalance(e.target.value)} placeholder="0,00" className="bg-background/50" /></div>
            {closeBalance && (
              <div className="glass rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Diferença:</span><span className={`font-bold ${(parseFloat(closeBalance.replace(',', '.')) || 0) - expectedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency((parseFloat(closeBalance.replace(',', '.')) || 0) - expectedBalance)}</span></div>
              </div>
            )}
            <div className="space-y-2"><Label htmlFor="closeNotes">Observações</Label><Textarea id="closeNotes" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} className="bg-background/50" rows={2} /></div>
            <DialogFooter><Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancelar</Button><Button onClick={handleCloseCash} className="bg-destructive text-destructive-foreground">Fechar Caixa</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
