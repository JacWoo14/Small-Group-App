import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { updateNotificationTime, signOut } from '../services/auth';
import { getNotificationPermissionStatus, registerForPushNotifications } from '../services/notifications';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TimePicker } from '../components/TimePicker';
import { Colors, Typography, Spacing } from '../constants/theme';

export default function SettingsScreen() {
  const { user, setUser } = useAuth();
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
        <Text style={styles.cardTitle}>Notifications</Text>
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
});
