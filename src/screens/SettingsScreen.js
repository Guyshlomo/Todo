import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { getUpdatesOptIn, setUpdatesOptIn } from '../lib/localSettings';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';

export default function SettingsScreen({ navigation }) {
  const { t, language, setLanguage } = useI18n();
  const { isDark, setTheme, colors } = useTheme();
  const [updatesOptIn, setUpdatesOptInState] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const updates = await getUpdatesOptIn();
      if (!mounted) return;
      setUpdatesOptInState(updates);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDeleteAccount = async () => {
    Alert.alert(
      t('settings.confirmDeleteTitle'),
      t('settings.confirmDeleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: language === 'en' ? 'Delete' : 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: authData } = await supabase.auth.getUser();
              const user = authData?.user ?? null;
              if (!user) return;
              await supabase.from('users').delete().eq('id', user.id);
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert('שגיאה', e?.message ?? 'לא הצלחנו למחוק חשבון');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(t('settings.confirmLogoutTitle'), t('settings.confirmQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: language === 'en' ? 'Log out' : 'צא/י',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: colors.primary }]}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.title')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.language')}</Text>
        <View style={styles.langPills}>
          <TouchableOpacity
            style={[
              styles.langPill,
              { backgroundColor: colors.chipBg, borderColor: colors.border },
              language === 'he' && [styles.langPillActive, { backgroundColor: colors.text, borderColor: colors.text }],
            ]}
            onPress={async () => {
              await setLanguage('he');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.langPillText, { color: colors.text }, language === 'he' && styles.langPillTextActive]}>עברית</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.langPill,
              { backgroundColor: colors.chipBg, borderColor: colors.border },
              language === 'en' && [styles.langPillActive, { backgroundColor: colors.text, borderColor: colors.text }],
            ]}
            onPress={async () => {
              await setLanguage('en');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.langPillText, { color: colors.text }, language === 'en' && styles.langPillTextActive]}>English</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.row}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.darkMode')}</Text>
          <Switch
            value={isDark}
            onValueChange={async (v) => {
              await setTheme(v ? 'dark' : 'light');
            }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.row}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.updatesOptIn')}</Text>
          <Switch
            value={updatesOptIn}
            onValueChange={async (v) => {
              setUpdatesOptInState(v);
              await setUpdatesOptIn(v);
            }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.85}>
          <Text style={[styles.dangerText, { color: colors.danger }]}>{t('settings.deleteAccount')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.logoutBottomButton,
          { backgroundColor: isDark ? '#3B0A0E' : '#FFE4E6', borderColor: isDark ? '#7F1D1D' : '#FDA4AF' },
        ]}
        onPress={handleLogout}
        activeOpacity={0.9}
      >
        <Text style={[styles.logoutBottomText, { color: isDark ? '#FCA5A5' : '#BE123C' }]}>{t('settings.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA', paddingTop: 56, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  back: { color: '#6366F1', fontWeight: '900' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#111827' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  sectionTitle: { fontWeight: '900', color: '#111827', textAlign: 'right', marginBottom: 10 },
  langPills: { flexDirection: 'row-reverse', gap: 8 },
  langPill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  langPillActive: { backgroundColor: '#111827', borderColor: '#111827' },
  langPillText: { fontWeight: '900', color: '#111827' },
  langPillTextActive: { color: '#FFF' },
  divider: { height: 1, backgroundColor: '#EEF2F7', marginVertical: 14 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '800', color: '#111827', textAlign: 'right' },
  dangerText: { fontWeight: '900', color: '#DC2626', textAlign: 'right' },
  logoutBottomButton: {
    marginTop: 'auto',
    marginBottom: 22,
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutBottomText: {
    color: '#BE123C',
    fontWeight: '900',
    fontSize: 16,
  },
});


