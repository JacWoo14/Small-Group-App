# Phase 1: Foundation Implementation Guide

## 🎯 GOAL
User can authenticate with email magic link, set notification preferences, see a reading, and mark it complete.

**Timeline:** 5-7 days
**Difficulty:** Beginner-friendly with step-by-step guidance

---

## 📦 STEP 1: Install Dependencies

Run these commands in order:

```bash
# Expo-specific packages (use npx expo install for compatibility)
npx expo install expo-notifications expo-device expo-barcode-scanner @react-native-community/datetimepicker expo-linking expo-clipboard expo-secure-store

# NPM packages
npm install @supabase/supabase-js @tanstack/react-query date-fns react-native-qrcode-svg

# Dev dependencies
npm install --save-dev @testing-library/react-native jest
```

**What each package does:**
- `expo-notifications` - Push notifications
- `expo-secure-store` - Secure token storage (encrypted)
- `@supabase/supabase-js` - Supabase client library
- `@tanstack/react-query` - Data fetching/caching (optional but recommended)
- `date-fns` - Date utilities
- `@react-native-community/datetimepicker` - Time picker for notification preferences

---

## 🗄️ STEP 2: Set Up Supabase Project

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Name: `bible-reading-app`
   - Database Password: (generate strong password, save it!)
   - Region: Choose closest to you
   - Plan: Free tier

4. Wait ~2 minutes for project to be ready

### 2.2 Get Your Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (long string starting with `eyJ...`)

### 2.3 Create `.env` File

Create a file at the root: `.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...your-anon-key
```

**Important:** Add `.env` to `.gitignore`!

### 2.4 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Copy contents of `database/schema.sql`
3. Paste and click **Run**
4. Verify: Go to **Table Editor**, you should see `users`, `groups`, `reading_plans`, etc.

### 2.5 Seed Reading Plans

1. In SQL Editor, copy contents of `database/seed_plans.sql`
2. Run it
3. Verify: Click on `reading_plans` table, should see 4 plans

### 2.6 Configure Email Auth

1. Go to **Authentication** → **Providers**
2. Find **Email** provider
3. Enable **Email Auth**
4. Disable **Confirm email** (for easier testing)
5. **Enable Email Magic Link** (most important!)
6. Save

### 2.7 Configure Deep Linking

1. Go to **Authentication** → **URL Configuration**
2. Add **Redirect URL**: `exp://192.168.1.x:8081` (replace with your dev machine IP)
   - Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
   - For production, use custom scheme like `myapp://`
3. Save

---

## 📁 STEP 3: Set Up Project Structure

Create these folders and files:

```bash
mkdir -p src/services src/hooks src/context src/screens/auth src/components/ui src/utils
```

Files to create (we'll fill them in next steps):
- `src/services/supabase.ts`
- `src/services/auth.ts`
- `src/context/AuthContext.tsx`
- `src/hooks/useAuth.ts`
- `src/screens/auth/AuthScreen.tsx`
- `src/screens/auth/OnboardingScreen.tsx`
- `src/screens/TodayScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Card.tsx`
- `src/utils/dateUtils.ts`

---

## 🔧 STEP 4: Create Supabase Client

**File: `src/services/supabase.ts`**

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage using Expo SecureStore (encrypted)
const SecureStoreAdapter = {
  getItem: async (key: string) => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // For magic link callback
  },
});
```

**What this does:**
- Creates Supabase client
- Uses SecureStore for auth tokens (encrypted, secure)
- Auto-refreshes tokens (keeps user logged in)
- Detects magic link callback URLs

**Note:** We'll generate `types/database.ts` later using Supabase CLI.

---

## 🔐 STEP 5: Create Auth Service

**File: `src/services/auth.ts`**

```typescript
import { supabase } from './supabase';
import * as Linking from 'expo-linking';

/**
 * Send magic link to user's email
 */
