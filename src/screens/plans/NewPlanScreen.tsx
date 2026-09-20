import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { PlanStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<PlanStackParamList, 'NewPlan'>;

export default function NewPlanScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>Who is this plan for?</Text>

      <TouchableOpacity
        style={[styles.option, { borderColor: theme.primary }]}
        onPress={() => navigation.navigate('ChoosePlanSource', { isPersonal: true })}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="account-outline" size={32} color={theme.primary} />
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Just Me</Text>
          <Text style={styles.optionDescription}>
            Track your own reading. You can invite others to it later.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, { borderColor: theme.primary }]}
        onPress={() => navigation.navigate('ChoosePlanSource', { isPersonal: false })}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="account-group-outline" size={32} color={theme.primary} />
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>A Group</Text>
          <Text style={styles.optionDescription}>
            Create a shared plan and invite others with a code right away.
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: Spacing.lg,
  },
  prompt: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 2,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 2,
  },
  optionDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
});
