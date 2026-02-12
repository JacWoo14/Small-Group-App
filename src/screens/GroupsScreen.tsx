import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Layout } from '../constants/theme';

/**
 * Groups Screen - View and manage accountability groups
 * NEW FEATURE - not in reference project
 */
export default function GroupsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Groups</Text>
      <Text style={styles.subtitle}>New Feature!</Text>
      <Text style={styles.text}>
        This screen will show:{'\n'}
        • List of your groups{'\n'}
        • Create new group{'\n'}
        • Join group via invite code{'\n'}
        • Group progress summary{'\n'}
        • Member activity{'\n'}
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
    color: Colors.sacredGold,
    marginBottom: 24,
  },
  text: {
    ...Typography.body,
    lineHeight: 24,
  },
});
