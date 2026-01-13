import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { getLanguage, getUpdatesOptIn, setLanguage, setUpdatesOptIn } from '../lib/localSettings';

export default function SettingsScreen({ navigation }) {
  const [language, setLanguageState] = useState('he'); // 'he' | 'en'
  const [updatesOptIn, setUpdatesOptInState] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [lang, updates] = await Promise.all([getLanguage(), getUpdatesOptIn()]);
      if (!mounted) return;
      setLanguageState(lang);
      setUpdatesOptInState(updates);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDeleteAccount = async () => {
    Alert.alert(
      'מחיקת החשבון',
      'האם אתה בטוח/ה בפעולה זו?\n\nזה ימחק את הפרופיל שלך (טבלת users) וינתק אותך. למחיקה מלאה של חשבון ההתחברות יידרש טיפול בצד שרת.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
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
    Alert.alert('יציאה מהחשבון', 'האם אתה בטוח/ה בפעולה זו?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'צא/י',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>חזרה</Text>
        </TouchableOpacity>
        <Text style={styles.title}>הגדרות</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>שינוי שפה</Text>
        <View style={styles.langPills}>
          <TouchableOpacity
            style={[styles.langPill, language === 'he' && styles.langPillActive]}
            onPress={async () => {
              setLanguageState('he');
              await setLanguage('he');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.langPillText, language === 'he' && styles.langPillTextActive]}>עברית</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langPill, language === 'en' && styles.langPillActive]}
            onPress={async () => {
              setLanguageState('en');
              await setLanguage('en');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.langPillText, language === 'en' && styles.langPillTextActive]}>English</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.rowTitle}>אפשרות לקבלת עדכונים</Text>
          <Switch
            value={updatesOptIn}
            onValueChange={async (v) => {
              setUpdatesOptInState(v);
              await setUpdatesOptIn(v);
            }}
          />
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.85}>
          <Text style={styles.dangerText}>מחיקת החשבון</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.logoutBottomButton}
        onPress={handleLogout}
        activeOpacity={0.9}
      >
        <Text style={styles.logoutBottomText}>התנתקות מהחשבון</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA', paddingTop: 56, paddingHorizontal: 18 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  back: { color: '#6366F1', fontWeight: '900' },
  title: { fontSize: 18, fontWeight: '900', color: '#111827' },
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


