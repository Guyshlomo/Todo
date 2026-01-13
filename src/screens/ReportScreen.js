import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { supabase } from '../lib/supabase';
import { pickAvatarImage } from '../lib/avatar';
import { uploadProofImage } from '../lib/proofs';
import { Camera, Type, Check, X } from 'lucide-react-native';
import { notifyGroupEvent } from '../lib/pushEvents';
import { useTheme } from '../theme/ThemeProvider';

export default function ReportScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { challengeId, groupId } = route.params;
  const [challenge, setChallenge] = useState(null);
  const [value, setValue] = useState('1');
  const [isDone, setIsDone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [resultOverlay, setResultOverlay] = useState(null); // 'success' | 'fail' | null
  const [resultText, setResultText] = useState('');
  const [resultSubText, setResultSubText] = useState('');
  
  const [proofType, setProofType] = useState(null); // 'text' or 'image'
  const [proofText, setProofText] = useState('');
  const [proofImage, setProofImage] = useState(null);

  const overlayProgress = React.useRef(new Animated.Value(0)).current;
  const shakeX = React.useRef(new Animated.Value(0)).current;

  const playSuccessOverlay = ({ title, subtitle }) => {
    setResultOverlay('success');
    setResultText(title || 'כל הכבוד 🎈');
    setResultSubText(subtitle || '');
    overlayProgress.setValue(0);
    Animated.timing(overlayProgress, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      setResultOverlay(null);
      navigation.goBack();
    }, 2000);
  };

  const playFailOverlay = ({ title, subtitle }) => {
    setResultOverlay('fail');
    setResultText(title || 'לא נשמרו נקודות');
    setResultSubText(subtitle || '');
    overlayProgress.setValue(0);
    shakeX.setValue(0);

    Animated.parallel([
      Animated.timing(overlayProgress, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -1, duration: 350, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -1, duration: 350, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    setTimeout(() => {
      setResultOverlay(null);
      navigation.goBack();
    }, 950);
  };

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
      
      const pointsEarned =
        challenge.type === 'binary'
          ? (isDone ? 10 : 0)
          : 10;

      const payload = {
        challenge_id: challengeId,
        group_id: groupId,
        user_id: user.id,
        value: challenge.type === 'binary' ? (isDone ? 1 : 0) : parseInt(value),
        is_done: challenge.type === 'binary' ? isDone : true,
        points_earned: pointsEarned,
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
        totalXpAfter >= totalXpBefore + pointsEarned;

      // UX: for binary reports we show on-screen animation instead of alerts.
      if (challenge.type === 'binary') {
        if (isDone && pointsEarned > 0) {
          // Best-effort: notify other members (push)
          try {
            await notifyGroupEvent({ type: 'report', groupId, actorUserId: user.id });
          } catch (_e) {
            // ignore
          }

          const subtitle =
            totalXpAfter === null
              ? `+${pointsEarned} XP`
              : `+${pointsEarned} XP `;
          playSuccessOverlay({ title: 'נשמר! 🎉', subtitle });
        } else {
          // Best-effort: also notify on report submission even if "no" (still a report)
          try {
            await notifyGroupEvent({ type: 'report', groupId, actorUserId: user.id });
          } catch (_e) {
            // ignore
          }

          // "No" => no XP
          playFailOverlay({ title: 'לא נורא', subtitle: 'לא נשמרו נקודות הפעם' });
        }
        return;
      }

      const message =
        totalXpAfter === null
          ? (pointsEarned > 0 ? `הדיווח נשמר +${pointsEarned} XP` : 'הדיווח נשמר')
          : didIncrease
            ? (pointsEarned > 0
                ? `הדיווח נשמר +${pointsEarned} XP\nסה״כ: ${totalXpAfter} XP`
                : `הדיווח נשמר\nסה״כ: ${totalXpAfter} XP`)
            : (pointsEarned > 0
                ? `הדיווח נשמר +${pointsEarned} XP\nאבל ה-XP לא עודכן בשרת (סה״כ: ${totalXpAfter} XP)\nבדוק/י Trigger/RLS`
                : `הדיווח נשמר\nאבל ה-XP לא עודכן בשרת (סה״כ: ${totalXpAfter} XP)\nבדוק/י Trigger/RLS`);

      Alert.alert('איזה אלוף!', message, [{ text: 'יש!', onPress: () => navigation.goBack() }]);
    } catch (error) {
      console.error('Full report submit error:', error);
      Alert.alert('שגיאה', error.message || 'לא הצלחנו לשלוח את הדיווח');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} animating={true} />
      </View>
    );
  }

  const isBinary = challenge?.type === 'binary';
  const wordCount = proofText.trim() ? proofText.trim().split(/\s+/).length : 0;

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {resultOverlay ? (
        <ResultOverlay
          kind={resultOverlay}
          title={resultText}
          subtitle={resultSubText}
          progress={overlayProgress}
          shakeX={shakeX}
        />
      ) : null}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>ביטול</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>הדיווח שלך ⚡</Text>
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
          <Text style={styles.proofLabel}>שתף הוכחה</Text>
          <View style={styles.proofTabs}>
            

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
        
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ResultOverlay({ kind, title, subtitle, progress, shakeX }) {
  const overlayOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.0, 1] });
  const cardScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const failTranslateX = shakeX.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });

  return (
    <Animated.View style={[styles.overlayWrap, { opacity: overlayOpacity }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.overlayCard,
          {
            transform: [
              { scale: cardScale },
              ...(kind === 'fail' ? [{ translateX: failTranslateX }] : []),
            ],
          },
        ]}
      >
        <Text style={styles.overlayIcon}>{kind === 'success' ? '🎈🎈' : '✕'}</Text>
        <Text style={styles.overlayTitle}>{title}</Text>
        {subtitle ? <Text style={styles.overlaySubtitle}>{subtitle}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  overlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    width: '86%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F1F3F5',
    alignItems: 'center',
  },
  overlayIcon: {
    fontSize: 42,
    marginBottom: 6,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1C1E',
    textAlign: 'center',
  },
  overlaySubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    color: '#495057',
    textAlign: 'center',
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

