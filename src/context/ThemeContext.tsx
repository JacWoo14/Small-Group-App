import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { THEMES, ThemeId, AppTheme, DEFAULT_THEME_ID, resolveThemeId } from '../constants/theme';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';

type ThemeContextType = {
  theme: AppTheme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => Promise<void>;
  pendingThemeId: ThemeId | null; // swatch currently being written, for a pending/disabled indicator
};

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES[DEFAULT_THEME_ID],
  themeId: DEFAULT_THEME_ID,
  setThemeId: async () => {},
  pendingThemeId: null,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const [themeId, setThemeIdState] = useState<ThemeId>(() => resolveThemeId(user?.theme_id));
  const [pendingThemeId, setPendingThemeId] = useState<ThemeId | null>(null);
  const generationRef = useRef(0);

  // Resync when the authenticated user changes within one app session (e.g.
  // sign out, then sign in as someone else on a shared device) — otherwise
  // the previous user's theme would linger until an unrelated re-render.
  useEffect(() => {
    setThemeIdState(resolveThemeId(user?.theme_id));
  }, [user?.id]);

  async function setThemeId(id: ThemeId) {
    if (!user) return;

    const previousThemeId = themeId;
    const generation = ++generationRef.current;

    setThemeIdState(id);
    setPendingThemeId(id);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ theme_id: id })
        .eq('id', user.id)
        .select('id');

      if (error) throw error;
      // Supabase returns 0 rows with no error when RLS silently blocks an
      // update — same gotcha as changeGroupPlan/transferGroupOwnership.
      if (!data || data.length === 0) {
        throw new Error('Update blocked — you may not have permission to change this preference.');
      }

      // Only apply if no newer write has been dispatched since — otherwise a
      // slow success could stomp a faster, already-resolved write's state.
      if (generationRef.current === generation) {
        setUser({ ...user, theme_id: id });
        setPendingThemeId(null);
      }
    } catch (error: any) {
      if (generationRef.current === generation) {
        setThemeIdState(previousThemeId);
        setPendingThemeId(null);
        Alert.alert('Error', error.message || 'Failed to update theme');
      }
    }
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], themeId, setThemeId, pendingThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
