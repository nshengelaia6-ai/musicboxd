import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const tabs = ['Friends', 'You', 'Incoming'];

const data = {
  Friends: [
    { id: '1', user: 'ana', action: 'rated', song: 'Blinding Lights', rating: '5', time: '2m ago' },
    { id: '2', user: 'giorgi', action: 'reviewed', song: 'Bad Guy', rating: '4', time: '1h ago' },
    { id: '3', user: 'nino', action: 'rated', song: 'Levitating', rating: '3', time: '3h ago' },
  ],
  You: [
    { id: '1', user: 'you', action: 'rated', song: 'Starboy', rating: '5', time: '1d ago' },
    { id: '2', user: 'you', action: 'reviewed', song: 'Save Your Tears', rating: '4', time: '2d ago' },
  ],
  Incoming: [
    { id: '1', user: 'ana', action: 'liked your review of', song: 'Blinding Lights', rating: '', time: '5m ago' },
    { id: '2', user: 'giorgi', action: 'followed you', song: '', rating: '', time: '2h ago' },
  ],
};

export default function Activity() {
  const [activeTab, setActiveTab] = useState('Friends');

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Activity</Text>
      <View style={styles.tabs}>
        {tabs.map(tab => (
          <Pressable key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTab]}>{tab}</Text>
            {activeTab === tab && <View style={styles.underline} />}
          </Pressable>
        ))}
      </View>
      <ScrollView>
        {data[activeTab].map(item => (
          <View key={item.id} style={styles.row}>
            <View style={styles.avatar} />
            <View style={styles.info}>
              <Text style={styles.text}>
                <Text style={styles.username}>{item.user}</Text>
                {' '}{item.action}{' '}
                <Text style={styles.song}>{item.song}</Text>
                {item.rating ? <Text style={styles.rating}> ⭐{item.rating}</Text> : null}
              </Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 60 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff', paddingHorizontal: 20, marginBottom: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  tabBtn: { marginRight: 24, alignItems: 'center' },
  tabText: { color: '#555', fontSize: 16, fontWeight: '600', paddingBottom: 4 },
  activeTab: { color: '#fff' },
  underline: { height: 2, backgroundColor: '#00b4d8', width: '100%' },
  row: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 12 },
  info: { flex: 1 },
  text: { color: '#ccc', fontSize: 14 },
  username: { color: '#fff', fontWeight: 'bold' },
  song: { color: '#00b4d8' },
  rating: { color: '#f4c430' },
  time: { color: '#555', fontSize: 12, marginTop: 4 },
});
