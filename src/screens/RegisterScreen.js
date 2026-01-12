import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { pickAvatarImage, savePendingAvatar, uploadAvatarToSupabase } from '../lib/avatar';
import DateTimePicker from '@react-native-community/datetimepicker';

function isValidBirthdateString(s) {
  // Expected YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthdateDate, setBirthdateDate] = useState(null); // Date
  const [avatarUri, setAvatarUri] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
  const [tempBirthdate, setTempBirthdate] = useState(new Date(2000, 0, 1));

  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const emailRef = useRef(null);

  const birthdate = useMemo(() => {
    return birthdateDate ? formatDateYYYYMMDD(birthdateDate) : '';
  }, [birthdateDate]);

  const birthdateError = useMemo(() => {
    if (!birthdate) return null;
    return isValidBirthdateString(birthdate) ? null : 'תאריך לא תקין';
  }, [birthdate]);

  const passwordMismatch = useMemo(() => {
    if (!password || !confirmPassword) return null;
    return password === confirmPassword ? null : 'הסיסמאות לא תואמות';
  }, [password, confirmPassword]);

  const canSubmit = useMemo(() => {
    if (!fullName.trim()) return false;
    if (!email || !password || !confirmPassword || !birthdate) return false;
    if (password !== confirmPassword) return false;
    if (!isValidBirthdateString(birthdate)) return false;
    return true;
  }, [fullName, email, password, confirmPassword, birthdate]);

  const handleRegister = async () => {
    if (!canSubmit) {
      Alert.alert('שגיאה', 'אנא מלא/י שם מלא ובדוק/י שכל השדות תקינים (תאריך: YYYY-MM-DD).');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Trigger will copy this into public.users.*
          data: { birthdate, display_name: fullName.trim() },
        },
      });
      if (error) throw error;

      // If email confirmation is ON, session may be null here.
      // We'll upload immediately only if we have a logged-in session.
      const signedUpUserId = data?.user?.id ?? null;
      const hasSession = Boolean(data?.session);
      if (avatarUri) {
        if (hasSession && signedUpUserId) {
          try {
            await uploadAvatarToSupabase({ userId: signedUpUserId, uri: avatarUri });
          } catch (e) {
            // Don't block signup on avatar issues
            console.log('avatar upload failed:', e?.message ?? e);
          }
        } else {
          await savePendingAvatar(email.trim(), avatarUri);
        }
      }

     
      
    } catch (e) {
      Alert.alert('שגיאה', e?.message ?? 'משהו השתבש');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Text style={styles.backText}>לחץ לחזור</Text>
        </TouchableOpacity>

        <Text style={styles.title}>הרשמה</Text>
        <Text style={styles.subtitle}>דקה ואת/ה בפנים</Text>

        <View style={styles.form}>
        <View style={styles.avatarRow}>
          <TouchableOpacity
            style={styles.avatarPressable}
            onPress={async () => {
              try {
                const uri = await pickAvatarImage();
                if (uri) setAvatarUri(uri);
              } catch (e) {
                Alert.alert('שגיאה', e?.message ?? 'לא הצלחנו לפתוח את הגלריה');
              }
            }}
            activeOpacity={0.85}
          >
            <View style={styles.avatarPreviewWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
            </View>
            {!avatarUri ? (
              <View style={styles.avatarPlusBadge}>
                <Text style={styles.avatarPlusText}>+</Text>
              </View>
            ) : (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditText}>✎</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>לחץ כדי להוסיף תמונת פרופיל</Text>
        </View>

        <Text style={styles.label}>איך נקרא לך? (חובה)</Text>
        <TextInput
          style={styles.input}
          placeholder="שם מלא"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus?.()}
        />

        <Text style={styles.label}>אימייל</Text>
        <TextInput
          ref={emailRef}
          style={styles.input}
          placeholder="name@email.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus?.()}
        />

        <Text style={styles.label}>סיסמה</Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={passwordRef}
            style={styles.inputInRow}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus?.()}
            textAlign="right"
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.eyeButton}
          >
            {showPassword ? (
              <EyeOff size={20} color="#6366F1" />
            ) : (
              <Eye size={20} color="#6366F1" />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>אימות סיסמה</Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={confirmPasswordRef}
            style={styles.inputInRow}
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            textContentType="newPassword"
            returnKeyType="next"
            textAlign="right"
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.eyeButton}
          >
            {showConfirmPassword ? (
              <EyeOff size={20} color="#6366F1" />
            ) : (
              <Eye size={20} color="#6366F1" />
            )}
          </TouchableOpacity>
        </View>
        {passwordMismatch ? <Text style={styles.inlineError}>{passwordMismatch}</Text> : null}

        <Text style={styles.label}>תאריך לידה</Text>
        <TouchableOpacity
          style={styles.dateField}
          onPress={() => {
            const base = birthdateDate ?? new Date(2000, 0, 1);
            setTempBirthdate(base);
            setShowBirthdatePicker(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.dateText, !birthdate && styles.datePlaceholder]}>
            {birthdate || 'בחר/י תאריך'}
          </Text>
          <Text style={styles.dateChevron}>▾</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>מומלץ: בחר/י תאריך מהתפריט</Text>
        {birthdateError ? <Text style={styles.inlineError}>{birthdateError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" animating={true} />
          ) : (
            <Text style={styles.buttonText}>צור חשבון</Text>
          )}
        </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showBirthdatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBirthdatePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowBirthdatePicker(false)}>
                <Text style={styles.modalAction}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>תאריך לידה</Text>
              <TouchableOpacity
                onPress={() => {
                  setBirthdateDate(tempBirthdate);
                  setShowBirthdatePicker(false);
                }}
              >
                <Text style={styles.modalActionStrong}>אישור</Text>
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={tempBirthdate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(_event, selectedDate) => {
                if (Platform.OS !== 'ios') {
                  // Android closes on selection
                  if (selectedDate) setBirthdateDate(selectedDate);
                  setShowBirthdatePicker(false);
                } else if (selectedDate) {
                  setTempBirthdate(selectedDate);
                }
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  backRow: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  backText: {
    color: '#6366F1',
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1A1C1E',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6C757D',
    marginBottom: 24,
  },
  form: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  label: {
    textAlign: 'right',
    color: '#495057',
    fontWeight: '700',
    marginBottom: 8,
  },
  avatarRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarPressable: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#F8F9FA',
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    marginTop: 10,
    color: '#6C757D',
    fontWeight: '600',
  },
  avatarPlusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  avatarPlusText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  avatarEditText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  passwordToggleText: {
    color: '#6366F1',
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingLeft: 8,
    marginBottom: 12,
  },
  inputInRow: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 15,
    textAlign: 'right',
  },
  eyeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  input: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  dateField: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  dateText: {
    textAlign: 'right',
    color: '#1A1C1E',
    fontWeight: '700',
  },
  datePlaceholder: {
    color: '#6C757D',
    fontWeight: '600',
  },
  dateChevron: {
    color: '#6366F1',
    fontSize: 18,
    fontWeight: '900',
  },
  helperText: {
    textAlign: 'right',
    color: '#6C757D',
    marginTop: -6,
    marginBottom: 10,
    fontWeight: '500',
    fontSize: 12,
  },
  inlineError: {
    textAlign: 'right',
    color: '#E03131',
    marginTop: -6,
    marginBottom: 10,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#6366F1',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
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


