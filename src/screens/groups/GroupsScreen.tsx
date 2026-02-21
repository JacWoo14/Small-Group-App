import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUserGroups } from '../../hooks/useGroups';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { Group, GroupStackParamList } from '../../types';
import { format } from 'date-fns';

type Nav = NativeStackNavigationProp<GroupStackParamList, 'GroupList'>;

export default function GroupsScreen() {
  const navigation = useNavigation<Nav>();
  const { data: groups, isLoading, error, refetch } = useUserGroups();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
        <Button
          title="Create Group"
          onPress={() => navigation.navigate('CreateGroup')}
          style={styles.actionButton}
        />
        <Button
          title="Join Group"
          variant="outline"
          onPress={() => navigation.navigate('JoinGroup')}
          style={styles.actionButton}
        />
      </View>

      {(!groups || groups.length === 0) ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyText}>
            Create a group and invite friends, or join one with an invite code.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <GroupCard group={item} navigation={navigation} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function GroupCard({ group, navigation }: { group: Group; navigation: Nav }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('GroupDetails', { groupId: group.id })}
    >
      <Card style={styles.card}>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.reading_plan && (
          <Text style={styles.planName}>{group.reading_plan.name}</Text>
        )}
        <Text style={styles.startDate}>
          Started {format(new Date(group.start_date + 'T00:00:00'), 'MMM d, yyyy')}
        </Text>
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
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    marginBottom: Spacing.md,
  },
  groupName: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: Spacing.xs,
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
