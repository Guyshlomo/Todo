import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { pickAvatarImage, uploadAvatarToSupabase } from '../lib/avatar';
import { useIsFocused } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { ChevronLeft } from 'lucide-react-native';
import { getLanguage, getUpdatesOptIn } from '../lib/localSettings';

const PRIVACY_POLICY_URL = 'https://to-do-b5e7d755.base44.app/';

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [userRow, setUserRow] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const isFocused = useIsFocused();
  const [_language, setLanguageState] = useState('he'); // loaded for consistency
  const [_updatesOptIn, setUpdatesOptInState] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const [lang, updates] = await Promise.all([getLanguage(), getUpdatesOptIn()]);
        if (mounted) {
          setLanguageState(lang);
          setUpdatesOptInState(updates);
        }

        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user ?? null;
        if (!user) return;

        const { data: row } = await supabase
          .from('users')
          .select('email, avatar_url, display_name, birthdate, total_points')
          .eq('id', user.id)
          .single();

        if (!mounted) return;
        
        // Combine auth metadata and DB row for the most accurate info
        const combinedRow = {
          ...row,
          display_name: row?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || 'משתמש',
        };

        setUserRow(combinedRow);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [isFocused]);

  const displayName = useMemo(() => userRow?.display_name || 'משתמש', [userRow]);

  const handleOpenPrivacy = async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch (_e) {
      Alert.alert('שגיאה', 'לא הצלחנו לפתוח את מדיניות הפרטיות');
    }
  };

  const handleChangeAvatar = async () => {
    try {
      setSavingAvatar(true);
      const uri = await pickAvatarImage();
      if (!uri) return;

      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id ?? null;
      if (!userId) throw new Error('לא מחובר');

      await uploadAvatarToSupabase({ userId, uri });
      setUserRow((prev) => ({ ...(prev || {}), avatar_url: uri }));
      // refresh row from DB (public URL)
      const { data: row } = await supabase
        .from('users')
        .select('avatar_url, display_name, birthdate, total_points, email')
        .eq('id', userId)
        .single();
      if (row) setUserRow(row);
    } catch (e) {
      Alert.alert('שגיאה', e?.message ?? 'לא הצלחנו לעדכן תמונה');
    } finally {
      setSavingAvatar(false);
    }
  };

  // Settings actions moved to SettingsScreen

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" animating={true} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>הפרופיל שלי</Text>

      <View style={styles.card}>
        <Text style={styles.nameCentered}>{displayName}</Text>
        <TouchableOpacity
          style={styles.avatarPressableCentered}
          onPress={handleChangeAvatar}
          disabled={savingAvatar}
          activeOpacity={0.85}
        >
          {userRow?.avatar_url ? (
            <Image source={{ uri: userRow.avatar_url }} style={styles.avatarCentered} />
          ) : (
            <View style={styles.avatarPlaceholderCentered}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
          <View style={styles.avatarBadgeCentered}>
            {savingAvatar ? (
              <ActivityIndicator color="#FFF" animating={true} />
            ) : (
              <Text style={styles.avatarBadgeText}>✎</Text>
            )}
          </View>
        </TouchableOpacity>


        <Text style={styles.note}>טיפ: תמונת פרופיל עוזרת לחברים לזהות אותך .</Text>
        <View style={styles.listCard}>
          <TouchableOpacity
            style={styles.rowPress}
            onPress={() => navigation.navigate('PersonalDetails')}
            activeOpacity={0.85}
          >
            <Text style={styles.rowTitle}>פרטים אישיים</Text>
            <View style={{ flex: 1 }} />
            <ChevronLeft size={18} color="#6C757D" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.rowPress} onPress={handleOpenPrivacy} activeOpacity={0.85}>
            <Text style={styles.rowTitle}>מדיניות פרטיות</Text>
            <View style={{ flex: 1 }} />
            <ChevronLeft size={18} color="#6C757D" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.rowPress} onPress={() => navigation.navigate('Settings')} activeOpacity={0.85}>
            <Text style={styles.rowTitle}>הגדרות</Text>
            <View style={{ flex: 1 }} />
            <ChevronLeft size={18} color="#6C757D" />
          </TouchableOpacity>
        </View>

        
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F8FA' },
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { paddingTop: 56, paddingHorizontal: 18, paddingBottom: 120 },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', color: '#111827', marginBottom: 14 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  nameCentered: { fontSize: 20, fontWeight: '900', textAlign: 'center', color: '#111827' },
  avatarPressableCentered: { alignSelf: 'center', marginTop: 14, width: 104, height: 104, borderRadius: 52 },
  avatarCentered: { width: 104, height: 104, borderRadius: 52 },
  avatarPlaceholderCentered: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarPlaceholderText: { fontSize: 34 },
  avatarBadgeCentered: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarBadgeText: { color: '#FFF', fontWeight: '900' },
  avatarHint: { marginTop: 10, color: '#6B7280', fontWeight: '700', textAlign: 'center', fontSize: 12 },
  xpPill: {
    marginTop: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
 
  sectionTitle: { marginTop: 18, marginBottom: 10, fontWeight: '900', color: '#111827', textAlign: 'right' },
  listCard: { backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF2F7', overflow: 'hidden' },
  rowPress: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14 },
  rowTitle: { fontWeight: '800', color: '#111827', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#EEF2F7' },
  // settings styles moved to SettingsScreen
  note: { marginTop: 14,marginBottom: 14, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
});


