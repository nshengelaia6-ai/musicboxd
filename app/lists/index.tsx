import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Lists() {
  const router = useRouter();
  const [lists, setLists] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    loadLists();
  }, []);

  async function loadLists() {
    const data = await AsyncStorage.getItem('lists');
    if (data) setLists(JSON.parse(data));
  }

  async function createList() {
    if (!name.trim()) return;
    const newList = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
      isPublic,
      albums: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [newList, ...lists];
    setLists(updated);
    await AsyncStorage.setItem('lists', JSON.stringify(updated));
    setName('');
    setDescription('');
    setIsPublic(true);
    setShowCreate(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lists</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Text style={styles.plus}>+</Text>
        </TouchableOpacity>
      </View>

      {lists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No lists yet</Text>
          <Text style={styles.emptySubtext}>Create your first list</Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.listCard}>
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.listDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text style={styles.listMeta}>
                  {item.albums?.length || 0} albums • {item.isPublic ? '🌐 Public' : '🔒 Private'}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreate} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New List</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="List name..."
              placeholderTextColor="#555"
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="What's this list about?"
              placeholderTextColor="#555"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.label}>Privacy</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, isPublic && styles.toggleActive]}
                onPress={() => setIsPublic(true)}
              >
                <Text style={[styles.toggleText, isPublic && styles.toggleTextActive]}>🌐 Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !isPublic && styles.toggleActive]}
                onPress={() => setIsPublic(false)}
              >
                <Text style={[styles.toggleText, !isPublic && styles.toggleTextActive]}>🔒 Private</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.createBtn, !name.trim() && { opacity: 0.4 }]}
              onPress={createList}
              disabled={!name.trim()}
            >
              <Text style={styles.createBtnText}>Create List</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  back: { color: '#fff', fontSize: 32, lineHeight: 36 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  plus: { color: '#1DB954', fontSize: 32, lineHeight: 36 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 8 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: 12, padding: 16, marginBottom: 12 },
  listInfo: { flex: 1 },
  listName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listDesc: { color: '#888', fontSize: 13, marginTop: 4 },
  listMeta: { color: '#555', fontSize: 12, marginTop: 6 },
  arrow: { color: '#555', fontSize: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#1c1c1c', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 44 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: '#888', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15 },
  toggleRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2a2a2a', alignItems: 'center' },
  toggleActive: { backgroundColor: '#1DB954' },
  toggleText: { color: '#888', fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#000' },
  createBtn: { backgroundColor: '#1DB954', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  createBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
