'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else {
        setAuthChecked(true);
      }
    }
  }, [user, loading, router]);

  return { user, loading: loading || !authChecked };
}

export function useRequireRole(roles: UserRole[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!roles.includes(user.role)) {
        router.replace('/app');
      } else {
        setChecked(true);
      }
    }
  }, [user, loading, router, roles]);

  return { user, loading: loading || !checked };
}

export function useRedirectIfAuthed() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'client') {
        router.replace('/acompanhar');
      } else {
        router.replace('/app');
      }
    }
  }, [user, loading, router]);

  return { user, loading };
}
