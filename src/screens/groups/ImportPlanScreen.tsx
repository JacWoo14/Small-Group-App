import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { parsePlanText, ParsedReading } from '../../services/plans';
import { useImportPlan } from '../../hooks/useGroups';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { GroupStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<GroupStackParamList, 'ImportPlan'>;

export default function ImportPlanScreen() {
  const navigation = useNavigation<Nav>();
  const importPlan = useImportPlan();

  const [planName, setPlanName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<ParsedReading[] | null>(null);

  function handlePreview() {
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }
    if (!pastedText.trim()) {
      Alert.alert('Error', 'Please paste your reading plan');
      return;
    }

    const parsed = parsePlanText(pastedText);
    if (!parsed) {
      Alert.alert(
        'Could not parse',
        'Each line must be in the format: "Passage\tDate" (tab-separated). Example:\nGenesis 1\t3-16-2026'
      );
      return;
    }

    setPreview(parsed);
  }

  async function handleImport() {
    if (!preview) return;

    try {
      await importPlan.mutateAsync({ name: planName.trim(), readings: preview });
      Alert.alert('Plan imported!', `"${planName}" is ready to use when creating a group.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to import plan');
    }
  }

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
            onPress={() => setPreview(null)}
            style={styles.button}
          />
        </View>
      </ScrollView>
    );
  }

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
          Paste your plan with one reading per line, tab-separated with the date:
          {'\n'}Genesis 1{'  '}3-16-2026
          {'\n'}Genesis 2{'  '}3-17-2026
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
