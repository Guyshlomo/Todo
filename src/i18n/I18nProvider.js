import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, DevSettings, I18nManager, Platform } from 'react-native';
import { getLanguage as getStoredLanguage, setLanguage as setStoredLanguage } from '../lib/localSettings';
import { translations } from './translations';

const I18nContext = createContext(null);

async function reloadApp() {
  // Prefer expo-updates if present, otherwise DevSettings.reload (dev).
  try {
    // eslint-disable-next-line global-require
    const Updates = require('expo-updates');
    if (Updates?.reloadAsync) {
      await Updates.reloadAsync();
      return;
    }
  } catch (_e) {
    // ignore
  }
  try {
    if (DevSettings?.reload) DevSettings.reload();
  } catch (_e) {
    // ignore
  }
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState('he'); // default
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const lang = await getStoredLanguage();
      if (!mounted) return;
      setLanguageState(lang);
      setReady(true);
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const t = useCallback(
    (key) => {
      const dict = translations[language] || translations.he;
      const parts = String(key).split('.');
      let cur = dict;
      for (const p of parts) {
        cur = cur?.[p];
      }
      return typeof cur === 'string' ? cur : key;
    },
    [language]
  );

  const setLanguage = useCallback(
    async (next) => {
      const nextLang = next === 'en' ? 'en' : 'he';
      await setStoredLanguage(nextLang);
      setLanguageState(nextLang);

      // Flip RTL/LTR if needed and reload for consistent layout.
      const shouldBeRTL = nextLang === 'he';
      if (I18nManager.isRTL !== shouldBeRTL) {
        try {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(shouldBeRTL);
        } catch (_e) {
          // ignore
        }
        Alert.alert(
          nextLang === 'en' ? 'Restart required' : 'נדרשת הפעלה מחדש',
          nextLang === 'en'
            ? 'We need to restart the app to apply language direction.'
            : 'כדי להחיל כיוון שפה (RTL/LTR) נדרשת הפעלה מחדש.',
          [
            {
              text: nextLang === 'en' ? 'Restart now' : 'הפעל מחדש עכשיו',
              onPress: () => reloadApp(),
            },
          ]
        );
      }
    },
    []
  );

  const value = useMemo(() => ({ language, t, setLanguage, ready }), [language, t, setLanguage, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}


