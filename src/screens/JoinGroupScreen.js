import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function JoinGroupScreen({ route, navigation }) {
  const initialCode = route?.params?.code ?? '';
  const [code, setCode] = useState(String(initialCode));
  const [loading, setLoading] = useState(false);

  const canJoin = useMemo(() => code.trim().length >= 4, [code]);

  const handleJoin = async () => {
    if (!canJoin) return;
    setLoading(true);
    try {
      const { data: groupId, error } = await supabase.rpc('join_group_by_invite_code', {
        p_invite_code: code.trim(),
      });
      if (error) throw error;
      if (!groupId) throw new Error('לא הצלחנו להצטרף');

      Alert.alert('הצטרפת!', 'ברוך/ה הבא/ה לקבוצה 🎯', [
        {
          text: 'יאללה',
          onPress: () => {
            // Go to group screen inside tabs/home stack (works from root stack too)
            navigation.navigate('App', {
              screen: 'HomeTab',
              params: { screen: 'GroupDetail', params: { groupId } },
            });
          },
        },
      ]);
    } catch (e) {
      Alert.alert('שגיאה', e?.message ?? 'קוד לא תקין');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('App', { screen: 'HomeTab', params: { screen: 'HomeMain' } });
          }}
        >
          <Text style={styles.back}>חזרה</Text>
        </TouchableOpacity>
        <Text style={styles.title}>הצטרפות לקבוצה</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>הכנס/י קוד הצטרפות</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="לדוגמה: A1B2C3D4"
        />

        <TouchableOpacity
          style={[styles.button, (!canJoin || loading) && styles.buttonDisabled]}
          disabled={!canJoin || loading}
          onPress={handleJoin}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" animating={true} />
          ) : (
            <Text style={styles.buttonText}>הצטרף</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  back: { color: '#6366F1', fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '900', color: '#1A1C1E' },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F1F3F5' },
  label: { color: '#495057', fontWeight: '800', textAlign: 'right' },
  input: {
    marginTop: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 14,
    padding: 14,
    textAlign: 'right',
    fontWeight: '800',
    letterSpacing: 1,
  },
  button: { marginTop: 14, backgroundColor: '#6366F1', padding: 14, borderRadius: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFF', fontWeight: '900' },
});


