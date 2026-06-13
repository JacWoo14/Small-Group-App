import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTodaysReadings, useMarkComplete } from '../hooks/useGroups';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Colors, Typography, Spacing } from '../constants/theme';
import { format } from 'date-fns';
import { TodayReading, Passage } from '../types';

export default function TodayScreen() {
  const { user } = useAuth();
  const { data: readings, isLoading, error } = useTodaysReadings();
  const markComplete = useMarkComplete();
  const [submittingGroupId, setSubmittingGroupId] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  async function handleMarkComplete(reading: TodayReading) {
    setSubmittingGroupId(reading.group.id);
    try {
      await markComplete.mutateAsync({
        groupId: reading.group.id,
        readingDate: today,
      });
      Alert.alert('Great job!', 'Reading marked as complete!');
    } catch (error: any) {
      if (error.message === 'Already completed') {
        Alert.alert('Already done!', "You already completed today's reading!");
      } else {
        Alert.alert('Error', error.message || 'Failed to mark complete');
      }
    } finally {
      setSubmittingGroupId(null);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Good {getTimeOfDay()}, {user?.display_name}!
        </Text>
        <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <Card style={styles.readingCard}>
          <Text style={styles.errorText}>Failed to load readings</Text>
        </Card>
      ) : !readings || readings.length === 0 ? (
        <Card style={styles.readingCard}>
          <Text style={styles.cardTitle}>No groups yet</Text>
          <Text style={styles.emptyText}>
            Join a group or create one to get started with your daily reading!
          </Text>
          <Text style={styles.hint}>
            Head to the Groups tab to get started.
          </Text>
        </Card>
      ) : (
        readings.map((reading: TodayReading) => (
          <Card key={reading.group.id} style={styles.readingCard}>
            <Text style={styles.groupLabel}>{reading.group.name}</Text>
            {reading.day_number != null && (
              <Text style={styles.dayNumber}>
                Day {reading.day_number}
                {reading.group.reading_plan
                  ? ` of ${reading.group.reading_plan.total_days}`
                  : ''}
              </Text>
            )}

            {reading.passages.length > 0 ? (
              <>
                {reading.passages.map((passage: Passage, index: number) => (
                  <Text key={index} style={styles.passage}>
                    {passage}
                  </Text>
                ))}
                <Button
                  title={reading.completed ? 'Completed' : 'Mark Complete'}
                  onPress={() => handleMarkComplete(reading)}
                  disabled={reading.completed || submittingGroupId === reading.group.id}
                  loading={submittingGroupId === reading.group.id}
                  style={styles.button}
                />
              </>
            ) : (
              <Text style={styles.hint}>No reading scheduled for today</Text>
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
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
  greeting: {
    ...Typography.h2,
    color: Colors.text,
  },
  date: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  readingCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  groupLabel: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  dayNumber: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  passage: {
    ...Typography.bodyLarge,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  button: {
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
  },
});
