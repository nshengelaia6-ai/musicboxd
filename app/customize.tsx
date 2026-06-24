import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ACCENT_OPTIONS, BACKGROUND_OPTIONS, useAppTheme } from '@/context/ThemeContext';

export default function CustomizeScreen() {
  const router = useRouter();
  const { backgroundColor, accentColor, setBackgroundColor, setAccentColor } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customize</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.sectionLabel}>Background Color</Text>
        <View style={styles.swatchRow}>
          {BACKGROUND_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.swatch,
                { backgroundColor: c },
                backgroundColor === c && { borderColor: accentColor, borderWidth: 3 },
              ]}
              onPress={() => setBackgroundColor(c)}
            />
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Accent Color</Text>
        <View style={styles.swatchRow}>
          {ACCENT_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.swatch,
                { backgroundColor: c },
                accentColor === c && { borderColor: '#fff', borderWidth: 3 },
              ]}
              onPress={() => setAccentColor(c)}
            />
          ))}
        </View>

        <View style={[styles.previewCard, { borderColor: accentColor }]}>
          <Text style={[styles.previewTitle, { color: accentColor }]}>★★★☆☆</Text>
          <Text style={styles.previewText}>ასე გამოიყურება შენი აპი</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { marginRight: 12 },
  backText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sectionLabel: { color: '#aaa', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  swatch: { width: 48, height: 48, borderRadius: 24 },
  previewCard: { marginTop: 36, borderWidth: 1, borderRadius: 12, padding: 20, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  previewTitle: { fontSize: 22, marginBottom: 6 },
  previewText: { color: '#ccc', fontSize: 14 },
});
