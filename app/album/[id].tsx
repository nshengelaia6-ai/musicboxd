async function loadAlbum() {
  const token = await AsyncStorage.getItem('spotify_token');
  if (!token) return;
  const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  setAlbum(data);
  setTracks(data.tracks?.items || []);

  // შენახული state-ების წაკითხვა
  const listenedData = await AsyncStorage.getItem('listened');
  const listenedList = listenedData ? JSON.parse(listenedData) : [];
  setListened(!!listenedList.find((i: any) => i.id === data.id));

  const wantData = await AsyncStorage.getItem('wantToListen');
  const wantList = wantData ? JSON.parse(wantData) : [];
  setWantToListen(!!wantList.find((i: any) => i.id === data.id));

  const likedData = await AsyncStorage.getItem('liked');
  const likedList = likedData ? JSON.parse(likedData) : [];
  setLiked(!!likedList.find((i: any) => i.id === data.id));
}
