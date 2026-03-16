import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useUserStreak } from '../hooks/useProgress';
import { Card } from '../components/ui/Card';
import { Colors, Typography, Spacing, FontSizes, FontWeights } from '../constants/theme';
import { format } from 'date-fns';

export default function ProgressScreen() {
  const { data: streak, isLoading } = useUserStreak();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Progress</Text>
        <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !streak || streak.current === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>No streak yet</Text>
          <Text style={styles.emptyText}>
            Mark today's reading as complete to start your streak!
          </Text>
        </Card>
      ) : (
        <>
          <Card style={styles.streakCard}>
            <Text style={styles.streakLabel}>Current Streak</Text>
            <Text style={styles.streakNumber}>{streak.current}</Text>
            <Text style={styles.streakUnit}>
              {streak.current === 1 ? 'day' : 'days'} in a row
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Personal Best</Text>
            <View style={styles.bestRow}>
              <Text style={styles.bestNumber}>{streak.longest}</Text>
              <Text style={styles.bestLabel}>
                {streak.longest === 1 ? 'day' : 'days'}
              </Text>
            </View>
            {streak.current >= streak.longest && streak.longest > 0 && (
              <Text style={styles.newRecord}>New record!</Text>
            )}
          </Card>
        </>
      )}
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
  centered: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  heading: {
    ...Typography.h2,
    color: Colors.text,
  },
  date: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  streakCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.primary,
  },
  streakLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  streakNumber: {
    fontSize: 80,
    fontWeight: FontWeights.bold,
    color: Colors.white,
    lineHeight: 88,
  },
  streakUnit: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.medium,
    color: 'rgba(255,255,255,0.9)',
    marginTop: Spacing.xs,
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
  bestRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  bestNumber: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  bestLabel: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
  },
  newRecord: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.xs,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});
