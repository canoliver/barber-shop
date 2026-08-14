'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/lib/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string, sessionUser?: SupabaseUser) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar perfil:', error);
      return null;
    }

    const resolvedUser = sessionUser || (await supabase.auth.getUser()).data.user;
    if (!resolvedUser) return null;

    const meta = resolvedUser.user_metadata || {};
    const metadataName = String(meta.full_name || meta.name || meta.display_name || '').trim();
    const emailName = (resolvedUser.email || '')
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const fullName = metadataName || emailName || 'Usuário';
    const avatarUrl = meta.avatar_url || meta.picture || '';
    const role = (meta.role as UserRole) || 'barber';

    if (data) {
      const profile = {
        ...data,
        full_name: data.full_name?.trim() || fullName,
        email: resolvedUser.email || '',
      } as Profile;

      if (!data.full_name?.trim() && metadataName) {
        await supabase.from('profiles').update({ full_name: metadataName }).eq('id', userId);
      }

      return profile;
    }

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        avatar_url: avatarUrl,
        role,
        is_active: true,
      })
      .select('*')
      .maybeSingle();

    if (insertError) {
      console.error('Erro ao criar perfil:', insertError);
      return null;
    }
    return newProfile
      ? ({ ...newProfile, email: resolvedUser.email || '' } as Profile)
      : null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        const profile = await loadProfile(session.user.id, session.user);
        if (mounted) {
          setUser(profile);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        (async () => {
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null);
            setLoading(false);
            return;
          }
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            const profile = await loadProfile(session.user.id, session.user);
            if (mounted) setUser(profile);
            setLoading(false);
          }
        })();
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: getAuthErrorMessage(error.message) };
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) return { error: getAuthErrorMessage(error.message) };
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        role,
      });
    }
    return { error: null };
  };

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) return { error: getAuthErrorMessage(error.message) };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const profile = await loadProfile(user.id);
    if (profile) setUser(profile);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Usuário não autenticado' };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    if (error) return { error: getAuthErrorMessage(error.message) };
    await refreshProfile();
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

function getAuthErrorMessage(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters.': 'A senha deve ter no mínimo 6 caracteres.',
    'Email not confirmed': 'E-mail não confirmado.',
  };
  return map[message] || message;
}
