import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function ReportScreen({ route, navigation }) {
  const { challengeId } = route.params;
  const [value, setValue] = useState('1');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      const { error } = await supabase
        .from('reports')
        .insert([{
          challenge_id: challengeId,
          user_id: user.id,
          value: parseInt(value),
          is_done: true,
          points_earned: 10 // Basic point logic for MVP
        }]);

      if (error) throw error;

      Alert.alert('איזה אלוף!', 'הדיווח נשמר +10⭐', [
        { text: 'יש!', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('שגיאה', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>ביטול</Text>
        </TouchableOpacity>
        <Text style={styles.title}>הדיווח שלך ⚡</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>כמה פעמים ביצעת היום?</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={value}
          onChangeText={setValue}
          autoFocus={true}
        />

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" animating={true} />
          ) : (
            <Text style={styles.submitButtonText}>✔ שלח דיווח</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    color: '#6C757D',
    fontSize: 16,
  },
  content: {
    padding: 30,
    alignItems: 'center',
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#6366F1',
    textAlign: 'center',
    width: '100%',
    marginBottom: 40,
  },
  submitButton: {
    backgroundColor: '#6366F1',
    width: '100%',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

