import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useI18n } from '../i18n/I18nProvider';

function isValidBirthdateString(s) {
  // Expected YYYY-MM-DD
  if (!s) return true; // allow empty
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export default function PersonalDetailsScreen({ navigation }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState(null);
  const [email, setEmail] = useState('');
  const isFocused = useIsFocused();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftBirthdate, setDraftBirthdate] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user ?? null;
        if (!user) return;

        const { data } = await supabase
          .from('users')
          .select('display_name, birthdate')
          .eq('id', user.id)
          .single();

        if (!mounted) return;
        const resolvedDisplayName =
          data?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || null;
        setEmail(user.email || '');
        setRow({
          ...(data ?? {}),
          display_name: resolvedDisplayName,
        });
        setDraftName(resolvedDisplayName || '');
        setDraftBirthdate(data?.birthdate || '');
        setIsEditing(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [isFocused]);

  const displayName = useMemo(() => row?.display_name || '—', [row]);
  const birthdate = useMemo(() => row?.birthdate || '—', [row]);

  const handleSave = async () => {
    if (!draftName.trim()) {
      Alert.alert(t('common.error'), t('auth.fullName'));
      return;
    }
    if (!isValidBirthdateString(draftBirthdate.trim())) {
      Alert.alert(t('common.error'), t('personalDetails.birthdateHint'));
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user ?? null;
      if (!user) throw new Error(t('common.error'));

      const payload = {
        display_name: draftName.trim(),
        birthdate: draftBirthdate.trim() ? draftBirthdate.trim() : null,
      };

      const { error: updateErr } = await supabase.from('users').update(payload).eq('id', user.id);
      if (updateErr) throw updateErr;

      // Keep auth metadata consistent (used as fallback elsewhere)
      await supabase.auth.updateUser({ data: { display_name: draftName.trim() } });

      setRow((prev) => ({ ...(prev || {}), ...payload }));
      setIsEditing(false);
      Alert.alert(t('personalDetails.saved'), t('personalDetails.saved'));
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? t('common.error'));
    } finally {
      setSaving(false);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('personalDetails.title')}</Text>
        <TouchableOpacity
          onPress={() => {
            if (isEditing) {
              setDraftName(displayName === '—' ? '' : displayName);
              setDraftBirthdate(birthdate === '—' ? '' : birthdate);
              setIsEditing(false);
            } else {
              setIsEditing(true);
            }
          }}
          disabled={saving}
          style={{ width: 48, alignItems: 'flex-end' }}
        >
          <Text style={styles.editLink}>{isEditing ? t('common.cancel') : t('personalDetails.edit')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('personalDetails.email')}</Text>
          <Text style={styles.value} numberOfLines={1}>{email || '—'}</Text>
        </View>
        <Text style={styles.helper}>{t('personalDetails.emailReadOnly')}</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>{t('personalDetails.name')}</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder={t('auth.fullName')}
              textAlign="left"
            />
          ) : (
            <Text style={styles.value} numberOfLines={1}>{displayName}</Text>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>{t('personalDetails.birthdate')}</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={draftBirthdate}
              onChangeText={setDraftBirthdate}
              placeholder={t('personalDetails.birthdateHint')}
              autoCapitalize="none"
              textAlign="left"
            />
          ) : (
            <Text style={styles.value} numberOfLines={1}>{birthdate}</Text>
          )}
        </View>

        {isEditing ? (
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.9}
          >
            <Text style={styles.saveText}>{saving ? t('common.loading') : t('personalDetails.save')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  container: { flex: 1, backgroundColor: '#F5F7FA', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  back: { color: '#6366F1', fontWeight: '900' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900', color: '#1A1C1E' },
  editLink: { color: '#6366F1', fontWeight: '900' },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F3F5' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  label: { color: '#6C757D', fontWeight: '800', textAlign: 'right' },
  value: { color: '#1A1C1E', fontWeight: '900', maxWidth: '70%', textAlign: 'left' },
  helper: { marginTop: -4, marginBottom: 8, color: '#6B7280', fontWeight: '600', textAlign: 'right', fontSize: 12 },
  input: {
    minWidth: 170,
    maxWidth: '70%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontWeight: '800',
    color: '#111827',
  },
  divider: { height: 1, backgroundColor: '#F1F3F5' },
  saveButton: {
    marginTop: 16,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { color: '#FFF', fontWeight: '900' },
});


