import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import MainTabNavigator from './MainTabNavigator';

const Stack = createNativeStackNavigator();

/**
 * Root navigator for the app
 * Handles auth flow (Login → Onboarding → Main App)
 */
export default function RootNavigator() {
  const { session, user, loading, needsOnboarding } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Not authenticated - show auth screen
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : needsOnboarding ? (
          // Authenticated but no profile - show onboarding
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // Fully authenticated - show main app
          <Stack.Screen name="Main" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
