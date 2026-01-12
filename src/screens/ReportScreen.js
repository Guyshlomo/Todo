import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { pickAvatarImage } from '../lib/avatar';
import { uploadProofImage } from '../lib/proofs';
import { Camera, Type, Check, X } from 'lucide-react-native';

export default function ReportScreen({ route, navigation }) {
  const { challengeId, groupId } = route.params;
  const [challenge, setChallenge] = useState(null);
  const [value, setValue] = useState('1');
  const [isDone, setIsDone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [proofType, setProofType] = useState(null); // 'text' or 'image'
  const [proofText, setProofText] = useState('');
  const [proofImage, setProofImage] = useState(null);

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const { data, error } = await supabase
          .from('challenges')
          .select('*')
          .eq('id', challengeId)
          .single();
        if (error) throw error;
        setChallenge(data);
        if (data.type === 'binary') {
          setIsDone(true);
        }
      } catch (e) {
        Alert.alert('שגיאה', 'לא הצלחנו לטעון את פרטי האתגר');
      } finally {
        setFetching(false);
      }
    };
    fetchChallenge();
  }, [challengeId]);

  const handlePickImage = async () => {
    const uri = await pickAvatarImage();
    if (uri) {
      setProofImage(uri);
      setProofType('image');
      setProofText('');
    }
  };

  const handleSubmit = async () => {
    if (proofType === 'text' && proofText.trim().split(/\s+/).length > 100) {
      Alert.alert('שגיאה', 'ההוכחה הטקסטואלית ארוכה מדי (מקסימום 100 מילים)');
      return;
    }

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('משתמש לא מחובר');

      // Snapshot current XP (helps verify DB trigger is working)
      let totalXpBefore = null;
      try {
        const { data: beforeRow } = await supabase
          .from('users')
          .select('total_points')
          .eq('id', user.id)
          .single();
        if (typeof beforeRow?.total_points === 'number') totalXpBefore = beforeRow.total_points;
      } catch (_e) {
        // ignore
      }

      let uploadedImageUrl = null;
      if (proofType === 'image' && proofImage) {
        try {
          uploadedImageUrl = await uploadProofImage({
            userId: user.id,
            challengeId,
            uri: proofImage,
          });
        } catch (e) {
          // Proof is optional — don't block reporting if storage isn't configured.
          console.error('Proof upload failed, continuing without image:', e);
          uploadedImageUrl = null;
          Alert.alert('שימו לב', 'לא הצלחנו להעלות את התמונה כרגע — הדיווח יישמר בלי הוכחה.');
        }
      }
      
      const payload = {
        challenge_id: challengeId,
        group_id: groupId,
        user_id: user.id,
        value: challenge.type === 'binary' ? (isDone ? 1 : 0) : parseInt(value),
        is_done: challenge.type === 'binary' ? isDone : true,
        points_earned: 10,
        proof_text: proofType === 'text' ? proofText.trim() : null,
        proof_image_url: uploadedImageUrl,
      };

      const { error } = await supabase
        .from('reports')
        .insert([payload]);

      if (error) {
        console.error('Insert error:', error);
        if (
          error?.code === 'PGRST204' &&
          String(error?.message || '').toLowerCase().includes('group_id')
        ) {
          throw new Error(
            "חסרה עמודה group_id בטבלת reports. הוסף/י את העמודה ב-Supabase ואז נסה/י שוב."
          );
        }
        throw error;
      }

      // Best-effort: fetch updated XP from DB (validates trigger + keeps UI honest)
      let totalXpAfter = null;
      try {
        const { data: row } = await supabase
          .from('users')
          .select('total_points')
          .eq('id', user.id)
          .single();
        if (typeof row?.total_points === 'number') totalXpAfter = row.total_points;
      } catch (e) {
        // ignore
      }

      const didIncrease =
        typeof totalXpBefore === 'number' &&
        typeof totalXpAfter === 'number' &&
        totalXpAfter >= totalXpBefore + 10;

      const message =
        totalXpAfter === null
          ? 'הדיווח נשמר +10 XP'
          : didIncrease
            ? `הדיווח נשמר +10 XP\nסה״כ: ${totalXpAfter} XP`
            : `הדיווח נשמר +10 XP\nאבל ה-XP לא עודכן בשרת (סה״כ: ${totalXpAfter} XP)\nבדוק/י Trigger/RLS`;

      Alert.alert('איזה אלוף!', message, [
        { text: 'יש!', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Full report submit error:', error);
      Alert.alert('שגיאה', error.message || 'לא הצלחנו לשלוח את הדיווח');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" animating={true} />
      </View>
    );
  }

  const isBinary = challenge?.type === 'binary';
  const wordCount = proofText.trim() ? proofText.trim().split(/\s+/).length : 0;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>ביטול</Text>
        </TouchableOpacity>
        <Text style={styles.title}>הדיווח שלך ⚡</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>
          {isBinary ? 'ביצעת את האתגר היום?' : 'כמה פעמים ביצעת היום?'}
        </Text>

        {isBinary ? (
          <View style={styles.binaryRow}>
            <TouchableOpacity 
              style={[styles.binaryButton, !isDone && styles.binaryButtonActiveRed]}
              onPress={() => setIsDone(false)}
            >
              <X color={!isDone ? '#FFF' : '#FF5252'} size={32} />
              <Text style={[styles.binaryText, !isDone && styles.binaryTextActive]}>לא</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.binaryButton, isDone && styles.binaryButtonActiveGreen]}
              onPress={() => setIsDone(true)}
            >
              <Check color={isDone ? '#FFF' : '#22C55E'} size={32} />
              <Text style={[styles.binaryText, isDone && styles.binaryTextActive]}>כן!</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={value}
            onChangeText={setValue}
            autoFocus={true}
          />
        )}

        <View style={styles.proofSection}>
          <Text style={styles.proofLabel}>הוכחה (אופציונלי)</Text>
          <View style={styles.proofTabs}>
            <TouchableOpacity 
              style={[styles.proofTab, proofType === 'text' && styles.proofTabActive]}
              onPress={() => {
                setProofType(proofType === 'text' ? null : 'text');
                setProofImage(null);
              }}
            >
              <Type size={20} color={proofType === 'text' ? '#FFF' : '#6366F1'} />
              <Text style={[styles.proofTabText, proofType === 'text' && styles.proofTabActiveText]}>טקסט</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.proofTab, proofType === 'image' && styles.proofTabActive]}
              onPress={handlePickImage}
            >
              <Camera size={20} color={proofType === 'image' ? '#FFF' : '#6366F1'} />
              <Text style={[styles.proofTabText, proofType === 'image' && styles.proofTabActiveText]}>תמונה</Text>
            </TouchableOpacity>
          </View>

          {proofType === 'text' && (
            <View style={styles.textProofWrap}>
              <TextInput
                style={styles.textProofInput}
                placeholder="ספר/י בקצרה... (עד 100 מילים)"
                multiline
                value={proofText}
                onChangeText={setProofText}
                maxLength={1000}
              />
              <Text style={[styles.wordCount, wordCount > 100 && styles.wordCountError]}>
                {wordCount} / 100 מילים
              </Text>
            </View>
          )}

          {proofType === 'image' && proofImage && (
            <View style={styles.imageProofWrap}>
              <Image source={{ uri: proofImage }} style={styles.proofPreview} />
              <TouchableOpacity 
                style={styles.removeImage}
                onPress={() => {
                  setProofImage(null);
                  setProofType(null);
                }}
              >
                <X color="#FFF" size={16} />
              </TouchableOpacity>
            </View>
          )}
        </View>

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
        
        <Text style={styles.helperText}>יש לך זמן 💪</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#1A1C1E',
  },
  input: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#6366F1',
    textAlign: 'center',
    width: '100%',
    marginBottom: 40,
  },
  binaryRow: {
    flexDirection: 'row-reverse',
    gap: 20,
    width: '100%',
    marginBottom: 40,
  },
  binaryButton: {
    flex: 1,
    height: 120,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F1F3F5',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  binaryButtonActiveGreen: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  binaryButtonActiveRed: {
    backgroundColor: '#FF5252',
    borderColor: '#FF5252',
  },
  binaryText: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
    color: '#495057',
  },
  binaryTextActive: {
    color: '#FFF',
  },
  proofSection: {
    width: '100%',
    marginBottom: 30,
  },
  proofLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#495057',
    textAlign: 'right',
    marginBottom: 12,
  },
  proofTabs: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 16,
  },
  proofTab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    gap: 8,
  },
  proofTabActive: {
    backgroundColor: '#6366F1',
  },
  proofTabText: {
    fontWeight: '700',
    color: '#6366F1',
  },
  proofTabActiveText: {
    color: '#FFF',
  },
  textProofWrap: {
    width: '100%',
  },
  textProofInput: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    textAlign: 'right',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  wordCount: {
    textAlign: 'left',
    fontSize: 12,
    color: '#6C757D',
    marginTop: 6,
    fontWeight: '600',
  },
  wordCountError: {
    color: '#FF5252',
  },
  imageProofWrap: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  proofPreview: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    width: '100%',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  helperText: {
    marginTop: 20,
    color: '#22C55E',
    fontWeight: '900',
    fontSize: 16,
  },
});

