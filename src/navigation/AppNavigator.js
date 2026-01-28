import React, { useState, useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AppTabs from './AppTabs';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import { View, ActivityIndicator } from 'react-native';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authSubscription = null;

    // Check if supabase is available
    if (!supabase || !supabase.auth) {
      console.error('Supabase not available');
      if (mounted) {
        setSession(null);
        setLoading(false);
      }
      return;
    }

    // Safely get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          // Continue with null session on error
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (error) {
        console.error('Exception getting session:', error);
        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initSession();

    // Subscribe to auth state changes
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) {
          setSession(session);
        }
      });
      authSubscription = subscription;
    } catch (error) {
      console.error('Error setting up auth state listener:', error);
    }

    return () => {
      mounted = false;
      if (authSubscription) {
        try {
          authSubscription.unsubscribe?.();
        } catch (error) {
          console.error('Error unsubscribing from auth state:', error);
        }
      }
    };
  }, []);

  // Lazy load expo-linking to avoid early native module initialization on iOS 26.x
  const linking = useMemo(() => {
    // Only initialize linking after app has loaded to avoid crashes
    if (loading) return undefined;
    try {
      // Dynamic import to defer native module loading
      const Linking = require('expo-linking');
      return {
    prefixes: [Linking.createURL('/')],
    config: {
      screens: {
        Join: {
          path: 'join',
          parse: {
            code: (code) => String(code || ''),
          },
        },
      },
    },
  };
    } catch (_e) {
      return undefined;
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" animating={true} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={session ? 'App' : 'Login'}
        key={session ? 'app' : 'auth'}
      >
        {/* Deep link entry for joining a group */}
        <Stack.Screen
          name="Join"
          component={JoinGroupScreen}
          options={{ presentation: 'modal' }}
        />
        {session ? (
          <Stack.Screen name="App" component={AppTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
