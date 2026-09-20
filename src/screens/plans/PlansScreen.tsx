import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { useUserGroups } from '../../hooks/useGroups';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { Group, PlanStackParamList } from '../../types';
import { format } from 'date-fns';

type Nav = NativeStackNavigationProp<PlanStackParamList, 'PlanList'>;

export default function PlansScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { data: groups, isLoading, error, refetch } = useUserGroups();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load groups</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('NewPlan')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
          <Text style={styles.actionButtonTextPrimary}>New Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonOutline, { borderColor: theme.primary }]}
          onPress={() => navigation.navigate('JoinGroup')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-plus-outline" size={18} color={theme.primary} />
          <Text style={[styles.actionButtonTextOutline, { color: theme.primary }]}>Join Group</Text>
        </TouchableOpacity>
      </View>

      {(!groups || groups.length === 0) ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="book-multiple-outline"
            size={80}
            color={Colors.lightGray}
          />
          <Text style={styles.emptyTitle}>No plans yet</Text>
          <Text style={styles.emptyText}>
            Start a new plan for yourself or a group, or join one with an invite code.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PlanCard group={item} navigation={navigation} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function PlanCard({ group, navigation }: { group: Group; navigation: Nav }) {
  // getUserGroups doesn't fetch the members list (avoids N+1 for a list
  // screen), so this reflects is_personal as set at creation time. A
  // personal plan that's since been shared still upgrades correctly on
  // its Plan Details screen, which does fetch members.
  const tagLabel = group.is_personal ? 'Personal' : 'Group';

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('PlanDetails', { groupId: group.id })}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.groupName}>{group.name}</Text>
              <View style={[styles.tag, group.is_personal ? styles.tagPersonal : styles.tagGroup]}>
                <Text style={[styles.tagText, group.is_personal ? styles.tagTextPersonal : styles.tagTextGroup]}>
                  {tagLabel}
                </Text>
              </View>
            </View>
            {group.reading_plan && (
              <Text style={styles.planName}>{group.reading_plan.name}</Text>
            )}
            <Text style={styles.startDate}>
              Started {format(new Date(group.start_date + 'T00:00:00'), 'MMM d, yyyy')}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={Colors.lightGray}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    minHeight: 48,
  },
  actionButtonOutline: {
    // borderColor set dynamically via theme.primary (see inline style in JSX)
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonTextPrimary: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  actionButtonTextOutline: {
    // color set dynamically via theme.primary (see inline style in JSX)
    fontWeight: '600',
    fontSize: 15,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  groupName: {
    ...Typography.h4,
    color: Colors.text,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagPersonal: {
    backgroundColor: '#EEF1F8',
  },
  tagGroup: {
    backgroundColor: '#F5F5F5',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tagTextPersonal: {
    color: '#1E3A6E',
  },
  tagTextGroup: {
    color: Colors.textSecondary,
  },
  planName: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  startDate: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
    marginBottom: Spacing.md,
  },
});
