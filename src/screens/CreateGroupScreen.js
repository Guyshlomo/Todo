import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';

export default function CreateGroupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [challengeName, setChallengeName] = useState('');
  const [goal, setGoal] = useState('3');
  const [type, setType] = useState('binary'); // 'binary' or 'numeric'
  const [frequency, setFrequency] = useState('weekly'); // 'daily' or 'weekly'
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name || !challengeName) {
      Alert.alert('שגיאה', 'יש למלא את כל השדות');
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

      const goalInt = Number.parseInt(goal, 10);
      if (Number.isNaN(goalInt) || goalInt <= 0) {
        Alert.alert('שגיאה', 'יעד חייב להיות מספר חיובי');
        return;
      }

      // Create everything atomically via RPC (avoids RLS edge-cases across multiple inserts)
      const { data: groupId, error } = await supabase.rpc('create_group_with_challenge', {
        p_group_name: name.trim(),
        p_group_icon: null,
        p_challenge_name: challengeName.trim(),
        p_goal: goalInt,
        p_type: type,
        p_frequency: frequency,
      });

      if (error) throw error;
      if (!groupId) throw new Error('לא הצלחנו ליצור קבוצה');

      Alert.alert('הצלחה!', 'הקבוצה והאתגר נוצרו בהצלחה');
      navigation.goBack();
    } catch (error) {
      Alert.alert('שגיאה', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>יצירת אתגר חדש  🎮</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>שם הקבוצה</Text>
        <TextInput
          style={styles.input}
          placeholder="למשל: רצי העיר"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>שם האתגר 🎯</Text>
        <TextInput
          style={styles.input}
          placeholder="למשל: 3 ריצות בשבוע"
          value={challengeName}
          onChangeText={setChallengeName}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>יעד (מספר)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={goal}
          onChangeText={setGoal}
        />
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

      <TouchableOpacity 
        style={styles.createButton} 
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.createButtonText}>{loading ? 'יוצר...' : 'צור קבוצה '}</Text>
      </TouchableOpacity>
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
    marginBottom: 30,
    color: '#1A1C1E',
  },
  section: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
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
});

