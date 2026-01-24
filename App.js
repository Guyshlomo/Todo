import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n/I18nProvider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { supabase } from './src/lib/supabase';

export default function App() {
  useEffect(() => {
    // NOTE: Don't touch push notifications on cold start.
    // On iOS 26 beta we saw TurboModule aborts in TestFlight when native modules
    // are initialized too early. We'll request permissions + fetch tokens only
    // after an explicit user action (e.g. in Settings).
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      void event;
    });
    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AppWithTheme />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
