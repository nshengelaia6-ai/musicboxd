import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const accessToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!accessToken) return respond({ error: "Supabase session required" }, 401);

    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return respond({ error: "Server configuration missing" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) return respond({ error: "Invalid or expired session" }, 401);

    const { data: user, error: userError } = await supabase
      .from("users").select("id, username, avatar_url")
      .eq("id", authData.user.id).maybeSingle();
    if (userError || !user) return respond({ error: "User profile not found in the app" }, 403);

    // All interaction actions first verify that the caller is a sender or recipient.
    if (body.action === "like" || body.action === "reply") {
      const shareId = String(body.share_id || "");
      if (!shareId) return respond({ error: "Shared item is required" }, 400);
      const { data: share, error: shareError } = await supabase
        .from("shared_songs").select("id, user_id, recipient_id")
        .eq("id", shareId).maybeSingle();
      if (shareError || !share) return respond({ error: "Shared item not found" }, 404);
      if (share.user_id !== user.id && share.recipient_id !== user.id) {
        return respond({ error: "You cannot interact with this shared item" }, 403);
      }

      if (body.action === "like") {
        if (body.liked === true) {
          const { error } = await supabase.from("shared_song_likes")
            .upsert({ shared_song_id: share.id, user_id: user.id }, { onConflict: "shared_song_id,user_id" });
          if (error) return respond({ error: "Could not save like" }, 500);
        } else {
          const { error } = await supabase.from("shared_song_likes")
            .delete().eq("shared_song_id", share.id).eq("user_id", user.id);
          if (error) return respond({ error: "Could not remove like" }, 500);
        }
        return respond({ success: true, liked: body.liked === true });
      }

      const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
      if (!message) return respond({ error: "Reply cannot be empty" }, 400);
      const { data: reply, error } = await supabase.from("shared_song_replies")
        .insert({ shared_song_id: share.id, user_id: user.id, message })
        .select("id, message, created_at").single();
      if (error) return respond({ error: "Could not send reply" }, 500);
      return respond({ success: true, reply: { ...reply, username: user.username, avatar: user.avatar_url || "" } });
    }

    if (body.action === "inbox") {
      // Fetch every page; do not silently truncate the inbox/history at 100.
      async function fetchAll(field: "recipient_id" | "user_id") {
        const all: any[] = [];
        for (let from = 0; ; from += 500) {
          const { data, error } = await supabase.from("shared_songs")
            .select("id, user_id, recipient_id, item_type, item_id, album_id, item_name, artist_name, cover_url, message, created_at")
            .eq(field, user.id).order("created_at", { ascending: false })
            .range(from, from + 499);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < 500) break;
        }
        return all;
      }

      const [rows, sentRows] = await Promise.all([fetchAll("recipient_id"), fetchAll("user_id")]);
      const allRows = [...rows, ...sentRows];
      const shareIds = [...new Set(allRows.map((r) => r.id))];
      const participantIds = [...new Set([
        user.id,
        ...rows.map((r) => r.user_id),
        ...sentRows.map((r) => r.recipient_id),
      ])];

      const people: Record<string, any> = {};
      for (let i = 0; i < participantIds.length; i += 500) {
        const { data, error } = await supabase.from("users")
          .select("id, username, avatar_url").in("id", participantIds.slice(i, i + 500));
        if (error) return respond({ error: "Could not load shared music participants" }, 500);
        for (const person of data || []) people[person.id] = person;
      }

      // Fetch interactions in bounded batches/pages so large histories do not
      // silently lose likes or replies at PostgREST's default row limit.
      const likesRows: any[] = [];
      const repliesRows: any[] = [];
      for (let i = 0; i < shareIds.length; i += 200) {
        const batch = shareIds.slice(i, i + 200);
        for (let from = 0; ; from += 500) {
          const { data, error } = await supabase.from("shared_song_likes")
            .select("shared_song_id, user_id").in("shared_song_id", batch)
            .range(from, from + 499);
          if (error) return respond({ error: "Could not load shared music likes" }, 500);
          likesRows.push(...(data || []));
          if (!data || data.length < 500) break;
        }
        for (let from = 0; ; from += 500) {
          const { data, error } = await supabase.from("shared_song_replies")
            .select("id, shared_song_id, user_id, message, created_at")
            .in("shared_song_id", batch).order("created_at", { ascending: true })
            .range(from, from + 499);
          if (error) return respond({ error: "Could not load shared music replies" }, 500);
          repliesRows.push(...(data || []));
          if (!data || data.length < 500) break;
        }
      }

      const likes: Record<string, any[]> = {};
      for (const l of likesRows) (likes[l.shared_song_id] ||= []).push(l);
      const replies: Record<string, any[]> = {};
      for (const r of repliesRows) {
        const author = people[r.user_id];
        (replies[r.shared_song_id] ||= []).push({
          id: r.id, message: r.message, date: r.created_at,
          username: author?.username || "Friend", avatar: author?.avatar_url || "",
          mine: r.user_id === user.id,
        });
      }

      const mapItem = (row: any, sent: boolean) => {
        const other = people[sent ? row.recipient_id : row.user_id];
        return {
          id: `${sent ? "sent" : "remote"}-${row.id}`,
          shareId: row.id,
          itemId: row.item_id,
          albumId: row.album_id || undefined,
          type: row.item_type,
          name: row.item_name,
          artist: row.artist_name || "",
          cover: row.cover_url || "",
          message: row.message || "",
          from: sent ? undefined : other?.username || "Friend",
          username: other?.username || "Friend",
          displayLabel: sent ? `To @${other?.username || "Friend"}` : `@${other?.username || "Friend"}`,
          fromAvatar: other?.avatar_url || "",
          to: sent ? other?.username || "Friend" : undefined,
          date: row.created_at,
          url: `https://open.spotify.com/${row.item_type}/${row.item_id}`,
          liked: (likes[row.id] || []).some((l) => l.user_id === user.id),
          likeCount: (likes[row.id] || []).length,
          replies: replies[row.id] || [],
        };
      };
      return respond({ success: true, items: rows.map((r) => mapItem(r, false)), sentItems: sentRows.map((r) => mapItem(r, true)) });
    }

    const { recipient_id, item_type, item_id, item_name, artist_name, cover_url, message, album_id } = body;
    if (!recipient_id || !["album", "track"].includes(item_type) ||
        typeof item_id !== "string" || !item_id ||
        typeof item_name !== "string" || !item_name) {
      return respond({ error: "Missing or invalid music details" }, 400);
    }

    const { data: recipient, error: recipientError } = await supabase
      .from("users").select("id").eq("id", recipient_id).maybeSingle();
    if (recipientError || !recipient) return respond({ error: "Recipient not found" }, 404);
    if (user.id === recipient.id) return respond({ error: "You cannot send music to yourself" }, 400);

    const { data: friendship, error: friendshipError } = await supabase.from("friendships")
      .select("id")
      .or(`and(user_id.eq.${user.id},friend_id.eq.${recipient.id}),and(user_id.eq.${recipient.id},friend_id.eq.${user.id})`)
      .limit(1).maybeSingle();
    if (friendshipError) return respond({ error: "Could not verify friendship" }, 500);
    if (!friendship) return respond({ error: "You must be friends to share music" }, 403);

    const { data, error } = await supabase.from("shared_songs").insert({
      user_id: user.id, recipient_id: recipient.id, item_type, item_id, item_name,
      album_id: typeof album_id === "string" ? album_id : null,
      artist_name: typeof artist_name === "string" ? artist_name.slice(0, 300) : "",
      cover_url: typeof cover_url === "string" ? cover_url.slice(0, 2000) : "",
      message: typeof message === "string" ? message.slice(0, 500) : "",
    }).select("id").single();
    if (error) {
      console.error("Share insert failed:", error.message);
      return respond({ error: "Could not share music" }, 500);
    }
    return respond({ success: true, share_id: data.id });
  } catch (error) {
    console.error("Share function error:", error);
    return respond({ error: "Unexpected server error" }, 500);
  }
});
