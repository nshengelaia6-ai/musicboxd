
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { removeDeletedSpotifyAccountData } from '../utils/accountStorage';
import { clearSpotifySession } from '../utils/spotify';
import { supabase } from '../utils/supabase';

export default function PrivacySettings() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; username: string }[]>([]);
  const [blockedUsersLoading, setBlockedUsersLoading] = useState(true);
  const [blockedUsersError, setBlockedUsersError] = useState('');
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadBlockedUsers = async () => {
    setBlockedUsersLoading(true);
    setBlockedUsersError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user?.id) throw new Error('Please sign in again.');

      const { data: blocks, error: blocksError } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', authData.user.id);
      if (blocksError) throw blocksError;

      const ids = [...new Set((blocks || []).map((item: { blocked_id: string }) => item.blocked_id).filter(Boolean))];
      if (ids.length === 0) {
        setBlockedUsers([]);
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username')
        .in('id', ids);
      if (usersError) throw usersError;

      setBlockedUsers(ids.map(id => {
        const user = (users || []).find((item: { id: string; username: string | null }) => item.id === id);
        return { id, username: user?.username || 'User' };
      }));
    } catch (error: any) {
      setBlockedUsersError(error?.message || 'Could not load blocked users.');
    } finally {
      setBlockedUsersLoading(false);
    }
  };

  async function unblockUser(userId: string) {
    setUnblockingId(userId);
    setBlockedUsersError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user?.id) throw new Error('Please sign in again.');

      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', authData.user.id)
        .eq('blocked_id', userId);
      if (error) throw error;

      setBlockedUsers(previous => previous.filter(user => user.id !== userId));
    } catch (error: any) {
      setBlockedUsersError(error?.message || 'Could not unblock this user.');
    } finally {
      setUnblockingId(null);
    }
  }

  function confirmUnblock(user: { id: string; username: string }) {
    const message = `Unblock ${user.username}? This will not restore the follow automatically.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void unblockUser(user.id);
      return;
    }
    Alert.alert('Unblock user', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => { void unblockUser(user.id); } },
    ]);
  }

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setEmail(data.user.email);
      }
    }
    loadUser();
    void loadBlockedUsers();
  }, []);

  async function changePassword() {
    setMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setMessage('Password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (loginError) {
        setMessage('Current password is incorrect.');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setMessage('Password changed successfully.');
    } catch {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function changeEmail() {
    setMessage('');

    const cleanEmail = newEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMessage('Please enter a valid email address.');
      return;
    }

    if (cleanEmail === email.toLowerCase()) {
      setMessage('This is already your current email.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: cleanEmail,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setNewEmail('');
      setShowEmailForm(false);
      setMessage('Email change requested. Check your inbox and follow the confirmation instructions. Your email may remain unchanged until confirmation is complete.');
    } catch {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function confirmDeleteAccount() {
    setMessage('');

    if (!deletePassword) {
      setMessage('Please enter your password.');
      return;
    }

    if (loading) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to permanently delete this account? This action cannot be undone.'
      );

      if (confirmed) {
        deleteAccount();
      }

      return;
    }

    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete this account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: deleteAccount,
        },
      ]
    );
  }

  function finishDeletion(localCleanupFailed: boolean) {
    const successMessage = localCleanupFailed
      ? 'Your account was deleted, but some local data could not be cleared. Please restart the app.'
      : 'Your account has been permanently deleted.';

    if (Platform.OS === 'web') {
      window.alert('Account deleted. ' + successMessage);

      router.replace('/auth' as any);
      return;
    }

    Alert.alert(
      'Account deleted',
      successMessage,
      [
        {
          text: 'OK',
          onPress: () => router.replace('/auth' as any),
        },
      ]
    );
  }

  async function deleteAccount() {
    if (loading) return;

    setLoading(true);
    setMessage('');

    try {
      // Verify the currently signed-in account.
      const { data: currentData, error: currentUserError } =
        await supabase.auth.getUser();

      if (
        currentUserError ||
        !currentData.user?.id ||
        !currentData.user.email
      ) {
        setMessage('Could not verify your account. Please log in again.');
        return;
      }

      const userId = currentData.user.id;
      const userEmail = currentData.user.email;

      // Re-authenticate with the current account password.
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: userEmail,
          password: deletePassword,
        });

      if (loginError || loginData.user?.id !== userId) {
        setMessage('Incorrect password. Account was not deleted.');
        return;
      }

      // The Edge Function identifies the account using its verified JWT.
      const { data, error: invokeError } =
        await supabase.functions.invoke('delete-account');

      if (invokeError) {
        setMessage(
          invokeError.message || 'Could not delete account. Please try again.'
        );
        return;
      }

      if (!data?.success) {
        setMessage(
          data?.error || 'Account deletion failed. Please try again.'
        );
        return;
      }

      // Clear only this account's local data.
      let localCleanupFailed = false;

      try {
        await removeDeletedSpotifyAccountData(userId);
      } catch (cleanupError) {
        console.error('Local account cleanup failed:', cleanupError);
        localCleanupFailed = true;
      }

      // Sign out locally.
      const { error: signOutError } =
        await supabase.auth.signOut({ scope: 'local' });

      if (signOutError) {
        console.error('Local sign out error:', signOutError);
      }

      setDeletePassword('');

      // Show success and navigate to Login.
      finishDeletion(localCleanupFailed);

    } catch (error) {
      console.error('Delete account error:', error);
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function logOut() {
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setMessage(error.message);
        return;
      }

      await clearSpotifySession();
      router.replace('/auth' as any);
    } catch {
      setMessage('Could not log out. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Privacy & Settings</Text>
      <Text style={styles.subtitle}>
        Manage your privacy and account.
      </Text>

      {message ? (
        <Text
          style={[
            styles.message,
            message === 'Password changed successfully.' &&
              styles.successMessage,
          ]}
        >
          {message}
        </Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.heading}>Account & Security</Text>

        <Text style={styles.label}>Current email</Text>
        <Text style={styles.value}>{email || 'Loading...'}</Text>

        <TouchableOpacity
          style={styles.option}
          onPress={() => {
            setMessage('');
            setShowEmailForm(!showEmailForm);
            setShowPasswordForm(false);
            setShowDeleteForm(false);
          }}
        >
          <Text style={styles.optionText}>Change Email</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {showEmailForm && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="New email address"
              placeholderTextColor="#777"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TouchableOpacity
              style={styles.actionButton}
              onPress={changeEmail}
              disabled={loading}
            >
              <Text style={styles.actionText}>Update Email</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.option}
          onPress={() => {
            setMessage('');
            setShowPasswordForm(!showPasswordForm);
            setShowEmailForm(false);
            setShowDeleteForm(false);
          }}
        >
          <Text style={styles.optionText}>Change Password</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {showPasswordForm && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor="#777"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#777"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#777"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={styles.actionButton}
              onPress={changePassword}
              disabled={loading}
            >
              <Text style={styles.actionText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Blocked Users</Text>
        <Text style={styles.description}>
          People you block cannot follow you or interact with you through Musicboxd. Unblocking does not restore previous follows.
        </Text>

        {blockedUsersLoading ? (
          <ActivityIndicator color="#1DB954" style={{ marginTop: 16 }} />
        ) : blockedUsersError ? (
          <Text accessibilityRole="alert" style={styles.description}>{blockedUsersError}</Text>
        ) : blockedUsers.length === 0 ? (
          <Text style={styles.description}>You have not blocked anyone.</Text>
        ) : (
          blockedUsers.map(user => (
            <View key={user.id} style={styles.blockedUserRow}>
              <Text style={styles.optionText}>{user.username}</Text>
              <TouchableOpacity
                style={styles.unblockButton}
                onPress={() => confirmUnblock(user)}
                disabled={unblockingId === user.id}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${user.username}`}
              >
                {unblockingId === user.id ? (
                  <ActivityIndicator color="#111111" size="small" />
                ) : (
                  <Text style={styles.unblockButtonText}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Privacy</Text>
        <Text style={styles.description}>
          Review how Musicboxd handles profile information, activity, and connected services.
        </Text>
        <TouchableOpacity
          style={styles.option}
          onPress={() => router.push('/privacy' as any)}
        >
          <Text style={styles.optionText}>Read Privacy Policy</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Delete Account</Text>

        <Text style={styles.description}>
          Permanently delete your account and its associated Musicboxd data.
          This action cannot be undone.
        </Text>

        <TouchableOpacity
          style={styles.deleteOption}
          onPress={() => {
            setMessage('');
            setShowDeleteForm(!showDeleteForm);
            setShowEmailForm(false);
            setShowPasswordForm(false);
          }}
          disabled={loading}
        >
          <Text style={styles.deleteText}>Delete Account</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {showDeleteForm && (
          <View style={styles.form}>
            <Text style={styles.description}>
              Enter your current password to continue.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor="#777"
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={confirmDeleteAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>
                  Permanently Delete Account
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logOut}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.logoutText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Musicboxd</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 50,
  },
  back: {
    color: '#FFFFFF',
    fontSize: 17,
    marginBottom: 35,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#999999',
    fontSize: 14,
    marginTop: 10,
  },
  section: {
    marginTop: 25,
    padding: 20,
    backgroundColor: '#191919',
    borderRadius: 14,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 18,
  },
  label: {
    color: '#888888',
    fontSize: 12,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 12,
  },
  option: {
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: '#303030',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    color: '#EEEEEE',
    fontSize: 15,
  },
  blockedUserRow: {
    minHeight: 54,
    borderTopWidth: 1,
    borderTopColor: '#303030',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  unblockButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  unblockButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '600',
  },
  arrow: {
    color: '#888888',
    fontSize: 24,
  },
  form: {
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    backgroundColor: '#252525',
    borderRadius: 9,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 9,
    alignItems: 'center',
  },
  actionText: {
    color: '#111111',
    fontWeight: '600',
  },
  description: {
    color: '#999999',
    fontSize: 14,
  },
  message: {
    color: '#D6D6D6',
    backgroundColor: '#222222',
    padding: 12,
    borderRadius: 9,
    marginTop: 20,
  },
  successMessage: {
    color: '#4ADE80',
    backgroundColor: '#14291D',
  },
  deleteOption: {
    minHeight: 48,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#303030',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteText: {
    color: '#FF6B6B',
    fontSize: 15,
  },
  deleteButton: {
    backgroundColor: '#B42323',
    padding: 14,
    borderRadius: 9,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  logoutButton: {
    alignItems: 'center',
    padding: 12,
  },
  logoutText: {
    color: '#FF6B6B',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    color: '#555555',
    textAlign: 'center',
    marginTop: 30,
  },
});
