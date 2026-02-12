import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Layout } from '../constants/theme';

/**
 * Home Screen - Today's Bible Reading
 * TODO: Migrate from reference project app/page.tsx
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Reading</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
      <Text style={styles.text}>
        This screen will show:{'\n'}
        • Today's reading passage{'\n'}
        • Completion checkbox{'\n'}
        • Current streak{'\n'}
        • Group members who completed today{'\n'}
        • Quick notes
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
