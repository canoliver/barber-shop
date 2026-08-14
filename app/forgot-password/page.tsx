'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scissors, Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) {
      toast.error('Erro ao enviar e-mail de recuperação. Tente novamente.');
    } else {
      setSent(true);
      toast.success('E-mail de recuperação enviado!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-charcoal-light/30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-copper/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center gold-glow mb-4">
            <Scissors className="h-8 w-8 text-charcoal" />
          </div>
          <h1 className="font-playfair text-4xl font-bold gold-text">BarberPro</h1>
        </div>

        <Card className="glass-strong border-border/50">
          <CardHeader>
            <CardTitle className="font-playfair text-2xl">Recuperar Senha</CardTitle>
            <CardDescription>
              {sent ? 'Verifique seu e-mail para as instruções de recuperação.' : 'Informe seu e-mail para receber as instruções de recuperação.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Enviamos um link de recuperação para <strong className="text-foreground">{email}</strong>.
                  Verifique sua caixa de entrada e spam.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-background/50"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full gold-gradient text-charcoal font-semibold hover:opacity-90" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar Link de Recuperação'}
                </Button>
                <Link href="/login" className="block text-center text-sm text-primary hover:underline">
                  Voltar para login
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
