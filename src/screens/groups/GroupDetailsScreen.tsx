import React from 'react';
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
import { useGroupDetails, useLeaveGroup } from '../../hooks/useGroups';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { GroupStackParamList, GroupMemberDetails } from '../../types';
import { format } from 'date-fns';

type RouteProps = NativeStackScreenProps<GroupStackParamList, 'GroupDetails'>['route'];
type Nav = NativeStackNavigationProp<GroupStackParamList, 'GroupDetails'>;

export default function GroupDetailsScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { groupId } = route.params;
  const { data: group, isLoading, error } = useGroupDetails(groupId);
  const leaveGroup = useLeaveGroup();

  async function handleCopyCode() {
    if (group?.invite_code) {
      await Clipboard.setStringAsync(group.invite_code);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  }

  function handleLeave() {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group?.name}"?`,
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

  return (
    <ScrollView style={styles.container}>
      {/* Group Info */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{group.name}</Text>
        {group.reading_plan && (
          <View style={styles.row}>
            <Text style={styles.label}>Plan</Text>
            <Text style={styles.value}>{group.reading_plan.name}</Text>
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
  errorText: {
    ...Typography.body,
    color: Colors.error,
  },
});
