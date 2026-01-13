import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ActivityIndicator, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n/I18nProvider';

export default function InviteScreen({ route, navigation }) {
  const { t } = useI18n();
  const { groupId } = route.params;
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [userName, setUserName] = useState('');

  const inviteLink = useMemo(() => {
    // Example: exp://.../--/join?code=XXXX (Expo Go) or your app scheme in production
    return Linking.createURL('join', { queryParams: { code: inviteCode } });
  }, [inviteCode]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        // 1. Fetch challenge info
        const { data, error } = await supabase
          .from('groups')
          .select('name, invite_code')
          .eq('id', groupId)
          .single();
        if (error) throw error;

        // 2. Fetch current user display_name for share text
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', userData.user.id)
            .single();
          if (profile?.display_name) {
            setUserName(profile.display_name);
          }
        }

        if (!mounted) return;
        setInviteCode(data?.invite_code ?? '');
        setGroupName(data?.name ?? '');
      } catch (e) {
        Alert.alert(t('common.error'), e?.message ?? t('common.error'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" animating={true} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('invite.title')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('invite.cardTitle')}</Text>
        <Text style={styles.cardSubtitle}>{groupName}</Text>

        <Text style={styles.label}>{t('invite.joinCode')}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{inviteCode}</Text>
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={async () => {
            await Clipboard.setStringAsync(inviteCode);
            Alert.alert(t('common.save'), t('invite.copyCode'));
          }}
        >
          <Text style={styles.secondaryText}>{t('invite.copyCode')}</Text>
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: 14 }]}>{t('invite.joinLink')}</Text>
        <View style={styles.linkBox}>
          <Text style={styles.linkText} numberOfLines={2}>
            {inviteLink}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            const shareName = userName || 'חבר/ה';
            await Share.share({
              // Spec requires this exact Hebrew text in share:
              message: `${shareName} מאתגר אותך ב-Todo\n\nקוד הצטרפות: ${inviteCode}\nלינק: ${inviteLink}`,
            });
          }}
        >
          <Text style={styles.primaryText}>{t('invite.shareLink')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  container: { flex: 1, backgroundColor: '#F5F7FA', paddingTop: 60, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  back: { color: '#6366F1', fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '900', color: '#1A1C1E' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  cardTitle: { fontSize: 18, fontWeight: '900', textAlign: 'right', color: '#1A1C1E' },
  cardSubtitle: { marginTop: 4, color: '#6C757D', fontWeight: '700', textAlign: 'right' },
  label: { marginTop: 16, color: '#495057', fontWeight: '800', textAlign: 'right' },
  codeBox: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  codeText: { fontSize: 22, fontWeight: '900', color: '#4F46E5', letterSpacing: 1 },
  linkBox: {
    marginTop: 10,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 14,
    padding: 12,
  },
  linkText: { color: '#1A1C1E', fontWeight: '600', textAlign: 'right' },
  primaryButton: {
    marginTop: 14,
    backgroundColor: '#6366F1',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFF', fontWeight: '900' },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#4F46E5', fontWeight: '900' },
});


