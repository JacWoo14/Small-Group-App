import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { usePlanTemplates, useInstantiateTemplate } from '../../hooks/useGroups';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/DatePicker';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { PlanStackParamList, PlanTemplate } from '../../types';
import { format } from 'date-fns';

type Nav = NativeStackNavigationProp<PlanStackParamList, 'TemplatePicker'>;
type RouteProps = NativeStackScreenProps<PlanStackParamList, 'TemplatePicker'>['route'];

export default function TemplatePickerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { isPersonal } = route.params;
  const { theme } = useTheme();
  const { data: templates, isLoading } = usePlanTemplates();
  const instantiateTemplate = useInstantiateTemplate();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date());

  async function handleContinue() {
    if (!selectedTemplateId) {
      Alert.alert('Error', 'Please select a plan');
      return;
    }

    try {
      const plan = await instantiateTemplate.mutateAsync({
        templateId: selectedTemplateId,
        startDate: format(startDate, 'yyyy-MM-dd'),
      });
      navigation.navigate('CreateGroup', { isPersonal, preselectedPlanId: plan.id });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start plan');
    }
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Choose a Plan</Text>
        {(templates || []).length === 0 ? (
          <Text style={styles.loadingText}>No default plans are available yet.</Text>
        ) : (
          (templates || []).map((template: PlanTemplate) => (
            <TouchableOpacity
              key={template.id}
              onPress={() => setSelectedTemplateId(template.id)}
              style={[
                styles.templateOption,
                selectedTemplateId === template.id && {
                  borderColor: theme.primary,
                  backgroundColor: theme.selectedBackground,
                },
              ]}
            >
              <Text
                style={[
                  styles.templateName,
                  selectedTemplateId === template.id && { color: theme.primary },
                ]}
              >
                {template.name}
              </Text>
              <Text style={styles.templateDescription}>
                {template.total_days} days
                {template.description ? ` - ${template.description}` : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {selectedTemplateId && (
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
          />
        )}

        <Button
          title="Continue"
          onPress={handleContinue}
          loading={instantiateTemplate.isPending}
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
    marginBottom: Spacing.sm,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  templateOption: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  templateName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  templateDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
