'use client';

import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/auth-guards';
import { Loader2 } from 'lucide-react';

export default function AcompanharLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useRequireAuth();
  const { user } = useAuth();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
