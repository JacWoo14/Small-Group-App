import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { useAvailablePlans, useCreateGroup } from '../../hooks/useGroups';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { PlanStackParamList, ReadingPlan } from '../../types';
import { format } from 'date-fns';

type Nav = NativeStackNavigationProp<PlanStackParamList, 'CreateGroup'>;
type RouteProps = NativeStackScreenProps<PlanStackParamList, 'CreateGroup'>['route'];

export default function CreateGroupScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { isPersonal = false, preselectedPlanId } = route.params ?? {};
  const { theme } = useTheme();
  const { data: plans, isLoading: plansLoading } = useAvailablePlans();
  const createGroup = useCreateGroup();

  const [name, setName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(preselectedPlanId ?? null);
  const [startDate] = useState(new Date());
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);

  const selectedPlan = (plans || []).find((p) => p.id === selectedPlanId) || null;

  async function handleCreate() {
    if (!isPersonal && !name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    if (!selectedPlanId) {
      Alert.alert('Error', 'Please select a reading plan');
      return;
    }

    try {
      const group = await createGroup.mutateAsync({
        name: isPersonal ? (selectedPlan?.name || 'My Reading') : name.trim(),
        readingPlanId: selectedPlanId,
        startDate: format(startDate, 'yyyy-MM-dd'),
        isPersonal,
      });
      setCreatedInviteCode(group.invite_code);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group');
    }
  }

  async function handleCopyCode() {
    if (createdInviteCode) {
      await Clipboard.setStringAsync(createdInviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  }

  // Success screen
  if (createdInviteCode) {
    // Personal plans don't surface an invite code up front — that's a
    // deliberate action from Plan Details ("Invite others to this plan"),
    // so a personal plan can't accidentally be shared before the owner
    // chooses to.
    if (isPersonal) {
      return (
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>Plan Created!</Text>
          <Text style={styles.successText}>
            You're all set. You can invite others to this plan any time from its details screen.
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.navigate('PlanList')}
            style={styles.doneButton}
          />
        </View>
      );
    }

    return (
      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>Group Created!</Text>
        <Text style={styles.successText}>
          You've been added as the first member. Share this invite code with others so they can join:
        </Text>
        <TouchableOpacity onPress={handleCopyCode} style={[styles.codeContainer, { borderColor: theme.primary }]}>
          <Text style={[styles.inviteCode, { color: theme.primary }]}>{createdInviteCode}</Text>
          <Text style={styles.tapToCopy}>Tap to copy</Text>
        </TouchableOpacity>
        <Button
          title="Done"
          onPress={() => navigation.navigate('PlanList')}
          style={styles.doneButton}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {!isPersonal && (
          <Input
            label="Group Name"
            placeholder="e.g., Sunday Bible Study"
            value={name}
            onChangeText={setName}
          />
        )}

        <Text style={styles.sectionLabel}>Reading Plan</Text>
        {plansLoading ? (
          <Text style={styles.loadingText}>Loading plans...</Text>
        ) : (plans || []).length === 0 ? (
          <Text style={styles.loadingText}>
            No default plans are available yet — try "My Own Plan" instead.
          </Text>
        ) : (
          (plans || []).map((plan: ReadingPlan) => (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlanId(plan.id)}
              style={[
                styles.planOption,
                selectedPlanId === plan.id && { borderColor: theme.primary, backgroundColor: theme.selectedBackground },
              ]}
            >
              <Text
                style={[
                  styles.planName,
                  selectedPlanId === plan.id && { color: theme.primary },
                ]}
              >
                {plan.name}
              </Text>
              <Text style={styles.planDescription}>
                {plan.total_days} days
                {plan.description ? ` - ${plan.description}` : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('ImportPlan', { isPersonal })}
          style={styles.importLink}
        >
          <Text style={[styles.importLinkText, { color: theme.primary }]}>+ Import a custom plan</Text>
        </TouchableOpacity>

        {/* start_date is only meaningful for day-numbered plans.
            Date-first plans have dates baked into plan_readings already. */}

        <Button
          title={isPersonal ? 'Start Plan' : 'Create Group'}
          onPress={handleCreate}
          loading={createGroup.isPending}
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
  importLink: {
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  importLinkText: {
    ...Typography.body,
  },
  planOption: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  planName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  planDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: '#f5f5f5',
  },
  successTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  successText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  codeContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  inviteCode: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 6,
  },
  tapToCopy: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  doneButton: {
    width: '100%',
  },
});
