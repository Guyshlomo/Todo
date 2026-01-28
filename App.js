import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n/I18nProvider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { supabase } from './src/lib/supabase';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  useEffect(() => {
    // NOTE: Don't touch push notifications on cold start.
    // On iOS 26 beta we saw TurboModule aborts in TestFlight when native modules
    // are initialized too early. We'll request permissions + fetch tokens only
    // after an explicit user action (e.g. in Settings).
    let authSubscription = null;
    let mounted = true;
    
    // Wrap in setTimeout to defer initialization and avoid crashes on iOS 26
    const initAuth = () => {
      try {
        // Check if supabase is available before using it
        if (supabase && supabase.auth && mounted) {
          try {
            const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
              void event;
            });
            authSubscription = sub;
          } catch (error) {
            console.error('Error setting up auth state listener in App:', error);
            // Continue without listener - app should still work
          }
        }
      } catch (error) {
        console.error('Error in App useEffect:', error);
      }
    };
    
    // Defer initialization slightly to avoid crashes on iOS 26
    const timeoutId = setTimeout(initAuth, 0);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (authSubscription?.subscription) {
        try {
          authSubscription.subscription.unsubscribe?.();
        } catch (error) {
          console.error('Error unsubscribing from auth state:', error);
        }
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <ThemeProvider>
            <I18nProvider>
              <AppWithTheme />
            </I18nProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function AppWithTheme() {
  const { isDark } = useTheme();
  return (
    <View style={styles.container}>
      <AppNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
