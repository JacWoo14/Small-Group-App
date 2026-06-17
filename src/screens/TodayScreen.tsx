import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useReadingsForDate, useMarkComplete } from '../hooks/useGroups';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Colors, Typography, Spacing } from '../constants/theme';
import { TodayReading, Passage } from '../types';

const PAST_DAYS_LIMIT = 30;
const FUTURE_DAYS_LIMIT = 7;
const SWIPE_THRESHOLD = 50;

function todayString() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function TodayScreen() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayString);
  const markComplete = useMarkComplete();
  const [submittingGroupId, setSubmittingGroupId] = useState<string | null>(null);

  const today = todayString();
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  const daysFromToday = differenceInCalendarDays(parseISO(selectedDate), new Date());
  const canGoBack = daysFromToday > -PAST_DAYS_LIMIT;
  const canGoForward = daysFromToday < FUTURE_DAYS_LIMIT;

  const { data: readings, isLoading, error } = useReadingsForDate(selectedDate);

  function navigateDay(delta: number) {
    setSelectedDate((prev) => {
      const next = format(addDays(parseISO(prev), delta), 'yyyy-MM-dd');
      const diff = differenceInCalendarDays(parseISO(next), new Date());
      if (diff > FUTURE_DAYS_LIMIT || diff < -PAST_DAYS_LIMIT) return prev;
      return next;
    });
  }

  // PanResponder lives in a ref so it isn't recreated on each render.
  // Uses setSelectedDate functional form so it never captures stale state.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 2 && Math.abs(gs.dx) > 15,
      onPanResponderRelease: (_evt, gs) => {
        if (Math.abs(gs.dx) < SWIPE_THRESHOLD) return;
        const delta = gs.dx < 0 ? 1 : -1;
        setSelectedDate((prev) => {
          const next = format(addDays(parseISO(prev), delta), 'yyyy-MM-dd');
          const diff = differenceInCalendarDays(parseISO(next), new Date());
          if (diff > FUTURE_DAYS_LIMIT || diff < -PAST_DAYS_LIMIT) return prev;
          return next;
        });
      },
    })
  ).current;

  async function handleMarkComplete(reading: TodayReading) {
    setSubmittingGroupId(reading.group.id);
    try {
      await markComplete.mutateAsync({
        groupId: reading.group.id,
        readingDate: selectedDate,
      });
      const msg = isToday
        ? 'Reading marked as complete!'
        : 'Past reading marked as complete!';
      Alert.alert('Great job!', msg);
    } catch (err: any) {
      if (err.message === 'Already completed') {
        Alert.alert('Already done!', 'You already completed this reading!');
      } else {
        Alert.alert('Error', err.message || 'Failed to mark complete');
      }
    } finally {
      setSubmittingGroupId(null);
    }
  }

  const displayDate = isToday
    ? `Today · ${format(new Date(), 'MMM d')}`
    : format(parseISO(selectedDate), 'EEE, MMM d');

  return (
    <View style={styles.screen} {...panResponder.panHandlers}>
      <ScrollView style={styles.container} scrollEventThrottle={16}>
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Good {getTimeOfDay()}, {user?.display_name}!
          </Text>
        </View>

        {/* ── Date navigation strip ── */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() => navigateDay(-1)}
            disabled={!canGoBack}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            style={styles.dateArrowBtn}
          >
            <Text style={[styles.dateArrow, !canGoBack && styles.dateArrowDisabled]}>
              ‹
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateLabelWrapper}
            onPress={() => !isToday && setSelectedDate(today)}
            disabled={isToday}
          >
            <Text style={[styles.dateLabel, isFuture && styles.dateLabelFuture]}>
              {displayDate}
            </Text>
            {!isToday && (
              <Text style={styles.dateSubLabel}>
                {isFuture ? 'Upcoming' : 'Tap to return to today'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigateDay(1)}
            disabled={!canGoForward}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            style={styles.dateArrowBtn}
          >
            <Text style={[styles.dateArrow, !canGoForward && styles.dateArrowDisabled]}>
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Content ── */}
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
            <Text style={styles.hint}>Head to the Groups tab to get started.</Text>
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
                reading.passages.map((passage: Passage, index: number) => (
                  <Text key={index} style={styles.passage}>
                    {passage}
                  </Text>
                ))
              ) : (
                <Text style={styles.hint}>No reading scheduled for this day</Text>
              )}

              {isFuture ? (
                <Text style={styles.upcomingNote}>Upcoming — check back later</Text>
              ) : (
                <Button
                  title={reading.completed ? 'Completed ✓' : 'Mark Complete'}
                  onPress={() => handleMarkComplete(reading)}
                  disabled={reading.completed || submittingGroupId === reading.group.id}
                  loading={submittingGroupId === reading.group.id}
                  style={styles.button}
                />
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  greeting: {
    ...Typography.h2,
    color: Colors.text,
  },

  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateArrowBtn: {
    width: 36,
    alignItems: 'center',
  },
  dateArrow: {
    fontSize: 32,
    lineHeight: 36,
    color: Colors.primary,
    fontWeight: '300',
  },
  dateArrowDisabled: {
    color: Colors.lightGray,
  },
  dateLabelWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    ...Typography.h4,
    color: Colors.deepEarth,
  },
  dateLabelFuture: {
    color: Colors.spiritualBlue,
  },
  dateSubLabel: {
    ...Typography.caption,
    color: Colors.primary,
    marginTop: 2,
  },

  // Cards
  centered: {
    padding: Spacing.xl,
    alignItems: 'center',
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
  upcomingNote: {
    ...Typography.caption,
    color: Colors.stoneGray,
    marginTop: Spacing.md,
    fontStyle: 'italic',
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
