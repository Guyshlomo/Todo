import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import ReportScreen from '../screens/ReportScreen';
import InviteScreen from '../screens/InviteScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="Invite" component={InviteScreen} />
    </Stack.Navigator>
  );
}


