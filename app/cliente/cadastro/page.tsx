'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Mail, Phone, Scissors, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maskPhone } from '@/lib/format';

function safeBookingPath(value: string | null) {
  return value?.startsWith('/agendar/') ? value : '/acompanhar';
}

export default function ClientSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeBookingPath(searchParams.get('next'));
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmation) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim(), phone, role: 'client' } },
    });

    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message || 'Não foi possível criar sua conta.');
      return;
    }

    if (data.session) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        phone,
        role: 'client',
        is_active: true,
        must_change_password: false,
      });
      await supabase.from('clients').upsert({
        auth_user_id: data.user.id,
        full_name: fullName.trim(),
        phone,
        email: email.trim().toLowerCase(),
      }, { onConflict: 'auth_user_id' });
      toast.success('Conta criada com sucesso!');
      router.replace(nextPath);
    } else {
      toast.success('Conta criada! Confirme seu e-mail antes de entrar.');
      router.replace(`/cliente/login?next=${encodeURIComponent(nextPath)}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-charcoal-light/30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center gold-glow mb-4"><Scissors className="h-8 w-8 text-charcoal" /></div>
          <h1 className="font-playfair text-4xl font-bold gold-text">BarberPro</h1>
          <p className="text-muted-foreground mt-2">Cadastro exclusivo para clientes</p>
        </div>
        <Card className="glass-strong border-border/50">
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>Cadastre-se para continuar seu agendamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="signup-name">Nome completo</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="pl-10" required /></div></div>
              <div className="space-y-2"><Label htmlFor="signup-phone">Telefone</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-phone" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} className="pl-10" required /></div></div>
              <div className="space-y-2"><Label htmlFor="signup-email">E-mail</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" required /></div></div>
              <div className="space-y-2"><Label htmlFor="signup-password">Senha</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" required /></div></div>
              <div className="space-y-2"><Label htmlFor="signup-confirmation">Confirme a senha</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="pl-10" required /></div></div>
              <Button type="submit" disabled={loading} className="w-full gold-gradient text-charcoal font-semibold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar conta e continuar'}</Button>
              <p className="text-center text-sm text-muted-foreground">Já possui cadastro?{' '}<Link href={`/cliente/login?next=${encodeURIComponent(nextPath)}`} className="text-primary hover:underline">Entrar</Link></p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}