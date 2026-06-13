import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGroupDetails, useLeaveGroup, useChangeGroupPlan, useAvailablePlans, useTransferGroupOwnership } from '../../hooks/useGroups';
import { useYesterdayRecap } from '../../hooks/useProgress';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { GroupStackParamList, GroupMemberDetails, ReadingPlan } from '../../types';
import { format } from 'date-fns';

type RouteProps = NativeStackScreenProps<GroupStackParamList, 'GroupDetails'>['route'];
type Nav = NativeStackNavigationProp<GroupStackParamList, 'GroupDetails'>;

export default function GroupDetailsScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { groupId } = route.params;
  const { data: group, isLoading, error } = useGroupDetails(groupId);
  const { data: recap } = useYesterdayRecap(groupId);
  const leaveGroup = useLeaveGroup();
  const changeGroupPlan = useChangeGroupPlan(groupId);
  const transferOwnership = useTransferGroupOwnership(groupId);
  const { data: availablePlans } = useAvailablePlans();
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);

  async function handleCopyCode() {
    if (group?.invite_code) {
      await Clipboard.setStringAsync(group.invite_code);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  }

  function handleLeave() {
    const creatorWarning = isCreator
      ? '\n\nYou are the group creator. If you leave without transferring ownership, no one will be able to change the reading plan.'
      : '';
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group?.name}"?${creatorWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup.mutateAsync(groupId);
              navigation.navigate('GroupList');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  }

  async function handleTransferOwnership(newOwnerId: string) {
    try {
      await transferOwnership.mutateAsync(newOwnerId);
      setIsTransferringOwnership(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to transfer ownership');
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load group</Text>
      </View>
    );
  }

  const members = group.members || [];
  const completedCount = members.filter((m) => m.completed_today).length;
  const isCreator = group.created_by === user?.id;

  async function handleChangePlan(plan: ReadingPlan) {
    try {
      await changeGroupPlan.mutateAsync(plan.id);
      setIsChangingPlan(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change plan');
    }
  }

  return (
    <ScrollView style={styles.container}>
      {/* Group Info */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{group.name}</Text>
        {group.reading_plan && (
          <View style={styles.row}>
            <View style={styles.planHeader}>
              <Text style={styles.label}>Plan</Text>
              {isCreator && (
                <TouchableOpacity onPress={() => setIsChangingPlan(!isChangingPlan)}>
                  <Text style={styles.changeLink}>
                    {isChangingPlan ? 'Cancel' : 'Change'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.value}>{group.reading_plan.name}</Text>
            {isChangingPlan && (
              <View style={styles.planPicker}>
                {(availablePlans || [])
                  .filter((p) => p.id !== group.reading_plan_id)
                  .map((plan: ReadingPlan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.planOption}
                      onPress={() => handleChangePlan(plan)}
                    >
                      <Text style={styles.planOptionName}>{plan.name}</Text>
                      <Text style={styles.planOptionDays}>{plan.total_days} days</Text>
                    </TouchableOpacity>
                  ))}
                <TouchableOpacity
                  style={styles.planOption}
                  onPress={() => navigation.navigate('ImportPlan', { groupId })}
                >
                  <Text style={[styles.planOptionName, { color: Colors.primary }]}>
                    + Import a new plan
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Started</Text>
          <Text style={styles.value}>
            {format(new Date(group.start_date + 'T00:00:00'), 'MMMM d, yyyy')}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Invite Code</Text>
          <TouchableOpacity onPress={handleCopyCode}>
            <Text style={styles.codeValue}>
              {group.invite_code}  <Text style={styles.copyHint}>(tap to copy)</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Members */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>
          Members ({completedCount}/{members.length} completed today)
        </Text>
        {members.map((member: GroupMemberDetails) => (
          <View key={member.user_id} style={styles.memberRow}>
            <Text style={styles.memberName}>
              {member.display_name}
              {member.user_id === user?.id ? ' (you)' : ''}
            </Text>
            <Text
              style={[
                styles.memberStatus,
                member.completed_today ? styles.completedStatus : styles.pendingStatus,
              ]}
            >
              {member.completed_today ? 'Done' : 'Pending'}
            </Text>
          </View>
        ))}
      </Card>

      {/* Transfer Ownership (creator only) */}
      {isCreator && (
        <Card style={styles.card}>
          <View style={styles.planHeader}>
            <Text style={styles.cardTitle}>Ownership</Text>
            {members.filter((m) => m.user_id !== user?.id).length > 0 && (
              <TouchableOpacity onPress={() => setIsTransferringOwnership(!isTransferringOwnership)}>
                <Text style={styles.changeLink}>
                  {isTransferringOwnership ? 'Cancel' : 'Transfer'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.value}>You are the group creator</Text>
          {isTransferringOwnership && (
            <View style={styles.planPicker}>
              {members
                .filter((m) => m.user_id !== user?.id)
                .map((member: GroupMemberDetails) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={styles.planOption}
                    onPress={() => handleTransferOwnership(member.user_id)}
                  >
                    <Text style={styles.planOptionName}>{member.display_name}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </Card>
      )}

      {/* Yesterday's Recap */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Yesterday's Reading</Text>
        {!recap || recap.completions.length === 0 ? (
          <Text style={styles.recapEmpty}>
            No data yet — check back tomorrow!
          </Text>
        ) : (
          recap.completions.map((member) => (
            <View key={member.user_id} style={styles.memberRow}>
              <Text style={styles.memberName}>
                {member.display_name}
                {member.user_id === user?.id ? ' (you)' : ''}
              </Text>
              <Text
                style={[
                  styles.memberStatus,
                  member.completed ? styles.completedStatus : styles.missedStatus,
                ]}
              >
                {member.completed ? '✓' : '—'}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* Leave Group */}
      <Card style={styles.card}>
        <Button
          title="Leave Group"
          variant="outline"
          onPress={handleLeave}
          loading={leaveGroup.isPending}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  row: {
    marginBottom: Spacing.sm,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  changeLink: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  planPicker: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  planOption: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  planOptionName: {
    ...Typography.body,
    color: Colors.text,
  },
  planOptionDays: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    ...Typography.body,
    color: Colors.text,
  },
  codeValue: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: 2,
  },
  copyHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '400',
    letterSpacing: 0,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  memberName: {
    ...Typography.body,
    color: Colors.text,
  },
  memberStatus: {
    ...Typography.caption,
    fontWeight: '600',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  completedStatus: {
    color: Colors.success,
    backgroundColor: '#E8F5E9',
  },
  pendingStatus: {
    color: Colors.textTertiary,
    backgroundColor: '#F5F5F5',
  },
  missedStatus: {
    color: Colors.textTertiary,
    backgroundColor: '#F5F5F5',
  },
  recapEmpty: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
  },
});
