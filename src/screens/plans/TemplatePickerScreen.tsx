import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { usePlanTemplates, useTemplatePreview, useInstantiateTemplate } from '../../hooks/useGroups';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { PlanStackParamList, PlanTemplate } from '../../types';

type Nav = NativeStackNavigationProp<PlanStackParamList, 'TemplatePicker'>;
type RouteProps = NativeStackScreenProps<PlanStackParamList, 'TemplatePicker'>['route'];

export default function TemplatePickerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { isPersonal } = route.params ?? {};
  const { theme } = useTheme();
  const { data: templates, isLoading } = usePlanTemplates();
  const instantiateTemplate = useInstantiateTemplate();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: preview, isLoading: previewLoading } = useTemplatePreview(expandedId);

  async function handleUseTemplate(template: PlanTemplate) {
    try {
      const plan = await instantiateTemplate.mutateAsync({
        templateId: template.id,
        startDate: format(new Date(), 'yyyy-MM-dd'),
      });
      navigation.navigate('CreateGroup', { isPersonal, preselectedPlanId: plan.id });
    } catch (error: any) {
      if (error.code === '23505') {
        Alert.alert(
          'Plan already exists',
          `You already have a plan named "${template.name}". Please rename or remove it first.`
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to start this plan');
      }
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>No built-in plans are available yet.</Text>
      </View>
    );
  }

  const sorted = [...templates].sort((a, b) => a.total_days - b.total_days);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.hint}>
          Tap a plan to preview it, or start it right away.
        </Text>

        {sorted.map((template) => {
          const isExpanded = expandedId === template.id;
          return (
            <Card key={template.id} style={styles.templateCard}>
              <TouchableOpacity
                onPress={() => setExpandedId(isExpanded ? null : template.id)}
                activeOpacity={0.7}
              >
                <View style={styles.templateHeader}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  {template.category && (
                    <View style={[styles.categoryBadge, { backgroundColor: theme.selectedBackground }]}>
                      <Text style={[styles.categoryText, { color: theme.primary }]}>
                        {template.category}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.templateDays}>{template.total_days} days</Text>
                {template.description && (
                  <Text style={styles.templateDescription}>{template.description}</Text>
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.previewSection}>
                  {previewLoading ? (
                    <ActivityIndicator color={theme.primary} style={styles.previewLoading} />
                  ) : (
                    (preview || []).map((r) => (
                      <View key={r.day_number} style={styles.previewRow}>
                        <Text style={styles.previewDay}>Day {r.day_number}</Text>
                        <Text style={styles.previewPassage}>{r.passages.join(', ')}</Text>
                      </View>
                    ))
                  )}

                  <Button
                    title="Start This Plan"
                    onPress={() => handleUseTemplate(template)}
                    loading={instantiateTemplate.isPending}
                    style={styles.startButton}
                  />
                </View>
              )}
            </Card>
          );
        })}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  templateCard: {
    marginBottom: Spacing.sm,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  templateName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  categoryBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  categoryText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  templateDays: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  templateDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  previewSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  previewLoading: {
    marginBottom: Spacing.sm,
  },
  previewRow: {
    marginBottom: Spacing.xs,
  },
  previewDay: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  previewPassage: {
    ...Typography.body,
    color: Colors.text,
  },
  startButton: {
    marginTop: Spacing.sm,
  },
});
