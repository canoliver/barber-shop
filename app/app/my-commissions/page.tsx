'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react';

export default function MyCommissionsPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: collaborator } = useQuery({
    queryKey: ['my-collaborator', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('collaborators').select('*').eq('profile_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['my-commissions', collaborator?.id, startDate, endDate],
    queryFn: async () => {
      if (!collaborator) return [];
      let q = supabase.from('commissions').select('*, sale:sales(total_amount, created_at)').eq('collaborator_id', collaborator.id).order('created_at', { ascending: false });
      if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
      const { data } = await q;
      return data || [];
    },
    enabled: !!collaborator,
  });

  const pending = (commissions || []).filter((c: any) => !c.is_paid);
  const paid = (commissions || []).filter((c: any) => c.is_paid);
  const totalPending = pending.reduce((s: number, c: any) => s + Number(c.commission_amount), 0);
  const totalPaid = paid.reduce((s: number, c: any) => s + Number(c.commission_amount), 0);

  return (
    <div>
      <PageHeader title="Minhas Comissões" description="Acompanhe suas comissões e ganhos." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="h-6 w-6 text-amber-400" /></div>
            <div><p className="text-sm text-muted-foreground">Pendente</p><p className="text-xl font-bold text-amber-400">{formatCurrency(totalPending)}</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-emerald-400" /></div>
            <div><p className="text-sm text-muted-foreground">Pago</p><p className="text-xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-primary/30 gold-glow animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center"><DollarSign className="h-6 w-6 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-bold text-primary">{formatCurrency(totalPending + totalPaid)}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-background/50" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-background/50" />
      </div>

      <Card className="glass border-border/50">
        <CardContent className="p-0">
          {isLoading ? <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p> : (commissions || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma comissão registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead className="text-right">Valor da Venda</TableHead><TableHead className="text-right">Comissão</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(commissions || []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{formatDate(c.created_at)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.sale?.total_amount || 0)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(c.commission_amount)}</TableCell>
                      <TableCell><Badge variant="secondary" className={c.is_paid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}>{c.is_paid ? 'Pago' : 'Pendente'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
