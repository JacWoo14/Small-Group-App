import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  parsePlanText,
  parseDatelessPlanText,
  detectPlanFormat,
  ParsedReading,
} from '../../services/plans';
import { useImportPlan, useAvailablePlans } from '../../hooks/useGroups';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { DatePicker } from '../../components/DatePicker';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { GroupStackParamList } from '../../types';
import { format } from 'date-fns';

type Nav = NativeStackNavigationProp<GroupStackParamList, 'ImportPlan'>;
type RouteProps = NativeStackScreenProps<GroupStackParamList, 'ImportPlan'>['route'];

export default function ImportPlanScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { groupId } = route.params ?? {};
  const { user } = useAuth();
  const importPlan = useImportPlan();
  const { data: availablePlans } = useAvailablePlans();

  const [planName, setPlanName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [preview, setPreview] = useState<ParsedReading[] | null>(null);
  const [isDateless, setIsDateless] = useState(false);

  function handlePreview() {
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }
    if (!pastedText.trim()) {
      Alert.alert('Error', 'Please paste your reading plan');
      return;
    }

    // Check for duplicate plan name (case-insensitive)
    const nameNormalized = planName.trim().toLowerCase();
    const duplicate = (availablePlans || []).find(
      (p) => p.name.toLowerCase() === nameNormalized && p.created_by === user?.id
    );
    if (duplicate) {
      Alert.alert(
        'Plan already exists',
        `You already have a plan named "${duplicate.name}". Import anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Import anyway', onPress: () => doParse() },
        ]
      );
      return;
    }

    doParse();
  }

  function doParse() {
    const format = detectPlanFormat(pastedText);

    if (format === 'mixed') {
      Alert.alert(
        'Mixed format',
        'Some lines have dates and some do not. Please make sure all lines either include a date (tab-separated) or none do.'
      );
      return;
    }

    if (format === 'dateless') {
      // Show the start date picker — user must confirm before previewing
      setIsDateless(true);
      return;
    }

    // Dated format
    const parsed = parsePlanText(pastedText);
    if (!parsed) {
      Alert.alert(
        'Could not parse',
        'Each line must be: "Passage\tDate" (tab-separated).\nExample: Genesis 1\t3-16-2026\n\nMake sure all dates are valid calendar dates.'
      );
      return;
    }

    setPreview(parsed);
    setIsDateless(false);
  }

  function handleDatelessContinue() {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const parsed = parseDatelessPlanText(pastedText, startDateStr);
    if (!parsed) {
      Alert.alert('Error', 'Could not compute dates. Please check your input.');
      return;
    }
    setPreview(parsed);
  }

  async function handleImport() {
    if (!preview) return;

    try {
      await importPlan.mutateAsync({ name: planName.trim(), readings: preview });
      if (groupId) {
        navigation.navigate('GroupDetails', { groupId });
      } else {
        Alert.alert('Plan imported!', `"${planName}" is ready to use when creating a group.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      if (error.code === '23505') {
        Alert.alert('Plan already exists', `You already have a plan named "${planName.trim()}". Please use a different name.`);
      } else {
        Alert.alert('Error', error.message || 'Failed to import plan');
      }
    }
  }

  // Preview screen
  if (preview) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.sectionLabel}>Plan: {planName}</Text>
          <Text style={styles.previewCount}>{preview.length} readings</Text>

          {preview.map((r, i) => (
            <Card key={i} style={styles.previewRow}>
              <Text style={styles.previewDate}>{r.scheduled_date}</Text>
              <Text style={styles.previewPassage}>{r.passage}</Text>
            </Card>
          ))}

          <Button
            title={`Import ${preview.length} Readings`}
            onPress={handleImport}
            loading={importPlan.isPending}
            style={styles.button}
          />
          <Button
            title="Back to Edit"
            variant="outline"
            onPress={() => { setPreview(null); setIsDateless(false); }}
            style={styles.button}
          />
        </View>
      </ScrollView>
    );
  }

  // Dateless: show start date picker before preview
  if (isDateless) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.sectionLabel}>Plan: {planName}</Text>
          <Text style={styles.hint}>
            No dates were found in your plan. Choose a start date and each reading
            will be assigned a consecutive day starting from that date.
          </Text>

          <DatePicker
            label="Start Date (Day 1)"
            value={startDate}
            onChange={setStartDate}
            minimumDate={new Date()}
          />

          <Button
            title="Preview Plan"
            onPress={handleDatelessContinue}
            style={styles.button}
          />
          <Button
            title="Back"
            variant="outline"
            onPress={() => setIsDateless(false)}
            style={styles.button}
          />
        </View>
      </ScrollView>
    );
  }

  // Default: paste screen
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Input
          label="Plan Name"
          placeholder="e.g., Daily Bible Reading 2026"
          value={planName}
          onChangeText={setPlanName}
        />

        <Text style={styles.sectionLabel}>Reading Data</Text>
        <Text style={styles.hint}>
          Paste your plan with one reading per line.{'\n\n'}
          <Text style={styles.hintBold}>With dates</Text> (tab-separated):{'\n'}
          Genesis 1{'  '}3-16-2026{'\n'}
          Genesis 2{'  '}3-17-2026{'\n\n'}
          <Text style={styles.hintBold}>Without dates</Text> (daily, sequential):{'\n'}
          Genesis 1{'\n'}
          Genesis 2
        </Text>

        <TextInput
          style={styles.pasteArea}
          multiline
          placeholder="Paste readings here..."
          placeholderTextColor={Colors.textSecondary}
          value={pastedText}
          onChangeText={setPastedText}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Button
          title="Preview"
          onPress={handlePreview}
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  hintBold: {
    fontWeight: '600',
    color: Colors.text,
  },
  pasteArea: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 200,
    ...Typography.body,
    color: Colors.text,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
    fontFamily: 'monospace',
  },
  button: {
    marginBottom: Spacing.sm,
  },
  previewCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  previewDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    width: 90,
    flexShrink: 0,
  },
  previewPassage: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
});
