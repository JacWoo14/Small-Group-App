import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Layout } from '../constants/theme';

/**
 * Settings Screen - App settings and preferences
 * TODO: Migrate from reference project app/settings/page.tsx
 */
export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
      <Text style={styles.text}>
        This screen will show:{'\n'}
        • Notification settings{'\n'}
        • Daily reminder time{'\n'}
        • User profile{'\n'}
        • Import/Export data{'\n'}
        • Reset progress{'\n'}
        • About & Help
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.parchment,
    padding: Layout.screenPadding,
  },
  title: {
    ...Typography.h2,
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.h4,
    color: Colors.stoneGray,
    marginBottom: 24,
  },
  text: {
    ...Typography.body,
    lineHeight: 24,
  },
});