export async function signInWithEmail(email: string) {
  const redirectUrl = Linking.createURL('/auth/callback');

  const { error } = await supabase.auth.signInWithOtp({
    email: email.toLowerCase().trim(),
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) throw error;
}

/**
 * Handle magic link callback (when user clicks email link)
 */
export async function handleAuthCallback(url: string) {
  const { data, error } = await supabase.auth.getSessionFromUrl({
    url,
    storeSession: true,
  });

  if (error) throw error;
  return data.session;
}

/**
 * Sign out
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
 * Check if user profile exists, create if not
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
 * Create user profile (called from onboarding)
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update notification time
 */
export async function updateNotificationTime(userId: string, time: string) {
  const { error } = await supabase
    .from('users')
    .update({ preferred_notification_time: time })
    .eq('id', userId);

  if (error) throw error;
}
```

**Key functions:**
- `signInWithEmail()` - Sends magic link to email
- `handleAuthCallback()` - Processes magic link click
- `createUserProfile()` - Creates user in our `users` table (separate from auth)
- `ensureUserProfile()` - Checks if user needs onboarding

---

## 🎣 STEP 6: Create Auth Context

**File: `src/context/AuthContext.tsx`**

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { ensureUserProfile } from '../services/auth';

type User = {
  id: string;
  email: string;
  display_name: string;
  preferred_notification_time: string;
  timezone: string;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  authUser: AuthUser | null;
  loading: boolean;
  needsOnboarding: boolean;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthUser(session?.user ?? null);

      if (session?.user) {
        // Check if user profile exists
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
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthUser(session?.user ?? null);

      if (session?.user) {
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**What this does:**
- Manages global auth state
- Listens for auth changes (login, logout)
- Checks if user needs onboarding
- Provides `useAuth()` hook for components

---

## 🎨 STEP 7: Create UI Components

### Button Component

**File: `src/components/ui/Button.tsx`**

```typescript
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import { Colors, Typography, BorderRadius } from '../../constants/theme';

type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? Colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.textSecondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...Typography.button,
    color: '#fff',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#fff',
  },
  outlineText: {
    color: Colors.primary,
  },
});
```

### Input Component

**File: `src/components/ui/Input.tsx`**

```typescript
import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../../constants/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={Colors.textSecondary}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 48,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: Colors.error,
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
```

### Card Component

**File: `src/components/ui/Card.tsx`**

```typescript
import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { CommonStyles } from '../../constants/theme';

export function Card({ style, children, ...props }: ViewProps) {
  return (
    <View style={[CommonStyles.card, style]} {...props}>
      {children}
    </View>
  );
}
```

---

## 📱 STEP 8: Create Auth Screen

**File: `src/screens/auth/AuthScreen.tsx`**

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { signInWithEmail } from '../../services/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, Typography, Spacing } from '../../constants/theme';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email);
      Alert.alert(
        'Check your email!',
        `We sent a magic link to ${email}. Click the link to sign in.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          Sign in with your email to start reading
        </Text>

        <Input
          label="Email"
          placeholder="your@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Button
          title="Send Magic Link"
          onPress={handleSignIn}
          loading={loading}
        />

        <Text style={styles.hint}>
          We'll send you a magic link to sign in. No password needed!
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
```

---

## 🎓 STEP 9: Create Onboarding Screen

**File: `src/screens/auth/OnboardingScreen.tsx`**

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createUserProfile } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, Typography, Spacing } from '../../constants/theme';

export function OnboardingScreen() {
  const { authUser, setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [notificationTime, setNotificationTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!authUser) {
      Alert.alert('Error', 'Authentication error. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Format time as HH:MM
      const hours = notificationTime.getHours().toString().padStart(2, '0');
      const minutes = notificationTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      const user = await createUserProfile({
        id: authUser.id,
        email: authUser.email!,
        displayName: displayName.trim(),
        notificationTime: timeString,
      });

      setUser(user);
      // AuthContext will detect user is set and navigate away
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>One more thing...</Text>
        <Text style={styles.subtitle}>
          Let's personalize your reading experience
        </Text>

        <Input
          label="What should we call you?"
          placeholder="Your name"
          value={displayName}
          onChangeText={setDisplayName}
          autoFocus
        />

        <View style={styles.timePickerContainer}>
          <Text style={styles.label}>Daily reminder time</Text>
          <Button
            title={notificationTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            variant="outline"
            onPress={() => setShowTimePicker(true)}
          />
          {showTimePicker && (
            <DateTimePicker
              value={notificationTime}
              mode="time"
              display="spinner"
              onChange={(event, selectedTime) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (selectedTime) {
                  setNotificationTime(selectedTime);
                }
              }}
            />
          )}
        </View>

        <Button
          title="Get Started"
          onPress={handleComplete}
          loading={loading}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  timePickerContainer: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
});
```

---

## 📅 STEP 10: Create Today Screen (Basic Version)

**File: `src/screens/TodayScreen.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Colors, Typography, Spacing } from '../constants/theme';
import { format } from 'date-fns';

export function TodayScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Hardcoded reading for now (Phase 3 will fetch from group)
  const todaysReading = {
    passages: [
      { book: 'Genesis', chapters: '1-2' },
      { book: 'Matthew', chapter: '1' },
      { book: 'Psalm', chapter: '1' },
    ],
  };

  async function handleMarkComplete() {
    if (!user) return;

    setLoading(true);
    try {
      // For Phase 1, we'll just insert with a dummy group_id
      // Phase 3 will use real groups
      const { error } = await supabase.from('reading_completions').insert({
        user_id: user.id,
        group_id: '00000000-0000-0000-0000-000000000000', // Placeholder
        reading_date: format(new Date(), 'yyyy-MM-dd'),
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      setCompleted(true);
      Alert.alert('Great job!', 'Reading marked as complete! 📖');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark complete');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning, {user?.display_name}!</Text>
        <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      <Card style={styles.readingCard}>
        <Text style={styles.cardTitle}>Today's Reading</Text>
        {todaysReading.passages.map((passage, index) => (
          <Text key={index} style={styles.passage}>
            {passage.book} {passage.chapters || passage.chapter}
          </Text>
        ))}

        <Button
          title={completed ? 'Completed ✓' : 'Mark Complete'}
          onPress={handleMarkComplete}
          loading={loading}
          disabled={completed}
          style={styles.button}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Your Notification Time</Text>
        <Text style={styles.infoText}>
          Daily reminder set for {user?.preferred_notification_time}
        </Text>
        <Text style={styles.hint}>
          Change this in Settings if you'd like a different time
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  greeting: {
    ...Typography.h2,
    color: Colors.text,
  },
  date: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  readingCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  passage: {
    ...Typography.bodyLarge,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  button: {
    marginTop: Spacing.md,
  },
  infoText: {
    ...Typography.body,
    color: Colors.text,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
```

