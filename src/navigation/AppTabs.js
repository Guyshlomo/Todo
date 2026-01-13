import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { House, User } from 'lucide-react-native';
import HomeStack from './HomeStack';
import ProfileStack from './ProfileStack';
import { useI18n } from '../i18n/I18nProvider';

const Tab = createBottomTabNavigator();

export default function AppTabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#6C757D',
        tabBarStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopColor: '#F1F3F5',
        },
        tabBarLabelStyle: { fontWeight: '700' },
        tabBarIcon: ({ color, focused, size }) => {
          const iconSize = Math.min(size ?? 24, 24);
          const Icon =
            route.name === 'HomeTab'
              ? House
              : route.name === 'ProfileTab'
                ? User
                : null;
          if (!Icon) return <View />;
          return <Icon size={iconSize} color={color} strokeWidth={focused ? 2.5 : 2} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ title: t('tabs.home') }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ title: t('tabs.profile') }}
      />
    </Tab.Navigator>
  );
}


