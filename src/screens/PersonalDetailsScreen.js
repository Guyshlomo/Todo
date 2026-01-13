import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

export default function PersonalDetailsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState(null);
  const [email, setEmail] = useState('');
  const isFocused = useIsFocused();

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
          .select('display_name, birthdate, email')
          .eq('id', user.id)
          .single();

        if (!mounted) return;
        setEmail(user.email || data?.email || '');
        setRow(data ?? null);
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
          <Text style={styles.back}>חזרה</Text>
        </TouchableOpacity>
        <Text style={styles.title}>פרטים אישיים</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.value} numberOfLines={1}>{email || '—'}</Text>
          <Text style={styles.label}>אימייל</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.value} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.label}>שם</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.value} numberOfLines={1}>{birthdate}</Text>
          <Text style={styles.label}>תאריך לידה</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  container: { flex: 1, backgroundColor: '#F5F7FA', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row-reverse', alignItems: 'left', justifyContent: 'space-between', marginBottom: 16 },
  back: { color: '#6366F1', fontWeight: '900' ,textAlign: 'left'},
  title: { fontSize: 20, fontWeight: '900', color: '#1A1C1E' },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F3F5' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  label: { color: '#6C757D', fontWeight: '800' },
  value: { color: '#1A1C1E', fontWeight: '900', maxWidth: '70%', textAlign: 'left' },
  divider: { height: 1, backgroundColor: '#F1F3F5' },
});


