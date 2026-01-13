import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  language: 'todo:language', // 'he' | 'en'
  updatesOptIn: 'todo:updatesOptIn', // '1' | '0'
  theme: 'todo:theme', // 'light' | 'dark'
};

export async function getLanguage() {
  const v = await AsyncStorage.getItem(KEYS.language);
  return v === 'en' ? 'en' : 'he';
}

export async function setLanguage(lang) {
  await AsyncStorage.setItem(KEYS.language, lang === 'en' ? 'en' : 'he');
}

export async function getUpdatesOptIn() {
  const v = await AsyncStorage.getItem(KEYS.updatesOptIn);
  return v === '1';
}

export async function setUpdatesOptIn(enabled) {
  await AsyncStorage.setItem(KEYS.updatesOptIn, enabled ? '1' : '0');
}

export async function getTheme() {
  const v = await AsyncStorage.getItem(KEYS.theme);
  return v === 'dark' ? 'dark' : 'light';
}

export async function setTheme(theme) {
  await AsyncStorage.setItem(KEYS.theme, theme === 'dark' ? 'dark' : 'light');
}


