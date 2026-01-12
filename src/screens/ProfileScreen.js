import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { pickAvatarImage, uploadAvatarToSupabase } from '../lib/avatar';
import { useIsFocused } from '@react-navigation/native';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [userRow, setUserRow] = useState(null);
  const [email, setEmail] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
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
          email: user.email || row?.email
        };

        setEmail(combinedRow.email);
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
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.avatarPressable} onPress={handleChangeAvatar} disabled={savingAvatar}>
            {userRow?.avatar_url ? (
              <Image source={{ uri: userRow.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>👤</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {savingAvatar ? (
                <ActivityIndicator color="#FFF" animating={true} />
              ) : (
                <Text style={styles.avatarBadgeText}>✎</Text>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.identity}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{email || ''}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{userRow?.total_points ?? 0}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{userRow?.birthdate ?? '—'}</Text>
            <Text style={styles.statLabel}>תאריך לידה</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleChangeAvatar} disabled={savingAvatar}>
            <Text style={styles.secondaryText}>שנה תמונה</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.logoutText}>התנתק</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          טיפ: כדאי להעלות תמונה כדי שחברי הקבוצה יזהו אותך מהר.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'right', color: '#1A1C1E', marginBottom: 16 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  identity: { flex: 1, alignItems: 'flex-end', marginRight: 14 },
  avatarPressable: { width: 96, height: 96, borderRadius: 48 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  avatarPlaceholderText: { fontSize: 36 },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
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
  name: { fontSize: 20, fontWeight: '900', textAlign: 'right', color: '#1A1C1E' },
  email: { fontSize: 14, textAlign: 'right', color: '#6C757D', marginTop: 4 },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12 },
  stat: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  statValue: { fontSize: 16, fontWeight: '900', color: '#6366F1', textAlign: 'right' },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#6C757D', textAlign: 'right', marginTop: 4 },
  actionsRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#4F46E5', fontWeight: '900' },
  logoutButton: {
    flex: 1,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFD6D6',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#FF5252', fontWeight: '900' },
  note: { marginTop: 14, color: '#6C757D', fontWeight: '600', textAlign: 'right' },
});


