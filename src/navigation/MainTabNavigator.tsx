import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../constants/theme';

// Import placeholder screens
import HomeScreen from '../screens/HomeScreen';
import PlansScreen from '../screens/PlansScreen';
import GroupsScreen from '../screens/GroupsScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

/**
 * Main tab navigator - bottom tabs for primary app sections
 */
export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.sacredGold,
        },
        headerTintColor: Colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarActiveTintColor: Colors.sacredGold,
        tabBarInactiveTintColor: Colors.stoneGray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={HomeScreen}
        options={{
          title: "Today's Reading",
          // TODO: Add icon
        }}
      />
      <Tab.Screen
        name="Plans"
        component={PlansScreen}
        options={{
          title: 'Reading Plans',
          // TODO: Add icon
        }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          title: 'My Groups',
          // TODO: Add icon
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          title: 'My Progress',
          // TODO: Add icon
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          // TODO: Add icon
        }}
      />
    </Tab.Navigator>
  );
}
