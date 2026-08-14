'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Users, Package, Scissors, Calendar } from 'lucide-react';
import Link from 'next/link';
import { getInitials, formatPhone, formatCurrency, formatDate } from '@/lib/format';

export default function SearchPage() {
  const params = useSearchParams();
  const q = params.get('q') || '';
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<{ clients: any[]; products: any[]; services: any[]; appointments: any[] }>({ clients: [], products: [], services: [], appointments: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q) performSearch(q);
  }, [q]);

  const performSearch = async (search: string) => {
    if (!search.trim()) return;
    setLoading(true);
    const [clients, products, services, appointments] = await Promise.all([
      supabase.from('clients').select('*').or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`).limit(5),
      supabase.from('products').select('*').or(`name.ilike.%${search}%,sku.ilike.%${search}%`).limit(5),
      supabase.from('services').select('*').ilike('name', `%${search}%`).limit(5),
      supabase.from('appointments').select('*, client:clients(full_name), service:services(name)').or(`client_name.ilike.%${search}%`).limit(5),
    ]);
    setResults({ clients: clients.data || [], products: products.data || [], services: services.data || [], appointments: appointments.data || [] });
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) performSearch(query);
  };

  const hasResults = results.clients.length > 0 || results.products.length > 0 || results.services.length > 0 || results.appointments.length > 0;

  return (
    <div>
      <PageHeader title="Busca Global" description="Pesquise em todo o sistema." />
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10 bg-background/50" autoFocus />
        </div>
      </form>

      {loading ? <p className="text-muted-foreground text-center py-8">Buscando...</p> : !hasResults && q ? (
        <p className="text-muted-foreground text-center py-8">Nenhum resultado encontrado para "{q}".</p>
      ) : (
        <div className="space-y-6">
          {results.clients.length > 0 && (
            <div>
              <h2 className="font-playfair text-lg font-semibold mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Clientes</h2>
              <div className="space-y-2">
                {results.clients.map(c => (
                  <Link key={c.id} href={`/app/clients/${c.id}`}>
                    <Card className="glass border-border/50 hover:gold-glow transition-all cursor-pointer"><CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/20 text-primary">{getInitials(c.full_name)}</AvatarFallback></Avatar>
                      <div><p className="font-medium">{c.full_name}</p><p className="text-sm text-muted-foreground">{formatPhone(c.phone)}</p></div>
                    </CardContent></Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {results.services.length > 0 && (
            <div>
              <h2 className="font-playfair text-lg font-semibold mb-3 flex items-center gap-2"><Scissors className="h-5 w-5 text-primary" /> Serviços</h2>
              <div className="space-y-2">
                {results.services.map(s => <Card key={s.id} className="glass border-border/50"><CardContent className="p-4 flex items-center justify-between"><div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.category}</p></div><span className="text-primary font-bold">{formatCurrency(s.price)}</span></CardContent></Card>)}
              </div>
            </div>
          )}
          {results.products.length > 0 && (
            <div>
              <h2 className="font-playfair text-lg font-semibold mb-3 flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Produtos</h2>
              <div className="space-y-2">
                {results.products.map(p => <Card key={p.id} className="glass border-border/50"><CardContent className="p-4 flex items-center justify-between"><div><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">{p.brand} • {p.sku}</p></div><span className="text-primary font-bold">{formatCurrency(p.selling_price)}</span></CardContent></Card>)}
              </div>
            </div>
          )}
          {results.appointments.length > 0 && (
            <div>
              <h2 className="font-playfair text-lg font-semibold mb-3 flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Agendamentos</h2>
              <div className="space-y-2">
                {results.appointments.map(a => <Link key={a.id} href="/app/appointments"><Card className="glass border-border/50 hover:gold-glow transition-all cursor-pointer"><CardContent className="p-4"><p className="font-medium">{a.client?.full_name || a.client_name || 'Cliente'}</p><p className="text-sm text-muted-foreground">{formatDate(a.appointment_date)} • {a.service?.name || '—'}</p></CardContent></Card></Link>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
