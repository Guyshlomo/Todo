// Import url-polyfill first, but wrap in try-catch for safety
let urlPolyfillLoaded = false;
try {
  require('react-native-url-polyfill/auto');
  urlPolyfillLoaded = true;
} catch (error) {
  console.warn('Failed to load react-native-url-polyfill:', error);
  // Continue without polyfill - Supabase might work without it
}

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://zengssfdubuhynxaxndg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inplbmdzc2ZkdWJ1aHlueGF4bmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzM4NDgsImV4cCI6MjA4MzQ0OTg0OH0.rpVRJpYpJFosN_W5eIMgCet6vhYzPUmUy8S0THzjDPQ';

// Safe AsyncStorage wrapper to prevent crashes on initialization
let safeAsyncStorage = AsyncStorage;
try {
  // Verify AsyncStorage is available
  if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
    console.warn('AsyncStorage not available, using in-memory fallback');
    // Fallback to in-memory storage if AsyncStorage fails
    const memoryStorage = {};
    safeAsyncStorage = {
      getItem: async (key) => memoryStorage[key] || null,
      setItem: async (key, value) => { memoryStorage[key] = value; },
      removeItem: async (key) => { delete memoryStorage[key]; },
    };
  }
} catch (error) {
  console.error('Error initializing AsyncStorage:', error);
  // Fallback to in-memory storage
  const memoryStorage = {};
  safeAsyncStorage = {
    getItem: async (key) => memoryStorage[key] || null,
    setItem: async (key, value) => { memoryStorage[key] = value; },
    removeItem: async (key) => { delete memoryStorage[key]; },
  };
}

let supabaseClient = null;

try {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: safeAsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} catch (error) {
  console.error('Error creating Supabase client:', error);
  // Create a minimal fallback client that won't crash
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: safeAsyncStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = supabaseClient;

