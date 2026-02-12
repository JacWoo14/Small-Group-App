import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Layout } from '../constants/theme';

/**
 * Plans Screen - Browse and select reading plans
 * TODO: Migrate from reference project app/plans/page.tsx
 */
export default function PlansScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reading Plans</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
      <Text style={styles.text}>
        This screen will show:{'\n'}
        • Available reading plans{'\n'}
        • Custom/imported plans{'\n'}
        • Plan details and previews{'\n'}
        • Create custom plan{'\n'}
        • Import plan from file/URL
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
