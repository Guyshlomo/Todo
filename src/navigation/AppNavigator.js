import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" animating={true} />
      </View>
    );
  }

  const linking = {
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
