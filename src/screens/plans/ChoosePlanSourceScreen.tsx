import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { PlanStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<PlanStackParamList, 'ChoosePlanSource'>;
type RouteProps = NativeStackScreenProps<PlanStackParamList, 'ChoosePlanSource'>['route'];

export default function ChoosePlanSourceScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { isPersonal } = route.params;
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>What are you reading?</Text>

      <TouchableOpacity
        style={[styles.option, { borderColor: theme.primary }]}
        onPress={() => navigation.navigate('TemplatePicker', { isPersonal })}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="book-open-variant" size={32} color={theme.primary} />
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>A Default Plan</Text>
          <Text style={styles.optionDescription}>
            Pick from the built-in catalog and start today.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, { borderColor: theme.primary }]}
        onPress={() => navigation.navigate('ImportPlan', { isPersonal })}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="clipboard-text-outline" size={32} color={theme.primary} />
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>My Own Plan</Text>
          <Text style={styles.optionDescription}>
            Paste a reading schedule you already have.
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
