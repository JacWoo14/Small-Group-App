import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useUserStreak } from '../hooks/useProgress';
import { Card } from '../components/ui/Card';
import { Colors, Typography, Spacing, FontSizes, FontWeights } from '../constants/theme';
import { format } from 'date-fns';

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { data: streak, isLoading } = useUserStreak();
  const isNewRecord = streak && streak.current > 0 && streak.current >= streak.longest;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Progress</Text>
        <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : !streak || streak.current === 0 ? (
        <Card style={styles.card}>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="fire"
              size={64}
              color={Colors.lightGray}
            />
            <Text style={styles.emptyTitle}>No streak yet</Text>
            <Text style={styles.emptyText}>
              Mark today's reading as complete to start your streak!
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <Card style={[
            styles.streakCard,
            { backgroundColor: theme.primary },
            isNewRecord && styles.streakCardRecord,
            isNewRecord && { shadowColor: theme.primary },
          ]}>
            <MaterialCommunityIcons
              name="fire"
              size={44}
              color="rgba(255,255,255,0.9)"
              style={styles.streakIcon}
            />
            <Text style={styles.streakLabel}>Current Streak</Text>
            <Text style={styles.streakNumber}>{streak.current}</Text>
            <Text style={styles.streakUnit}>
              {streak.current === 1 ? 'day' : 'days'} in a row
            </Text>
            {isNewRecord && (
              <View style={styles.recordBadge}>
                <MaterialCommunityIcons name="trophy" size={13} color={theme.primary} />
                <Text style={[styles.recordText, { color: theme.primary }]}>Personal record</Text>
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <View style={styles.bestHeader}>
              <Text style={styles.cardTitle}>Personal Best</Text>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={22}
                color={theme.primary}
              />
            </View>
            <View style={styles.bestRow}>
              <Text style={styles.bestNumber}>{streak.longest}</Text>
              <Text style={styles.bestLabel}>
                {streak.longest === 1 ? 'day' : 'days'}
              </Text>
            </View>
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
  },
  streakCardRecord: {
    // Subtle inner highlight for record state — shadowColor set dynamically via theme.primary
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  streakIcon: {
    marginBottom: Spacing.xs,
    opacity: 0.9,
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
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.md,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordText: {
    // color set dynamically via theme.primary (see inline style in JSX)
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.text,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