---

## ⚙️ STEP 11: Create Settings Screen

**File: `src/screens/SettingsScreen.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { updateNotificationTime, signOut } from '../services/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Colors, Typography, Spacing } from '../constants/theme';
import { Platform } from 'react-native';

export function SettingsScreen() {
  const { user, setUser } = useAuth();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  // Parse current notification time to Date object
  const [hours, minutes] = user.preferred_notification_time.split(':');
  const currentTime = new Date();
  currentTime.setHours(parseInt(hours), parseInt(minutes));

  async function handleTimeChange(event: any, selectedTime?: Date) {
    setShowTimePicker(Platform.OS === 'ios');

    if (selectedTime && user) {
      setLoading(true);
      try {
        const hours = selectedTime.getHours().toString().padStart(2, '0');
        const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        await updateNotificationTime(user.id, timeString);

        // Update local state
        setUser({
          ...user,
          preferred_notification_time: timeString,
        });

        Alert.alert('Success', 'Notification time updated!');
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to update time');
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to sign out');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.label}>Daily reminder time</Text>
        <Button
          title={currentTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          variant="outline"
          onPress={() => setShowTimePicker(true)}
          loading={loading}
        />
        <Text style={styles.hint}>
          You'll receive a daily reminder at this time
        </Text>

        {showTimePicker && (
          <DateTimePicker
            value={currentTime}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
          />
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{user.display_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Timezone</Text>
          <Text style={styles.value}>{user.timezone}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Button
          title="Sign Out"
          variant="outline"
          onPress={handleSignOut}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Spacing.md,
  },
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  value: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  row: {
    marginBottom: Spacing.md,
  },
});
```

---

## 🗺️ STEP 12: Set Up Navigation

**File: `App.tsx`** (replace existing)

```typescript
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { handleAuthCallback } from './src/services/auth';
import { AuthScreen } from './src/screens/auth/AuthScreen';
import { OnboardingScreen } from './src/screens/auth/OnboardingScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ActivityIndicator, View, Text } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main app tabs
function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ title: 'Today' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// Root navigator
function RootNavigator() {
  const { session, user, loading, needsOnboarding } = useAuth();

  // Handle deep links (magic link callback)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthCallback(url);
    });

    return () => subscription.remove();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : needsOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
```

**Install navigation dependencies:**
```bash
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
```

---

## ✅ STEP 13: Test Phase 1

### 13.1 Start the app

```bash
npm start
```

### 13.2 Test Flow

1. **Sign In:**
   - Enter your email
   - Check email for magic link
   - Click link → should redirect to app

2. **Onboarding:**
   - Enter your name
   - Set notification time (e.g., 7:00 AM)
   - Click "Get Started"

3. **Today Screen:**
   - See hardcoded reading (Genesis 1-2, etc.)
   - Click "Mark Complete"
   - Should see success message

4. **Settings:**
   - Change notification time
   - See profile info
   - Sign out

5. **Verify in Supabase:**
   - Go to Supabase Table Editor
   - Check `users` table → should see your profile
   - Check `reading_completions` → should see your completion

---

## 🐛 TROUBLESHOOTING

### "npm: command not found" after restarting VS Code

**Solution:** Fully close and reopen VS Code (not just new terminal)

### Magic link not working

**Solution:**
- Check Supabase redirect URL matches your dev URL
- Use your computer's IP address (not localhost)
- For iOS, test on real device (simulator has issues)

### DateTimePicker not showing

**Solution:**
```bash
npx expo install @react-native-community/datetimepicker
```

### TypeScript errors about `Database` type

**Solution:** Generate types from Supabase:
```bash
npx supabase login
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

Replace `YOUR_PROJECT_ID` with your Supabase project ID (from URL)

---

## 📚 WHAT YOU LEARNED

✅ Setting up Supabase with React Native
✅ Email magic link authentication
✅ Row Level Security policies
✅ React Context for global state
✅ React Navigation (Stack + Tab)
✅ Deep linking (for magic link callback)
✅ Time picker for notification preferences
✅ Basic CRUD operations with Supabase

---

## 🎯 PHASE 1 COMPLETE!

**You now have:**
- ✅ Working authentication
- ✅ User profiles with notification preferences
- ✅ Basic reading display
- ✅ Mark complete functionality
- ✅ Settings screen

**Next: Phase 2 - Notifications** (see PHASE_2_IMPLEMENTATION.md)
