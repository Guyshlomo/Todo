import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scheduleChallengeReminder } from '../lib/reminders';

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CreateGroupScreen({ navigation }) {
  const [challengeName, setChallengeName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('binary'); // 'binary' or 'numeric'
  const [frequency, setFrequency] = useState('weekly'); // 'daily' or 'weekly'
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const canCreate = useMemo(() => {
    if (!challengeName.trim()) return false;
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return false;
    if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return false;
    if (startDate.getTime() > endDate.getTime()) return false;
    return true;
  }, [challengeName, startDate, endDate]);

  const handleCreate = async () => {
    if (!canCreate) {
      Alert.alert('שגיאה', 'אנא מלא/י שם אתגר ותוקף האתגר.');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      if (!session?.user?.id) {
        Alert.alert('שגיאה', 'נראה שאת/ה לא מחובר/ת. נסה/י להתחבר שוב.');
        return;
      }

      // MVP: "goal" isn't part of the product spec, but the current backend RPC requires it.
      // We keep a safe placeholder until DB/RPC are updated.
      const goalInt = 1;

      // Prefer v2 RPC that persists validity dates atomically.
      // Fallback to legacy RPC if v2 isn't deployed yet.
      let groupId = null;
      let usedV2 = false;
      let rpcError = null;
      const v2 = await supabase.rpc('create_group_with_challenge_v2', {
        p_group_name: challengeName.trim(),
        p_group_icon: null,
        p_challenge_name: challengeName.trim(),
        p_goal: goalInt,
        p_type: type,
        p_frequency: frequency,
        p_start_date: formatDateYYYYMMDD(startDate),
        p_end_date: formatDateYYYYMMDD(endDate),
        p_reminder_enabled: reminderEnabled,
        p_description: description.trim() ? description.trim() : null,
      });
      if (v2?.error) {
        console.log('create_group_with_challenge_v2 RPC error:', v2.error);
        rpcError = v2.error;
        // If v2 function missing in schema cache, fallback to v1.
        const msg = String(v2.error?.message || '').toLowerCase();
        const isMissingFn = msg.includes('could not find the function') || msg.includes('schema cache');
        if (isMissingFn) {
          const v1 = await supabase.rpc('create_group_with_challenge', {
            p_group_name: challengeName.trim(),
            p_group_icon: null,
            p_challenge_name: challengeName.trim(),
            p_goal: goalInt,
            p_type: type,
            p_frequency: frequency,
          });
          groupId = v1?.data ?? null;
          rpcError = v1?.error ?? null;
        }
      } else {
        groupId = v2?.data ?? null;
        usedV2 = true;
      }

      if (rpcError) throw rpcError;
      if (!groupId) throw new Error('לא הצלחנו ליצור אתגר');

      // Persist validity dates in DB (legacy path when v2 isn't deployed).
      // IMPORTANT: If v2 succeeded, do NOT do a second UPDATE (can be blocked by RLS and show a false error).
      if (!usedV2) try {
        // Some DB RPCs return group_id, others may return challenge_id.
        // We resolve the created challenge id robustly so dates always persist.
        let createdChallengeId = null;

        const { data: byGroup, error: chErr } = await supabase
          .from('challenges')
          .select('id')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!chErr && byGroup?.id) {
          createdChallengeId = byGroup.id;
        } else {
          const { data: byId, error: byIdErr } = await supabase
            .from('challenges')
            .select('id')
            .eq('id', groupId)
            .maybeSingle();
          if (!byIdErr && byId?.id) createdChallengeId = byId.id;
        }

        if (createdChallengeId) {
          const { data: updatedRows, error: updateErr } = await supabase
            .from('challenges')
            .update({
              start_date: formatDateYYYYMMDD(startDate),
              end_date: formatDateYYYYMMDD(endDate),
              reminder_enabled: reminderEnabled,
              description: description.trim() ? description.trim() : null,
            })
            .eq('id', createdChallengeId)
            // If RLS blocks UPDATE, PostgREST often returns 0 rows with no error.
            // Selecting forces an explicit success signal.
            .select('id, start_date, end_date');
          if (updateErr) throw updateErr;
          if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
            throw new Error('rls-blocked-challenges-update');
          }

          // Schedule reminders (local push). Proof: weekly = weekday of activation @ 20:00, daily = 20:00.
          if (reminderEnabled) {
            try {
              await scheduleChallengeReminder({
                challengeId: createdChallengeId,
                challengeName: challengeName.trim(),
                frequency,
              });
            } catch (e) {
              console.log('schedule reminder failed:', e?.message ?? e);
            }
          }
        } else {
          throw new Error('could-not-resolve-created-challenge-id');
        }
      } catch (e) {
        console.log('challenge post-update failed:', e?.message ?? e);
        if (String(e?.message || '') === 'rls-blocked-challenges-update') {
          Alert.alert(
            'הרשאות (RLS)',
            'האתגר נוצר, אבל אין לאפליקציה הרשאה לעדכן את טבלת challenges (ולכן end_date לא נשמר).\n\nפתרון מומלץ (קבוע):\n1) להריץ ב-Supabase את supabase/create_group_with_challenge_v2.sql\n2) Settings → API → Reload schema\n\nפתרון מהיר (פחות מאובטח): להריץ supabase/challenges_update_policy_mvp.sql'
          );
          return;
        }
        Alert.alert(
          'שימו לב',
          'האתגר נוצר, אבל תאריך הסיום לא נשמר ב-DB.\n\nכדי שזה יישמר תמיד: הרץ/י ב-Supabase את supabase/create_group_with_challenge_v2.sql ואז Reload schema.'
        );
      }

      // If v2 succeeded, we only need challenge id for scheduling reminders.
      if (usedV2 && reminderEnabled) {
        try {
          const { data: createdChallenge, error: chErr } = await supabase
            .from('challenges')
            .select('id')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!chErr && createdChallenge?.id) {
            await scheduleChallengeReminder({
              challengeId: createdChallenge.id,
              challengeName: challengeName.trim(),
              frequency,
            });
          }
        } catch (e) {
          console.log('schedule reminder failed:', e?.message ?? e);
        }
      }

      Alert.alert('הצלחה!', 'האתגר נוצר בהצלחה');
      navigation.goBack();
    } catch (error) {
      Alert.alert('שגיאה', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>צור אתגר חדש</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>שם האתגר</Text>
        <TextInput
          style={styles.input}
          placeholder="למשל: ריצה"
          value={challengeName}
          onChangeText={setChallengeName}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>תיאור (אופציונלי)</Text>
        <TextInput
          style={[styles.input, { minHeight: 90 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="מה חשוב לשמור לאורך האתגר?"
          multiline={true}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>תוקף האתגר</Text>

        <TouchableOpacity
          style={styles.dateField}
          onPress={() => {
            setTempDate(startDate);
            setShowStartPicker(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.dateMeta}>תאריך התחלה</Text>
          <Text style={styles.dateText}>{formatDateYYYYMMDD(startDate)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateField, { marginTop: 10 }]}
          onPress={() => {
            setTempDate(endDate);
            setShowEndPicker(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.dateMeta}>תאריך סיום</Text>
          <Text style={styles.dateText}>{formatDateYYYYMMDD(endDate)}</Text>
        </TouchableOpacity>

        {startDate.getTime() > endDate.getTime() ? (
          <Text style={styles.inlineError}>תאריך סיום חייב להיות אחרי תאריך התחלה</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>תדירות דיווח</Text>
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.chip, frequency === 'daily' && styles.activeChip]}
            onPress={() => setFrequency('daily')}
          >
            <Text style={[styles.chipText, frequency === 'daily' && styles.activeChipText]}>יומי</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.chip, frequency === 'weekly' && styles.activeChip]}
            onPress={() => setFrequency('weekly')}
          >
            <Text style={[styles.chipText, frequency === 'weekly' && styles.activeChipText]}>שבועי</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>סוג דיווח</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, type === 'binary' && styles.activeChip]}
            onPress={() => setType('binary')}
          >
            <Text style={[styles.chipText, type === 'binary' && styles.activeChipText]}>בוצע / לא בוצע</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, type === 'numeric' && styles.activeChip]}
            onPress={() => setType('numeric')}
          >
            <Text style={[styles.chipText, type === 'numeric' && styles.activeChipText]}>מספרי</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
          <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 12 }}>
            <Text style={styles.label}>האם תרצה לקבל תזכורות?
            </Text>
            
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.createButton, (!canCreate || loading) && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={!canCreate || loading}
      >
        <Text style={styles.createButtonText}>{loading ? 'יוצר...' : 'צור אתגר חדש'}</Text>
      </TouchableOpacity>

      <Modal
        visible={showStartPicker || showEndPicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowStartPicker(false);
          setShowEndPicker(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <Text style={styles.modalAction}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{showStartPicker ? 'תאריך התחלה' : 'תאריך סיום'}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (showStartPicker) setStartDate(tempDate);
                  if (showEndPicker) setEndDate(tempDate);
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <Text style={styles.modalActionStrong}>אישור</Text>
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event, selectedDate) => {
                if (Platform.OS !== 'ios') {
                  if (selectedDate) {
                    if (showStartPicker) setStartDate(selectedDate);
                    if (showEndPicker) setEndDate(selectedDate);
                  }
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                } else if (selectedDate) {
                  setTempDate(selectedDate);
                }
              }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 20,
    marginTop: 10,
    color: '#1A1C1E',
  },
  section: {
    marginBottom: 25,
    
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 10,
    color: '#495057',
  },
  input: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  dateField: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontWeight: '900',
    color: '#1A1C1E',
  },
  dateMeta: {
    color: '#6C757D',
    fontWeight: '800',
  },
  inlineError: {
    textAlign: 'right',
    color: '#E03131',
    marginTop: 10,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#E9ECEF',
  },
  activeChip: {
    backgroundColor: '#6366F1',
  },
  chipText: {
    color: '#495057',
    fontWeight: '500',
  },
  activeChipText: {
    color: '#FFF',
  },
  createButton: {
    backgroundColor: '#6366F1',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helper: {
    marginTop: 4,
    textAlign: 'right',
    color: '#6C757D',
    fontWeight: '700',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 18,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    marginBottom: 6,
  },
  modalTitle: {
    fontWeight: '900',
    color: '#1A1C1E',
  },
  modalAction: {
    color: '#6C757D',
    fontWeight: '700',
  },
  modalActionStrong: {
    color: '#6366F1',
    fontWeight: '900',
  },
});

