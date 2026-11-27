import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useCreatePlan } from '../../hooks/useGroups';
import { generatePlan, MAX_CHAPTERS_PER_DAY, PlanContent, PlanOptions, Repeat } from '../../utils/planGenerator';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { DatePicker } from '../../components/DatePicker';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { PlanStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<PlanStackParamList, 'CreatePlan'>;
type RouteProps = NativeStackScreenProps<PlanStackParamList, 'CreatePlan'>['route'];

const CONTENT: { value: PlanContent; label: string }[] = [
  { value: 'bible', label: 'Whole Bible' },
  { value: 'old', label: 'Old Testament' },
  { value: 'new', label: 'New Testament' },
];

const DAYS: { value: PlanOptions['daysPerWeek']; label: string }[] = [
  { value: 5, label: '5 days' },
  { value: 6, label: '6 days' },
  { value: 7, label: '7 days' },
];

const REPEATS: { value: Repeat; label: string; content: PlanContent[] }[] = [
  { value: 'newTestament', label: 'NT (x2)', content: ['bible', 'new'] },
  { value: 'psalms', label: 'Psalms (x2)', content: ['bible', 'old'] },
  { value: 'proverbs', label: 'Proverbs (x2)', content: ['bible', 'old'] },
];

/** "About 5 months", "About 2 years", "About 1 year 5 months" */
function describeLength(startDate: string, endDate: string): string {
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  const months = Math.round(days / 30.44);
  if (months < 2) return `${days} days`;

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `About ${plural(months, 'month')}`;
  return `About ${plural(years, 'year')}${rest ? ` ${plural(rest, 'month')}` : ''}`;
}

const displayDate = (date: string) => format(parseISO(date), 'EEE, MMM d, yyyy');

function Choices<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T | T[]; // an array for choices that toggle independently
  onSelect: (value: T) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const isSelected = Array.isArray(selected)
            ? selected.includes(option.value)
            : option.value === selected;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.choice,
                isSelected && { borderColor: theme.primary, backgroundColor: theme.selectedBackground },
              ]}
            >
              <Text style={[styles.choiceText, isSelected && { color: theme.primary }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function CreatePlanScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { isPersonal } = route.params;
  const { theme } = useTheme();
  const createPlan = useCreatePlan();

  const [content, setContent] = useState<PlanContent>('bible');
  const [daysPerWeek, setDaysPerWeek] = useState<PlanOptions['daysPerWeek']>(7);
  const [chaptersPerDay, setChaptersPerDay] = useState(3);
  const [startDate, setStartDate] = useState(new Date());
  const [repeats, setRepeats] = useState<Repeat[]>([]);
  const [customName, setCustomName] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Android's back button returns from the preview to the options, keeping the
  // choices, instead of leaving the screen.
  useFocusEffect(
    useCallback(() => {
      if (!showPreview) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setShowPreview(false);
        return true;
      });
      return () => subscription.remove();
    }, [showPreview])
  );

  const start = format(startDate, 'yyyy-MM-dd');
  const plan = useMemo(
    () => generatePlan({ content, daysPerWeek, chaptersPerDay, startDate: start, repeats }),
    [content, daysPerWeek, chaptersPerDay, start, repeats]
  );

  const toggleRepeat = (value: Repeat) =>
    setRepeats((current) =>
      current.includes(value) ? current.filter((r) => r !== value) : [...current, value]
    );

  const contentLabel = CONTENT.find((c) => c.value === content)!.label;
  const defaultName = `${contentLabel}, ${chaptersPerDay} a day, ${daysPerWeek} days a week`;
  const name = customName.trim() || defaultName;

  async function handleSave() {
    try {
      const saved = await createPlan.mutateAsync({ name, readings: plan.readings });
      navigation.navigate('CreateGroup', { isPersonal, preselectedPlanId: saved.id });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save plan');
    }
  }

  const summary = (
    <Card style={styles.summary}>
      <Text style={[styles.length, { color: theme.primary }]}>
        {describeLength(plan.readings[0].scheduled_date, plan.endDate)}
      </Text>
      <Text style={styles.summaryText}>Ends {displayDate(plan.endDate)}</Text>
      <Text style={styles.summaryDetail}>{plan.readings.length} reading days</Text>
    </Card>
  );

  if (showPreview) {
    return (
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={plan.readings}
        keyExtractor={(r) => r.scheduled_date}
        ListHeaderComponent={
          <>
            {summary}
            <Input label="Plan Name" placeholder={defaultName} value={customName} onChangeText={setCustomName} />
            <Button title="Save Plan" onPress={handleSave} loading={createPlan.isPending} style={styles.button} />
            <Button title="Back to Options" variant="outline" onPress={() => setShowPreview(false)} style={styles.button} />
          </>
        }
        renderItem={({ item }) => (
          <Card style={styles.previewRow}>
            <Text style={styles.previewDate}>{displayDate(item.scheduled_date)}</Text>
            <Text style={styles.previewPassage}>{item.passages.join(', ')}</Text>
          </Card>
        )}
      />
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Choices label="What to read" options={CONTENT} selected={content} onSelect={setContent} />
        <Choices label="Days a week" options={DAYS} selected={daysPerWeek} onSelect={setDaysPerWeek} />
        {daysPerWeek < 7 && (
          <Text style={styles.hint}>
            {daysPerWeek === 5 ? 'Reads Monday to Friday.' : 'Reads Monday to Saturday.'}
          </Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Chapters each day</Text>
          <View style={styles.row}>
            <Button
              title="−"
              variant="outline"
              onPress={() => setChaptersPerDay((n) => Math.max(1, n - 1))}
              disabled={chaptersPerDay === 1}
            />
            <Text style={styles.stepperValue}>{chaptersPerDay}</Text>
            <Button
              title="+"
              variant="outline"
              onPress={() => setChaptersPerDay((n) => Math.min(MAX_CHAPTERS_PER_DAY, n + 1))}
              disabled={chaptersPerDay === MAX_CHAPTERS_PER_DAY}
            />
          </View>
        </View>

        <Choices
          label="Read twice (optional)"
          options={REPEATS.filter((r) => r.content.includes(content))}
          selected={repeats}
          onSelect={toggleRepeat}
        />

        <DatePicker label="Start Date" value={startDate} onChange={setStartDate} minimumDate={new Date()} />

        {summary}

        <Button title="Preview Plan" onPress={() => setShowPreview(true)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.screenBackground,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  choiceText: {
    ...Typography.label,
    color: Colors.text,
    textAlign: 'center',
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  stepperValue: {
    ...Typography.h3,
    minWidth: 48,
    textAlign: 'center',
  },
  summary: {
    marginBottom: Spacing.md,
  },
  length: {
    ...Typography.h4,
  },
  summaryText: {
    ...Typography.body,
    color: Colors.text,
  },
  summaryDetail: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  button: {
    marginBottom: Spacing.sm,
  },
  previewRow: {
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  previewDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  previewPassage: {
    ...Typography.body,
    color: Colors.text,
  },
});
