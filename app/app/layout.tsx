'use client';

import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/auth-guards';
import { AppShell } from '@/components/app-shell';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useRequireAuth();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const receptionistPaths = [
    '/app', '/app/appointments', '/app/clients', '/app/collaborators',
    '/app/services', '/app/products', '/app/inventory', '/app/pos',
    '/app/loyalty', '/app/booking-links', '/app/notifications', '/app/profile', '/app/search',
  ];

  useEffect(() => {
    if (!loading && user?.role === 'client') {
      router.replace('/acompanhar');
    } else if (!loading && user?.role === 'receptionist') {
      const allowed = receptionistPaths.some((path) =>
        path === '/app' ? pathname === path : pathname.startsWith(path)
      );
      if (!allowed) router.replace('/app');
    }
  }, [user, loading, router, pathname]);

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
