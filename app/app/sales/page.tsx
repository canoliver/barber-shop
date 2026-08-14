'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/pagination';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState, EmptyState } from '@/components/states';
import { formatCurrency, formatDate, formatTime, getPaymentMethodLabel } from '@/lib/format';
import { Search, Eye, ShoppingCart, Download } from 'lucide-react';
import jsPDF from 'jspdf';

const ITEMS_PER_PAGE = 20;

export default function SalesHistoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales-history', search, page, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('*, client:clients(full_name), collaborator:collaborators(full_name), sale_items(*, service:services(name), product:products(name))', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
      query = query.range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return { sales: data || [], total: count || 0 };
    },
  });

  const sales = data?.sales || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const filtered = sales.filter((s: any) => {
    const clientName = s.client?.full_name || '';
    const collabName = s.collaborator?.full_name || '';
    return clientName.toLowerCase().includes(search.toLowerCase()) || collabName.toLowerCase().includes(search.toLowerCase());
  });

  const detailSale = sales.find((s: any) => s.id === detailId);

  const generateReceipt = (sale: any) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('BarberPro', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Comprovante de Venda', 105, 28, { align: 'center' });
    doc.text(`Data: ${new Date(sale.created_at).toLocaleString('pt-BR')}`, 105, 35, { align: 'center' });
    doc.text(`Cliente: ${sale.client?.full_name || '—'}`, 105, 42, { align: 'center' });
    doc.text(`Barbeiro: ${sale.collaborator?.full_name || '—'}`, 105, 49, { align: 'center' });

    doc.line(20, 55, 190, 55);
    doc.setFontSize(10);
    doc.text('Item', 20, 65);
    doc.text('Qtd', 120, 65);
    doc.text('Preço Unit.', 140, 65);
    doc.text('Total', 175, 65);
    doc.line(20, 68, 190, 68);

    let y = 75;
    (sale.sale_items || []).forEach((item: any) => {
      const name = item.service?.name || item.product?.name || 'Item';
      doc.text(name.substring(0, 40), 20, y);
      doc.text(String(item.quantity), 120, y);
      doc.text(`R$ ${item.unit_price.toFixed(2)}`, 140, y);
      doc.text(`R$ ${item.total_price.toFixed(2)}`, 175, y);
      y += 7;
    });

    doc.line(20, y, 190, y);
    y += 10;
    doc.text(`Subtotal: R$ ${sale.subtotal.toFixed(2)}`, 130, y);
    y += 7;
    if (sale.discount_amount > 0) { doc.text(`Desconto: -R$ ${sale.discount_amount.toFixed(2)}`, 130, y); y += 7; }
    doc.setFontSize(14);
    doc.text(`Total: R$ ${sale.total_amount.toFixed(2)}`, 130, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`Pagamento: ${getPaymentMethodLabel(sale.payment_method)}`, 20, y);

    doc.save(`comprovante-${sale.id.slice(0, 8)}.pdf`);
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Histórico de Vendas" description="Todas as vendas registradas no sistema." />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou barbeiro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-background/50" />
        </div>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-40 bg-background/50" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-40 bg-background/50" />
      </div>

      {isLoading ? <ListSkeleton count={8} /> : filtered.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-8 w-8" />} title="Nenhuma venda registrada" description="As vendas registradas no PDV aparecerão aqui." />
      ) : (
        <>
          <div className="glass rounded-xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Barbeiro</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{formatDate(s.created_at)} {formatTime(s.created_at.split('T')[1]?.slice(0, 5) || '')}</TableCell>
                      <TableCell>{s.client?.full_name || '—'}</TableCell>
                      <TableCell>{s.collaborator?.full_name || '—'}</TableCell>
                      <TableCell><Badge variant="secondary" className="bg-primary/15 text-primary">{getPaymentMethodLabel(s.payment_method)}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(s.total_amount)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => setDetailId(s.id)} className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => generateReceipt(s)} className="h-8 w-8"><Download className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemsPerPage={ITEMS_PER_PAGE} />
        </>
      )}

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="glass-strong border-border/50 max-w-md">
          <DialogHeader><DialogTitle className="font-playfair text-xl">Detalhes da Venda</DialogTitle></DialogHeader>
          {detailSale && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{(detailSale as any).client?.full_name || '—'}</span></div>
                <div><span className="text-muted-foreground">Barbeiro:</span> <span className="font-medium">{(detailSale as any).collaborator?.full_name || '—'}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{formatDate((detailSale as any).created_at)}</span></div>
                <div><span className="text-muted-foreground">Pagamento:</span> <span className="font-medium">{getPaymentMethodLabel((detailSale as any).payment_method)}</span></div>
              </div>
              <div className="glass rounded-lg p-3 space-y-2">
                {((detailSale as any).sale_items || []).map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.service?.name || item.product?.name || 'Item'} x{item.quantity}</span>
                    <span className="font-medium">{formatCurrency(item.total_price)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 pt-3 border-t border-border/50">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal:</span><span>{formatCurrency((detailSale as any).subtotal)}</span></div>
                {(detailSale as any).discount_amount > 0 && <div className="flex justify-between text-sm text-emerald-400"><span>Desconto:</span><span>-{formatCurrency((detailSale as any).discount_amount)}</span></div>}
                <div className="flex justify-between font-bold text-lg"><span>Total:</span><span className="text-primary">{formatCurrency((detailSale as any).total_amount)}</span></div>
              </div>
              <Button onClick={() => generateReceipt(detailSale)} className="w-full gold-gradient text-charcoal"><Download className="h-4 w-4 mr-2" /> Gerar Comprovante (PDF)</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
