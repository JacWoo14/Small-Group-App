import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabase';
import { ensureUserProfile } from '../services/auth';
import { registerForPushNotifications } from '../services/notifications';
import { User } from '../types';

type AuthContextType = {
  session: Session | null;
  user: User | null; // Our user from users table
  authUser: AuthUser | null; // Supabase auth user
  loading: boolean;
  needsOnboarding: boolean;
  setUser: (user: User) => void; // For updating user after onboarding
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  function handleProfileLoaded(profile: User | null, registerPush = false) {
    if (profile) {
      setUser(profile);
      setNeedsOnboarding(false);
      if (registerPush) {
        registerForPushNotifications(profile.id).catch(() => {});
      }
    } else {
      setNeedsOnboarding(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    // Get initial session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthUser(session?.user ?? null);

      if (session?.user) {
        ensureUserProfile(session.user.id, session.user.email!).then(
          (profile) => handleProfileLoaded(profile, true)
        );
      } else {
        setLoading(false);
      }
    });

    // Handle magic link deep links (myapp://auth/callback#access_token=...&refresh_token=...)
    const handleDeepLink = async (url: string) => {
      const hash = url.split('#')[1];
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthUser(session?.user ?? null);

      if (session?.user) {
        ensureUserProfile(session.user.id, session.user.email!).then(
          (profile) => handleProfileLoaded(profile, event === 'SIGNED_IN')
        );
      } else {
        // User signed out
        setUser(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        authUser,
        loading,
        needsOnboarding,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * Use this in any component that needs auth info
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
