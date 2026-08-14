'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/states';
import { Bell, CheckCheck, Trash2, Calendar, Package, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/format';

const NOTIF_ICONS: Record<string, typeof Bell> = {
  booking: Calendar,
  low_stock: Package,
  commission: DollarSign,
  reminder: Clock,
  general: Bell,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      let q = supabase.from('notifications').select('*').eq('recipient_id', user!.id).order('created_at', { ascending: false });
      if (filter === 'unread') q = q.eq('is_read', false);
      const { data } = await q;
      return data || [];
    },
    enabled: !!user,
  });

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user!.id).eq('is_read', false);
    toast.success('Todas as notificações marcadas como lidas!');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
  };

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
  };

  return (
    <div>
      <PageHeader title="Notificações" description="Centro de notificações do sistema.">
        <Button variant="outline" onClick={markAllRead}><CheckCheck className="h-4 w-4 mr-2" /> Marcar Todas como Lidas</Button>
      </PageHeader>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>Todas</button>
        <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>Não Lidas</button>
      </div>

      {isLoading ? <ListSkeleton count={5} /> : (notifications || []).length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title="Nenhuma notificação" description="Você está em dia! Não há notificações no momento." />
      ) : (
        <div className="space-y-2">
          {(notifications || []).map((n: any) => {
            const Icon = NOTIF_ICONS[n.type] || Bell;
            return (
              <Card key={n.id} className={`glass border-border/50 hover:gold-glow transition-all duration-300 animate-fade-in ${!n.is_read ? 'border-primary/30' : ''}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-primary/15 text-primary' : 'bg-secondary/50 text-muted-foreground'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{n.title}</h3>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">{formatDateTime(n.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    {!n.is_read && <Button size="icon" variant="ghost" onClick={() => markAsRead(n.id)} className="h-8 w-8"><CheckCheck className="h-4 w-4" /></Button>}
                    <Button size="icon" variant="ghost" onClick={() => deleteNotif(n.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
