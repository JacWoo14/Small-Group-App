import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Layout } from '../constants/theme';

/**
 * Progress Screen - View reading stats and streaks
 * TODO: Migrate from reference project app/progress/page.tsx
 */
export default function ProgressScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Progress</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
      <Text style={styles.text}>
        This screen will show:{'\n'}
        • Current streak{'\n'}
        • Longest streak{'\n'}
        • Total readings completed{'\n'}
        • Completion percentage{'\n'}
        • Reading history{'\n'}
        • Milestone achievements
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
