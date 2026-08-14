'use client';

import { BrandLogo, BrandName } from '@/components/brand';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Mail, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ClientLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const bookingNext = requestedNext?.startsWith('/agendar/') ? requestedNext : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setLoading(false);
      toast.error('E-mail ou senha incorretos.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active, must_change_password')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'client') {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error('Esta conta não é de cliente. Use o acesso da equipe.');
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error('Sua conta está inativa. Entre em contato com a barbearia.');
      return;
    }

    toast.success('Bem-vindo à sua área!');
    const destination = bookingNext || '/acompanhar';
    router.replace(profile.must_change_password
      ? `/cliente/primeiro-acesso?next=${encodeURIComponent(destination)}`
      : destination);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-charcoal-light/30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="w-28 h-28 rounded-3xl mb-5" iconClassName="h-12 w-12" />
          <h1 className="font-playfair text-4xl font-bold gold-text"><BrandName /></h1>
          <p className="text-muted-foreground mt-2">Área exclusiva para clientes</p>
        </div>

        <Card className="glass-strong border-border/50">
          <CardHeader>
            <CardTitle className="font-playfair text-2xl">Acesso do cliente</CardTitle>
            <CardDescription>Entre para acompanhar seus agendamentos e benefícios</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="client-email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-10 bg-background/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="client-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pl-10 bg-background/50"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gold-gradient text-charcoal font-semibold hover:opacity-90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
              </Button>

              <div className="flex justify-end text-sm">
                <Link href="/forgot-password?from=client" className="text-primary hover:underline">
                  Esqueci minha senha
                </Link>
              </div>

              {bookingNext && (
                <div className="pt-4 border-t border-border/50 text-center text-sm text-muted-foreground">
                  Ainda não possui cadastro?{' '}
                  <Link href={`/cliente/cadastro?next=${encodeURIComponent(bookingNext)}`} className="text-primary hover:underline">
                    Criar conta de cliente
                  </Link>
                </div>
              )}


            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}