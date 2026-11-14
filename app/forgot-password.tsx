
import { supabase } from '@/utils/supabase';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleReset() {
    setError('');
    setMessage('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        Platform.OS === 'web'
          ? `${window.location.origin}/reset-password`
          : Linking.createURL('reset-password');

      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo }
      );

      if (error) throw error;

      setMessage(
        'If an account exists for this email, a password reset link has been sent. Check your inbox.'
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.form}>
        <Text style={styles.brand}>musicboxd</Text>

        <Text style={styles.heading}>Forgot password?</Text>

        <Text style={styles.subtitle}>
          Enter your email address and we will send you a link to reset
          your password.
        </Text>

        <Text style={styles.label}>EMAIL</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#74818c"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!message && <Text style={styles.message}>{message}</Text>}

        <Pressable
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.replace('/auth')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>Back to login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14181c',
    justifyContent: 'center',
    padding: 24,
  },
  form: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  brand: {
    color: '#f0f2f4',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 38,
  },
  heading: {
    color: '#f1f3f5',
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#9ca8b3',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 30,
  },
  label: {
    color: '#d9dfe4',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 9,
  },
  input: {
    width: '100%',
    height: 47,
    backgroundColor: '#1d2329',
    borderWidth: 1,
    borderColor: '#414d58',
    borderRadius: 5,
    color: '#f4f6f8',
    paddingHorizontal: 14,
    fontSize: 14,
    outlineStyle: 'none',
  } as any,
  button: {
    height: 47,
    marginTop: 20,
    borderRadius: 5,
    backgroundColor: '#527da9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 22,
  },
  backText: {
    color: '#729bc5',
    fontSize: 13,
  },
  error: {
    color: '#ff8585',
    fontSize: 13,
    marginTop: 12,
  },
  message: {
    color: '#9ed9b0',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
});
