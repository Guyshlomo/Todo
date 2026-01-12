import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://zengssfdubuhynxaxndg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inplbmdzc2ZkdWJ1aHlueGF4bmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzM4NDgsImV4cCI6MjA4MzQ0OTg0OH0.rpVRJpYpJFosN_W5eIMgCet6vhYzPUmUy8S0THzjDPQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

