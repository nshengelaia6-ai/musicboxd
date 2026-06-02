import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function Home() {
  const router = useRouter();

  const songs = [
    { id: "1", title: "Blinding Lights" },
    { id: "2", title: "Starboy" },
  ];

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>🎵 MusicBoxd</Text>

      {songs.map((song) => (
        <Pressable
          key={song.id}
          onPress={() => router.push(`/song/${song.id}`)}
          style={{
            padding: 15,
            marginBottom: 10,
            backgroundColor: "#eee",
            borderRadius: 10,
          }}
        >
          <Text>{song.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}