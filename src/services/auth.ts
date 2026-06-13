import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Get the correct redirect URL based on platform
 * Web: uses window.location.origin (matches running dev server)
 * Mobile: uses Expo deep link scheme
 */
function getRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8082';
  }
  return 'myapp://auth/callback';
}

/**
 * Send magic link to user's email
 * User clicks the link in their email to sign in (no password needed!)
 */
export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.toLowerCase().trim(),
    options: {
      emailRedirectTo: getRedirectUrl(),
    },
  });

  if (error) throw error;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current user session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Check if user profile exists in our users table
 * Returns null if user needs onboarding (first time)
 */
export async function ensureUserProfile(authUserId: string, email: string) {
  const { data: existingUser } = await supabase
    .from('users')
    .select()
    .eq('id', authUserId)
    .single();

  if (!existingUser) {
    // User is new, needs onboarding
    return null;
  }

  return existingUser;
}

/**
 * Create user profile (called from onboarding screen)
 * This creates a record in our users table (separate from Supabase auth)
 */
export async function createUserProfile(params: {
  id: string;
  email: string;
  displayName: string;
  notificationTime: string; // "HH:MM" format, e.g. "07:00"
}) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: params.id,
      email: params.email,
      display_name: params.displayName,
      preferred_notification_time: params.notificationTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Auto-detect timezone
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update user's notification time preference
 */
export async function updateNotificationTime(userId: string, time: string) {
  const { error } = await supabase
    .from('users')
    .update({ preferred_notification_time: time })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Update user's display name
 */
export async function updateDisplayName(userId: string, displayName: string) {
  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName })
    .eq('id', userId);

  if (error) throw error;
}
