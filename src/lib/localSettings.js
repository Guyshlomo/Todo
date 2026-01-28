import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  language: 'todo:language', // 'he' | 'en'
  updatesOptIn: 'todo:updatesOptIn', // '1' | '0'
  theme: 'todo:theme', // 'light' | 'dark'
};

export async function getLanguage() {
  try {
    const v = await AsyncStorage.getItem(KEYS.language);
    return v === 'en' ? 'en' : 'he';
  } catch (error) {
    console.error('Error getting language:', error);
    return 'he'; // Default fallback
  }
}

export async function setLanguage(lang) {
  try {
    await AsyncStorage.setItem(KEYS.language, lang === 'en' ? 'en' : 'he');
  } catch (error) {
    console.error('Error setting language:', error);
  }
}

export async function getUpdatesOptIn() {
  try {
    const v = await AsyncStorage.getItem(KEYS.updatesOptIn);
    return v === '1';
  } catch (error) {
    console.error('Error getting updates opt-in:', error);
    return false; // Default fallback
  }
}

export async function setUpdatesOptIn(enabled) {
  try {
    await AsyncStorage.setItem(KEYS.updatesOptIn, enabled ? '1' : '0');
  } catch (error) {
    console.error('Error setting updates opt-in:', error);
  }
}

export async function getTheme() {
  try {
    const v = await AsyncStorage.getItem(KEYS.theme);
    return v === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.error('Error getting theme:', error);
    return 'light'; // Default fallback
  }
}

export async function setTheme(theme) {
  try {
    await AsyncStorage.setItem(KEYS.theme, theme === 'dark' ? 'dark' : 'light');
  } catch (error) {
    console.error('Error setting theme:', error);
  }
}


