import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useJoinGroup } from '../../hooks/useGroups';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { GroupStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<GroupStackParamList, 'JoinGroup'>;

export default function JoinGroupScreen() {
  const navigation = useNavigation<Nav>();
  const joinGroup = useJoinGroup();
  const [code, setCode] = useState('');

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('Error', 'Invite code must be 6 characters');
      return;
    }

    try {
      const group = await joinGroup.mutateAsync(trimmed);
      Alert.alert('Success!', `You joined "${group.name}"!`, [
        {
          text: 'View Group',
          onPress: () => navigation.navigate('GroupDetails', { groupId: group.id }),
        },
      ]);
    } catch (error: any) {
      const msg = error.message || 'Failed to join group';
      Alert.alert('Error', msg);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Join a Group</Text>
        <Text style={styles.subtitle}>
          Enter the 6-character invite code shared by your group leader
        </Text>

        <Input
          label="Invite Code"
          placeholder="e.g., ABC123"
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
        />

        <Button
          title="Join Group"
          onPress={handleJoin}
          loading={joinGroup.isPending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
