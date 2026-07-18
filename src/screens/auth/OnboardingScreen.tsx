import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { createUserProfile } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { TimePicker } from '../../components/TimePicker';
import { Colors, Typography, Spacing } from '../../constants/theme';

export function OnboardingScreen() {
  const { authUser, setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [notificationTime, setNotificationTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitting = React.useRef(false);

  // Set default time to 7:00 AM
  React.useEffect(() => {
    const defaultTime = new Date();
    defaultTime.setHours(7, 0, 0, 0);
    setNotificationTime(defaultTime);
  }, []);

  async function handleComplete() {
    if (submitting.current) return;

    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!authUser) {
      Alert.alert('Error', 'Authentication error. Please try again.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      // Format time as HH:MM
      const hours = notificationTime.getHours().toString().padStart(2, '0');
      const minutes = notificationTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}:00`;

      const user = await createUserProfile({
        id: authUser.id,
        email: authUser.email!,
        displayName: displayName.trim(),
        notificationTime: timeString,
      });

      setUser(user);
      // AuthContext will detect user is set and navigate to main app
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create profile');
      submitting.current = false;
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

        <TimePicker
          label="Daily reminder time"
          value={notificationTime}
          onChange={setNotificationTime}
        />

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
