import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n/I18nProvider';
import * as Notifications from 'expo-notifications';
import { ensureExpoPushTokenSaved } from './src/lib/pushEvents';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { supabase } from './src/lib/supabase';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (_e) {
  // Best-effort; never crash app startup
}

export default function App() {
  useEffect(() => {
    // Best-effort: save Expo push token for sending group notifications
    // (defer a tick so app can paint even if permissions/token calls are slow)
    const t = setTimeout(() => {
      ensureExpoPushTokenSaved();
    }, 250);

    // Also save token right after login / token refresh (common reason tokens stay NULL)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await ensureExpoPushTokenSaved();
      }
    });
    return () => {
      clearTimeout(t);
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
