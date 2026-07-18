import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateNotificationTime, signOut } from '../services/auth';
import { getNotificationPermissionStatus, registerForPushNotifications } from '../services/notifications';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TimePicker } from '../components/TimePicker';
import { Colors, Typography, Spacing, THEMES, THEME_ORDER } from '../constants/theme';

export default function SettingsScreen() {
  const { user, setUser } = useAuth();
  const { themeId, setThemeId, pendingThemeId } = useTheme();
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  useEffect(() => {
    let mounted = true;
    getNotificationPermissionStatus().then((s) => { if (mounted) setPermissionStatus(s); });
    return () => { mounted = false; };
  }, []);

  async function handleEnableNotifications() {
    if (!user) return;
    setLoading(true);
    try {
      await registerForPushNotifications(user.id);
      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings.'
        );
      }
    } catch {
      // Ignore — token save failures are non-critical
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  // Parse current notification time to Date object
  const [hours, minutes] = user.preferred_notification_time.split(':');
  const currentTime = new Date();
  currentTime.setHours(parseInt(hours), parseInt(minutes));

  async function handleTimeChange(selectedTime: Date) {
    if (!user) return;

    setLoading(true);
    try {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}:00`;

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
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Notifications</Text>
          <MaterialCommunityIcons name="bell-outline" size={22} color={Colors.stoneGray} />
        </View>
        {permissionStatus === 'denied' ? (
          <>
            <Text style={styles.permissionDenied}>
              Notifications are disabled. Enable them in your device settings to receive daily reading reminders.
            </Text>
            <Button
              title="Enable Notifications"
              onPress={handleEnableNotifications}
              loading={loading}
              style={styles.permissionButton}
            />
          </>
        ) : (
          <>
            <TimePicker
              label="Daily reminder time"
              value={currentTime}
              onChange={handleTimeChange}
            />
            <Text style={styles.hint}>
              You'll receive a daily reading reminder at this time
            </Text>
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Appearance</Text>
          <MaterialCommunityIcons name="palette-outline" size={22} color={Colors.stoneGray} />
        </View>
        <Text style={styles.label}>Color theme</Text>
        <View style={styles.swatchRow}>
          {THEME_ORDER.map((id) => {
            const t = THEMES[id];
            const isActive = id === themeId;
            const isPending = id === pendingThemeId;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setThemeId(id)}
                style={styles.swatchWrapper}
                activeOpacity={0.7}
                disabled={isPending}
              >
                <View style={[
                  styles.swatch,
                  { backgroundColor: t.primary },
                  isActive && styles.swatchActive,
                  isPending && styles.swatchPending,
                ]}>
                  {isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : isActive ? (
                    <MaterialCommunityIcons name="check" size={18} color={Colors.white} />
                  ) : null}
                </View>
                <Text style={[styles.swatchLabel, isActive && { color: t.primary }]}>{t.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Profile</Text>
          <MaterialCommunityIcons name="account-circle-outline" size={22} color={Colors.stoneGray} />
        </View>
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
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Account</Text>
          <MaterialCommunityIcons name="shield-account-outline" size={22} color={Colors.stoneGray} />
        </View>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.text,
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
  permissionDenied: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  permissionButton: {
    marginTop: Spacing.xs,
  },
  row: {
    marginBottom: Spacing.md,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  swatchWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  swatchPending: {
    opacity: 0.6,
  },
  swatchLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
