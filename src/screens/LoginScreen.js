import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { takePendingAvatar, uploadAvatarToSupabase } from '../lib/avatar';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef(null);

  const canSubmit = useMemo(() => {
    if (!email.trim()) return false;
    if (!password) return false;
    return true;
  }, [email, password]);

  const handleLogin = async () => {
    if (!canSubmit) {
      Alert.alert('שגיאה', 'אנא מלא/י אימייל וסיסמה.');
      return;
    }
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const userId = data?.user?.id ?? null;
      const pendingUri = await takePendingAvatar(email.trim());
      if (pendingUri && userId) {
        try {
          await uploadAvatarToSupabase({ userId, uri: pendingUri });
        } catch (e) {
          // Don't block login if upload fails; user can reselect later
          console.log('pending avatar upload failed:', e?.message ?? e);
        }
      }
    } catch (error) {
      Alert.alert('שגיאה', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>🎯 Todo</Text>
        <Text style={styles.subtitle}>מתחייבים. מתמידים. מנצחים.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>אימייל</Text>
          <TextInput
            style={styles.input}
            placeholder="name@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
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
              returnKeyType="go"
              onSubmitEditing={handleLogin}
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

          <TouchableOpacity
            style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" animating={true} />
            ) : (
              <Text style={styles.buttonText}>התחברות</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          >
            <Text style={styles.switchText}>אין לך חשבון? הירשם עכשיו</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#6366F1',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#6C757D',
    marginBottom: 40,
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
  input: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E9ECEF',
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
    marginBottom: 15,
  },
  inputInRow: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 15,
    textAlign: 'right',
  },
  passwordToggleText: {
    color: '#6366F1',
    fontWeight: '700',
  },
  eyeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  button: {
    backgroundColor: '#6366F1',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#6366F1',
    fontWeight: '500',
  },
});

