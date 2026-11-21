
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getSpotifyToken() {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are missing.");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description || "Could not get Spotify access token."
    );
  }

  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();

    const action = body.action || "search";
    const query = body.query;
    const type = body.type || "track,artist,album";
    const id = body.id;

    const token = await getSpotifyToken();

    let endpoint = "";

    // SEARCH
    if (action === "search") {
      if (!query) {
        throw new Error("Search query is missing.");
      }

     const params = new URLSearchParams({
  q: query,
  type,
  limit: "10",
});

      endpoint = `https://api.spotify.com/v1/search?${params.toString()}`;
    }

    // ARTIST DETAILS
    else if (action === "artist") {
      if (!id) {
        throw new Error("Artist ID is missing.");
      }

      endpoint = `https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`;
    }

    // ARTIST ALBUMS
    else if (action === "artist-albums") {
      if (!id) {
        throw new Error("Artist ID is missing.");
      }

      const params = new URLSearchParams({
        limit: "10",
        include_groups: "album,single",
      });

      endpoint =
        `https://api.spotify.com/v1/artists/${encodeURIComponent(id)}/albums?${params.toString()}`;
    }

    // ALBUM DETAILS AND TRACKS
    else if (action === "album") {
      if (!id) {
        throw new Error("Album ID is missing.");
      }

      endpoint =
        `https://api.spotify.com/v1/albums/${encodeURIComponent(id)}`;
    }

    // TRACK DETAILS
    else if (action === "track") {
      if (!id) {
        throw new Error("Track ID is missing.");
      }

      endpoint =
        `https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`;
    }

    else {
      throw new Error("Invalid action.");
    }

    const spotifyResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await spotifyResponse.json();

    if (action === "album" && spotifyResponse.ok) {
      const tracksUrl = new URL(
        `https://api.spotify.com/v1/albums/${encodeURIComponent(id)}/tracks`
      );
      tracksUrl.searchParams.set("limit", "50");

      const allTracks: unknown[] = [];
      let nextUrl: string | null = tracksUrl.toString();
      let totalTracks = 0;
      let pages = 0;

      while (nextUrl && pages < 5) {
        const tracksResponse = await fetch(nextUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const tracksPage = await tracksResponse.json();
        if (!tracksResponse.ok) {
          throw new Error(
            tracksPage.error?.message || "Could not load the album tracklist."
          );
        }

        allTracks.push(...(Array.isArray(tracksPage.items) ? tracksPage.items : []));
        totalTracks = Number(tracksPage.total) || allTracks.length;
        nextUrl = tracksPage.next || null;
        pages += 1;
        if (allTracks.length >= totalTracks) break;
      }

      data.tracks = {
        ...(data.tracks || {}),
        items: allTracks,
        total: totalTracks || allTracks.length,
        limit: 50,
        offset: 0,
        next: null,
      };
    }

    if (!spotifyResponse.ok) {
      console.error("Spotify API error:", data);

      return new Response(
        JSON.stringify({
          error:
            data.error?.message ||
            "Spotify API request failed.",
          status: spotifyResponse.status,
        }),
        {
          status: spotifyResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Function error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
