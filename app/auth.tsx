
import { supabase } from '@/utils/supabase';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { createElement, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();

  const months = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
  ];

  const daysInMonth =
    birthYear && birthMonth
      ? new Date(
          Number(birthYear),
          Number(birthMonth),
          0
        ).getDate()
      : 31;

  function openTerms() {
    router.push('/terms');
  }

  function openPrivacy() {
    router.push('/privacy');
  }

  async function handleSubmit() {
    setError('');
    setMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (!cleanUsername) {
        setError('Please choose a username.');
        return;
      }

      if (!acceptedTerms) {
        setError(
          'Please agree to the Terms of Service and Privacy Policy.'
        );
        return;
      }

      if (password.length < 6) {
        setError('Your password must be at least 6 characters.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    let birthDate: string | null = null;

    if (mode === 'signup') {
      const dateParts = [birthDay, birthMonth, birthYear];
      const hasAnyDate = dateParts.some(Boolean);
      const hasCompleteDate = dateParts.every(Boolean);

      if (hasAnyDate && !hasCompleteDate) {
        setError(
          'Please select the complete date of birth or leave it empty.'
        );
        return;
      }

      if (hasCompleteDate) {
        const day = Number(birthDay);
        const month = Number(birthMonth);
        const year = Number(birthYear);

        const selectedDate = new Date(year, month - 1, day);

        if (
          selectedDate.getFullYear() !== year ||
          selectedDate.getMonth() !== month - 1 ||
          selectedDate.getDate() !== day
        ) {
          setError('Please select a valid date of birth.');
          return;
        }

        if (selectedDate > new Date()) {
          setError('Date of birth cannot be in the future.');
          return;
        }

        birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: authError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (authError) throw authError;
        router.replace('/(tabs)');
      } else {
        const { data, error: authError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                username: cleanUsername,
                date_of_birth: birthDate,
              },
            },
          });

        if (authError) throw authError;

        if (data.session) {
          router.replace('/(tabs)');
        } else {
          setMessage(
            'Account created. Check your email to confirm your account, then sign in.'
          );
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          setAcceptedTerms(false);
        }
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong. Try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: 'login' | 'signup') {
    setMode(nextMode);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setAcceptedTerms(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <View style={styles.brandIconInner} />
            </View>

            <Text style={styles.brandName}>musicboxd</Text>
          </View>
        </View>

        <View style={styles.center}>
          <View style={styles.form}>
            <Text style={styles.heading}>
              {mode === 'login'
                ? 'Welcome back.'
                : 'Create your account.'}
            </Text>

            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in to continue your music journey.'
                : 'Join musicboxd and keep track of your music.'}
            </Text>

            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, mode === 'login' && styles.activeTab]}
                onPress={() => changeMode('login')}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === 'login' && styles.activeTabText,
                  ]}
                >
                  Log in
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tab, mode === 'signup' && styles.activeTab]}
                onPress={() => changeMode('signup')}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === 'signup' && styles.activeTabText,
                  ]}
                >
                  Sign up
                </Text>
              </Pressable>
            </View>

            {mode === 'signup' && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>USERNAME *</Text>

                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Choose a username"
                    placeholderTextColor="#74818c"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>
                    DATE OF BIRTH (OPTIONAL)
                  </Text>

                  <View style={styles.dateRow}>
                    <View style={styles.dateColumn}>
                      <Text style={styles.smallLabel}>DAY</Text>

                      <View style={styles.pickerBox}>
                        {Platform.OS === 'web'
                          ? createElement(
                              'select' as any,
                              {
                                value: birthDay,
                                disabled: loading,
                                onChange: (event: any) =>
                                  setBirthDay(event.target.value),
                                style: webSelectStyle,
                              },
                              createElement(
                                'option' as any,
                                { value: '' },
                                'Day'
                              ),
                              ...Array.from(
                                { length: daysInMonth },
                                (_, i) =>
                                  createElement(
                                    'option' as any,
                                    {
                                      key: i + 1,
                                      value: String(i + 1),
                                    },
                                    String(i + 1)
                                  )
                              )
                            )
                          : (
                              <Picker
                                selectedValue={birthDay}
                                onValueChange={setBirthDay}
                                enabled={!loading}
                                style={styles.picker}
                                dropdownIconColor="#f4f6f8"
                              >
                                <Picker.Item label="Day" value="" />
                                {Array.from(
                                  { length: daysInMonth },
                                  (_, i) => (
                                    <Picker.Item
                                      key={i + 1}
                                      label={String(i + 1)}
                                      value={String(i + 1)}
                                    />
                                  )
                                )}
                              </Picker>
                            )}
                      </View>
                    </View>

                    <View style={styles.dateColumn}>
                      <Text style={styles.smallLabel}>MONTH</Text>

                      <View style={styles.pickerBox}>
                        {Platform.OS === 'web'
                          ? createElement(
                              'select' as any,
                              {
                                value: birthMonth,
                                disabled: loading,
                                onChange: (event: any) => {
                                  const value = event.target.value;
                                  setBirthMonth(value);

                                  if (
                                    birthDay &&
                                    birthYear &&
                                    Number(birthDay) >
                                      new Date(
                                        Number(birthYear),
                                        Number(value),
                                        0
                                      ).getDate()
                                  ) {
                                    setBirthDay('');
                                  }
                                },
                                style: webSelectStyle,
                              },
                              createElement(
                                'option' as any,
                                { value: '' },
                                'Month'
                              ),
                              ...months.map((month, i) =>
                                createElement(
                                  'option' as any,
                                  {
                                    key: month,
                                    value: String(i + 1),
                                  },
                                  month
                                )
                              )
                            )
                          : (
                              <Picker
                                selectedValue={birthMonth}
                                onValueChange={(value) => {
                                  setBirthMonth(value);

                                  if (
                                    birthDay &&
                                    birthYear &&
                                    Number(birthDay) >
                                      new Date(
                                        Number(birthYear),
                                        Number(value),
                                        0
                                      ).getDate()
                                  ) {
                                    setBirthDay('');
                                  }
                                }}
                                enabled={!loading}
                                style={styles.picker}
                                dropdownIconColor="#f4f6f8"
                              >
                                <Picker.Item label="Month" value="" />
                                {months.map((month, i) => (
                                  <Picker.Item
                                    key={month}
                                    label={month}
                                    value={String(i + 1)}
                                  />
                                ))}
                              </Picker>
                            )}
                      </View>
                    </View>

                    <View style={styles.dateColumn}>
                      <Text style={styles.smallLabel}>YEAR</Text>

                      <View style={styles.pickerBox}>
                        {Platform.OS === 'web'
                          ? createElement(
                              'select' as any,
                              {
                                value: birthYear,
                                disabled: loading,
                                onChange: (event: any) => {
                                  const value = event.target.value;
                                  setBirthYear(value);

                                  if (
                                    birthDay &&
                                    birthMonth &&
                                    Number(birthDay) >
                                      new Date(
                                        Number(value),
                                        Number(birthMonth),
                                        0
                                      ).getDate()
                                  ) {
                                    setBirthDay('');
                                  }
                                },
                                style: webSelectStyle,
                              },
                              createElement(
                                'option' as any,
                                { value: '' },
                                'Year'
                              ),
                              ...Array.from(
                                { length: currentYear - 1899 },
                                (_, i) => currentYear - i
                              ).map((year) =>
                                createElement(
                                  'option' as any,
                                  {
                                    key: year,
                                    value: String(year),
                                  },
                                  String(year)
                                )
                              )
                            )
                          : (
                              <Picker
                                selectedValue={birthYear}
                                onValueChange={(value) => {
                                  setBirthYear(value);

                                  if (
                                    birthDay &&
                                    birthMonth &&
                                    Number(birthDay) >
                                      new Date(
                                        Number(value),
                                        Number(birthMonth),
                                        0
                                      ).getDate()
                                  ) {
                                    setBirthDay('');
                                  }
                                }}
                                enabled={!loading}
                                style={styles.picker}
                                dropdownIconColor="#f4f6f8"
                              >
                                <Picker.Item label="Year" value="" />
                                {Array.from(
                                  { length: currentYear - 1899 },
                                  (_, i) => currentYear - i
                                ).map((year) => (
                                  <Picker.Item
                                    key={year}
                                    label={String(year)}
                                    value={String(year)}
                                  />
                                ))}
                              </Picker>
                            )}
                      </View>
                    </View>
                  </View>
                </View>
              </>
            )}

            <View style={styles.field}>
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
                autoComplete="email"
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#74818c"
                secureTextEntry
                autoCapitalize="none"
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
                editable={!loading}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
            </View>

            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>

                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Enter your password again"
                  placeholderTextColor="#74818c"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!loading}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="go"
                />
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.termsRow}>
                <Pressable
                  onPress={() =>
                    setAcceptedTerms(previous => !previous)
                  }
                  disabled={loading}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  style={[
                    styles.checkbox,
                    acceptedTerms && styles.checkboxChecked,
                  ]}
                >
                  {acceptedTerms && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </Pressable>

                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={openTerms}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={openPrivacy}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            )}

            {mode === 'login' && (
              <Pressable
                onPress={() => router.push('/forgot-password')}
                style={styles.forgotButton}
              >
                <Text style={styles.forgotText}>
                  Forgot password?
                </Text>
              </Pressable>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!message && <Text style={styles.message}>{message}</Text>}

            <Pressable
              style={[styles.submitButton, loading && styles.disabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </Text>
              )}
            </Pressable>

            <Text style={styles.note}>
              Spotify connection is separate and can be completed after you
              sign in.
            </Text>


          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            YOUR MUSIC. YOUR WORLD.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const webSelectStyle = {
  width: '100%',
  height: '46px',
  padding: '0 8px',
  backgroundColor: '#1d2329',
  color: '#f4f6f8',
  border: 'none',
  outline: 'none',
  fontSize: '13px',
  colorScheme: 'dark',
} as any;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14181c',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 28 : 52,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  topBar: {
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#2b323a',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 25,
    height: 25,
    borderRadius: 6,
    backgroundColor: '#527da9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  brandName: {
    color: '#f0f2f4',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  center: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 38,
  },
  form: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
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
    marginTop: 8,
    marginBottom: 30,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#343d46',
    marginBottom: 26,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#729bc5',
  },
  tabText: {
    color: '#9ca8b3',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#f5f6f7',
    fontWeight: '700',
  },
  field: {
    marginBottom: 20,
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
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateColumn: {
    flex: 1,
    minWidth: 0,
  },
  smallLabel: {
    color: '#9ca8b3',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
  },
  pickerBox: {
    height: 48,
    backgroundColor: '#1d2329',
    borderWidth: 1,
    borderColor: '#414d58',
    borderRadius: 5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    color: '#f4f6f8',
    height: 48,
    width: '100%',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderWidth: 1,
    borderColor: '#74818c',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#527da9',
    borderColor: '#527da9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    color: '#9ca8b3',
    fontSize: 12,
    lineHeight: 19,
  },
  termsLink: {
    color: '#729bc5',
    textDecorationLine: 'underline',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -9,
    marginBottom: 18,
  },
  forgotText: {
    color: '#729bc5',
    fontSize: 13,
  },
  submitButton: {
    height: 47,
    marginTop: 7,
    borderRadius: 5,
    backgroundColor: '#527da9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  error: {
    color: '#ff8585',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  message: {
    color: '#9ed9b0',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  note: {
    color: '#74818c',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2b323a',
  },
  footerText: {
    color: '#74818c',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  testButton: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#527da9',
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  testButtonText: {
    color: '#729bc5',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
