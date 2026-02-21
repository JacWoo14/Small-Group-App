import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { ensureUserProfile } from '../services/auth';
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

  useEffect(() => {
    // Get initial session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthUser(session?.user ?? null);

      if (session?.user) {
        // Check if user profile exists in our users table
        ensureUserProfile(session.user.id, session.user.email!).then(
          (profile) => {
            if (profile) {
              setUser(profile);
              setNeedsOnboarding(false);
            } else {
              // User authenticated but no profile = needs onboarding
              setNeedsOnboarding(true);
            }
            setLoading(false);
          }
        );
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthUser(session?.user ?? null);

      if (session?.user) {
        // User signed in - check for profile
        ensureUserProfile(session.user.id, session.user.email!).then(
          (profile) => {
            if (profile) {
              setUser(profile);
              setNeedsOnboarding(false);
            } else {
              setNeedsOnboarding(true);
            }
            setLoading(false);
          }
        );
      } else {
        // User signed out
        setUser(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
