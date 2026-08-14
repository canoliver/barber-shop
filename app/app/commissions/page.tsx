'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { CheckCircle2, Clock, DollarSign, Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function CommissionsPage() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCollaborator, setFilterCollaborator] = useState('all');

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['commissions', startDate, endDate, filterCollaborator],
    queryFn: async () => {
      let query = supabase
        .from('commissions')
        .select('*, collaborator:collaborators(full_name), sale:sales(total_amount, created_at)')
        .order('created_at', { ascending: false });
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
      const { data } = await query;
      let result = data || [];
      if (filterCollaborator !== 'all') {
        result = result.filter((c: any) => c.collaborator_id === filterCollaborator);
      }
      return result;
    },
  });

  const { data: collaborators } = useQuery({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const { data } = await supabase.from('collaborators').select('*').eq('is_active', true).order('full_name');
      return data || [];
    },
  });

  const pending = (commissions || []).filter((c: any) => !c.is_paid);
  const paid = (commissions || []).filter((c: any) => c.is_paid);
  const totalPending = pending.reduce((s: number, c: any) => s + Number(c.commission_amount), 0);
  const totalPaid = paid.reduce((s: number, c: any) => s + Number(c.commission_amount), 0);

  const markAsPaid = async (id: string) => {
    const { error } = await supabase.from('commissions').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erro ao marcar como paga.'); return; }
    toast.success('Comissão marcada como paga!');
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
  };

  const markAllPaid = async () => {
    const ids = pending.map((c: any) => c.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('commissions').update({ is_paid: true, paid_at: new Date().toISOString() }).in('id', ids);
    if (error) { toast.error('Erro ao marcar comissões.'); return; }
    toast.success(`${ids.length} comissões marcadas como pagas!`);
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('BarberPro - Relatório de Comissões', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Total Pendente: R$ ${totalPending.toFixed(2)}`, 20, 35);
    doc.text(`Total Pago: R$ ${totalPaid.toFixed(2)}`, 20, 42);
    doc.line(20, 46, 190, 46);
    let y = 55;
    doc.text('Data', 20, y); doc.text('Colaborador', 50, y); doc.text('Valor Venda', 110, y); doc.text('Comissão', 150, y); doc.text('Status', 185, y);
    y += 7; doc.line(20, y - 3, 190, y - 3);
    (commissions || []).forEach((c: any) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(formatDate(c.created_at), 20, y);
      doc.text((c.collaborator?.full_name || '').substring(0, 25), 50, y);
      doc.text(`R$ ${(c.sale?.total_amount || 0).toFixed(2)}`, 110, y);
      doc.text(`R$ ${c.commission_amount.toFixed(2)}`, 150, y);
      doc.text(c.is_paid ? 'Pago' : 'Pendente', 185, y);
      y += 7;
    });
    doc.save('relatorio-comissoes.pdf');
  };

  return (
    <div>
      <PageHeader title="Comissões" description="Gerencie comissões dos colaboradores.">
        <Button variant="outline" onClick={exportPDF}><Download className="h-4 w-4 mr-2" /> Exportar PDF</Button>
        {pending.length > 0 && <Button onClick={markAllPaid} className="gold-gradient text-charcoal font-semibold"><CheckCircle2 className="h-4 w-4 mr-2" /> Pagar Todas</Button>}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="h-6 w-6 text-amber-400" /></div>
            <div><p className="text-sm text-muted-foreground">Pendente</p><p className="text-xl font-bold text-amber-400">{formatCurrency(totalPending)}</p><p className="text-xs text-muted-foreground">{pending.length} comissão(ões)</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-emerald-400" /></div>
            <div><p className="text-sm text-muted-foreground">Pago</p><p className="text-xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p><p className="text-xs text-muted-foreground">{paid.length} comissão(ões)</p></div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 animate-fade-in">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center"><DollarSign className="h-6 w-6 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Geral</p><p className="text-xl font-bold text-primary">{formatCurrency(totalPending + totalPaid)}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-background/50" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-background/50" />
        <select value={filterCollaborator} onChange={(e) => setFilterCollaborator(e.target.value)} className="bg-background/50 border border-border rounded-md px-3 py-2 text-sm">
          <option value="all">Todos colaboradores</option>
          {(collaborators || []).map((c: any) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      <Card className="glass border-border/50">
        <CardContent className="p-0">
          {isLoading ? <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p> : (commissions || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma comissão registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Colaborador</TableHead><TableHead className="text-right">Valor Venda</TableHead><TableHead className="text-right">Comissão</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(commissions || []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{formatDate(c.created_at)}</TableCell>
                      <TableCell>{c.collaborator?.full_name || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.sale?.total_amount || 0)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(c.commission_amount)}</TableCell>
                      <TableCell><Badge variant="secondary" className={c.is_paid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}>{c.is_paid ? 'Pago' : 'Pendente'}</Badge></TableCell>
                      <TableCell className="text-right">{!c.is_paid && <Button size="sm" variant="outline" onClick={() => markAsPaid(c.id)} className="h-7">Pagar</Button>}</TableCell>
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
