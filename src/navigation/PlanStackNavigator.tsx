import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { PlanStackParamList } from '../types';
import PlansScreen from '../screens/plans/PlansScreen';
import NewPlanScreen from '../screens/plans/NewPlanScreen';
import ChoosePlanSourceScreen from '../screens/plans/ChoosePlanSourceScreen';
import CreateGroupScreen from '../screens/plans/CreateGroupScreen';
import JoinGroupScreen from '../screens/plans/JoinGroupScreen';
import PlanDetailsScreen from '../screens/plans/PlanDetailsScreen';
import ImportPlanScreen from '../screens/plans/ImportPlanScreen';

const Stack = createNativeStackNavigator<PlanStackParamList>();

export default function PlanStackNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="PlanList"
        component={PlansScreen}
        options={{ title: 'My Plans' }}
      />
      <Stack.Screen
        name="PlanDetails"
        component={PlanDetailsScreen}
        options={{ title: 'Plan Details' }}
      />
      <Stack.Screen
        name="NewPlan"
        component={NewPlanScreen}
        options={{ title: 'New Plan' }}
      />
      <Stack.Screen
        name="ChoosePlanSource"
        component={ChoosePlanSourceScreen}
        options={{ title: 'New Plan' }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'Create Group' }}
      />
      <Stack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{ title: 'Join Group' }}
      />
      <Stack.Screen
        name="ImportPlan"
        component={ImportPlanScreen}
        options={{ title: 'Import Plan' }}
      />
    </Stack.Navigator>
  );
}
