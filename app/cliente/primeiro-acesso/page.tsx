'use client';

import { BrandLogo, BrandName } from '@/components/brand';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function FirstAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const nextPath = requestedNext?.startsWith('/agendar/') ? requestedNext : '/acompanhar';
  const { user, loading: authLoading, refreshProfile } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace(`/cliente/login?next=${encodeURIComponent(nextPath)}`);
    else if (user.role !== 'client') router.replace('/app');
    else if (!user.must_change_password) router.replace(nextPath);
  }, [authLoading, user, router, nextPath]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (password.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password === '123456') {
      toast.error('Escolha uma senha diferente da senha padrão.');
      return;
    }
    if (password !== confirmation) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      toast.error(passwordError.message);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (profileError) {
      toast.error('Senha alterada, mas não foi possível concluir o primeiro acesso.');
      setLoading(false);
      return;
    }

    await refreshProfile();
    toast.success('Nova senha criada com sucesso!');
    router.replace(nextPath);
  };

  if (authLoading || !user || user.role !== 'client' || !user.must_change_password) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-charcoal-light/30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="w-16 h-16 rounded-2xl mb-4" iconClassName="h-8 w-8" />
          <h1 className="font-playfair text-4xl font-bold gold-text"><BrandName /></h1>
        </div>
        <Card className="glass-strong border-border/50">
          <CardHeader>
            <CardTitle>Crie sua nova senha</CardTitle>
            <CardDescription>Por segurança, substitua a senha padrão antes de acessar sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirme a nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="pl-10" required />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gold-gradient text-charcoal font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar nova senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}