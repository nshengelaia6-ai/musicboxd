
import { supabase } from '@/utils/supabase';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const processedUrls = useRef(new Set<string>());

  useEffect(() => {
    let mounted = true;

    async function processUrl(url: string | null) {
      if (!url || processedUrls.current.has(url)) return;

      processedUrls.current.add(url);

      try {
        const hash = url.includes('#')
          ? url.split('#')[1].split('?')[0]
          : '';

        const hashParams = new URLSearchParams(hash);

        const parsed = Linking.parse(url);
        const params = parsed.queryParams || {};

        const getParam = (key: string) => {
          const value = params[key];
          return Array.isArray(value) ? value[0] : value;
        };

        const code =
          getParam('code')?.toString() || '';

        const tokenHash =
          getParam('token_hash')?.toString() || '';

        const accessToken =
          hashParams.get('access_token') || '';

        const refreshToken =
          hashParams.get('refresh_token') || '';

        let authError = null;

        if (code) {
          const result =
            await supabase.auth.exchangeCodeForSession(code);

          authError = result.error;
        } else if (tokenHash) {
          const result = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });

          authError = result.error;
        } else if (accessToken && refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          authError = result.error;
        } else {
          const { data } = await supabase.auth.getSession();

          if (data.session) {
            if (mounted) setReady(true);
            return;
          }

          throw new Error(
            'The reset link is invalid or incomplete. Please request a new one.'
          );
        }

        if (authError) throw authError;

        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          throw new Error(
            'Could not verify the reset link. Please request a new one.'
          );
        }

        if (mounted) {
          setReady(true);
          setError('');
        }
      } catch (e) {
        if (mounted) {
          setError(
            e instanceof Error
              ? e.message
              : 'Could not verify the reset link.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function initialize() {
      if (Platform.OS === 'web') {
        await processUrl(window.location.href);
      } else {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          await processUrl(initialUrl);
        } else {
          const { data } = await supabase.auth.getSession();

          if (mounted && data.session) {
            setReady(true);
          }

          if (mounted) setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Linking.addEventListener(
      'url',
      ({ url }) => {
        setLoading(true);
        processIncomingUrl(url);
      }
    );

    async function processIncomingUrl(url: string) {
      if (processedUrls.current.has(url)) return;

      processedUrls.current.add(url);

      try {
        const hash = url.includes('#')
          ? url.split('#')[1].split('?')[0]
          : '';

        const hashParams = new URLSearchParams(hash);
        const parsed = Linking.parse(url);
        const params = parsed.queryParams || {};

        const getParam = (key: string) => {
          const value = params[key];
          return Array.isArray(value) ? value[0] : value;
        };

        const code = getParam('code')?.toString() || '';
        const tokenHash = getParam('token_hash')?.toString() || '';
        const accessToken = hashParams.get('access_token') || '';
        const refreshToken = hashParams.get('refresh_token') || '';

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          throw new Error('Invalid reset link.');
        }

        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          throw new Error('Could not verify reset link.');
        }

        setReady(true);
        setError('');
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not verify reset link.'
        );
      } finally {
        setLoading(false);
      }
    }

    return () => subscription.remove();
  }, []);

  async function handleUpdatePassword() {
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setMessage('Password updated successfully!');

      setTimeout(() => {
        router.replace('/auth');
      }, 1500);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not update password.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.form}>
        <Text style={styles.brand}>musicboxd</Text>

        <Text style={styles.heading}>Reset password.</Text>

        <Text style={styles.subtitle}>
          Create a new password for your account.
        </Text>

        {loading ? (
          <ActivityIndicator color="#729bc5" size="large" />
        ) : !ready ? (
          <>
            <Text style={styles.error}>
              {error || 'Your reset link could not be verified.'}
            </Text>

            <Pressable
              style={styles.button}
              onPress={() => router.replace('/forgot-password')}
            >
              <Text style={styles.buttonText}>
                Request a new link
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>NEW PASSWORD</Text>

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter new password"
              placeholderTextColor="#74818c"
              secureTextEntry
              autoCapitalize="none"
              editable={!saving}
            />

            <Text style={styles.label}>CONFIRM PASSWORD</Text>

            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#74818c"
              secureTextEntry
              autoCapitalize="none"
              editable={!saving}
            />

            {!!error && (
              <Text style={styles.error}>{error}</Text>
            )}

            {!!message && (
              <Text style={styles.message}>{message}</Text>
            )}

            <Pressable
              style={[styles.button, saving && { opacity: 0.6 }]}
              onPress={handleUpdatePassword}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  Update password
                </Text>
              )}
            </Pressable>
          </>
        )}
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
    marginTop: 18,
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
    marginTop: 22,
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
  error: {
    color: '#ff8585',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 15,
  },
  message: {
    color: '#9ed9b0',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 15,
  },
});
