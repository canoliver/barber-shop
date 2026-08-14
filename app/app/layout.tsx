'use client';

import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/auth-guards';
import { AppShell } from '@/components/app-shell';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === 'client') {
      router.replace('/acompanhar');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role === 'client') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
