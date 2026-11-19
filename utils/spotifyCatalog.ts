import { supabase } from '@/utils/supabase';

export async function getSpotifyTrack(trackId: string) {
  if (!trackId) throw new Error('Track ID is missing.');

  const { data, error } = await supabase.functions.invoke('spotify-search', {
    body: { action: 'track', id: trackId },
  });

  if (error) throw error;
  if (!data || data.error) {
    throw new Error(data?.error || 'Could not load track details.');
  }

  return data;
}
