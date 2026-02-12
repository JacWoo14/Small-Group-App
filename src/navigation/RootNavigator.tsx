import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';

// Screens (to be created)
// import AuthScreen from '../screens/AuthScreen';

const Stack = createNativeStackNavigator();

/**
 * Root navigator for the app
 * Handles auth flow and main app navigation
 */
export default function RootNavigator() {
  // TODO: Add auth state management
  const isAuthenticated = true; // Placeholder - will be from AuthContext

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        ) : (
          // TODO: Create AuthScreen
          // <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="Main" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
