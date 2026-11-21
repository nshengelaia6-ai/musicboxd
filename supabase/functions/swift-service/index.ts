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
    const userId = user.id;

    async function usersAreBlocked(firstUserId: string, secondUserId: string) {
      const { data, error } = await supabase.from("blocked_users")
        .select("blocker_id, blocked_id")
        .or(`and(blocker_id.eq.${firstUserId},blocked_id.eq.${secondUserId}),and(blocker_id.eq.${secondUserId},blocked_id.eq.${firstUserId})`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }

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
      try {
        if (await usersAreBlocked(share.user_id, share.recipient_id)) {
          return respond({ error: "This interaction is unavailable because one participant has blocked the other" }, 403);
        }
      } catch (blockError) {
        console.error("Could not verify block status:", blockError);
        return respond({ error: "Could not verify participant permissions" }, 500);
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

    if (body.action === "track-members") {
      const itemId = typeof body.item_id === "string" ? body.item_id.trim() : "";
      const relationship = ["liked", "listened", "wants_to_listen", "member"].includes(body.relationship) ? body.relationship : "listened";
      if (!itemId || itemId.length > 200) return respond({ error: "Invalid track ID" }, 400);

      const blockedResult = await supabase.from("blocked_users")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
      if (blockedResult.error) return respond({ error: "Could not verify block settings" }, 500);
      const blockedIds = new Set((blockedResult.data || []).map((row: any) =>
        row.blocker_id === userId ? row.blocked_id : row.blocker_id
      ));

      const rows: any[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase.from("user_activity")
          .select("user_id,activity_type,created_at")
          .eq("item_key", itemId)
          .in("activity_type", ["listened", "liked", "wants_to_listen"])
          .order("created_at", { ascending: false })
          .range(from, from + 499);
        if (error) return respond({ error: "Could not load listener activity" }, 500);
        rows.push(...(data || []));
        if (!data || data.length < 500) break;
      }

      const latestByUser: Record<string, any> = {};
      for (const row of rows) {
        if (!latestByUser[row.user_id]) latestByUser[row.user_id] = {};
        if (!latestByUser[row.user_id][row.activity_type]) latestByUser[row.user_id][row.activity_type] = row;
      }
      let selectedIds = Object.keys(latestByUser).filter((id) =>
        !blockedIds.has(id) &&
        (relationship === "member"
          ? Boolean(latestByUser[id].liked || latestByUser[id].listened || latestByUser[id].wants_to_listen)
          : Boolean(latestByUser[id][relationship]))
      );

      if (body.scope === "friends") {
        const [following, followers] = await Promise.all([
          supabase.from("friendships").select("friend_id").eq("user_id", userId),
          supabase.from("friendships").select("user_id").eq("friend_id", userId),
        ]);
        if (following.error || followers.error) return respond({ error: "Could not load friends" }, 500);
        const followingIds = new Set((following.data || []).map((row: any) => String(row.friend_id)));
        const mutualIds = new Set((followers.data || []).map((row: any) => String(row.user_id)).filter((id: string) => followingIds.has(id)));
        selectedIds = selectedIds.filter((id) => mutualIds.has(id));
      }

      const latestMemberActivityTime = (entry: Record<string, any>) => {
        const activities = relationship === "member"
          ? [entry.liked, entry.listened, entry.wants_to_listen].filter(Boolean)
          : [entry[relationship]].filter(Boolean);
        return Math.max(0, ...activities.map((activity: any) => new Date(activity.created_at).getTime()));
      };
      selectedIds.sort((a, b) =>
        latestMemberActivityTime(latestByUser[b]) - latestMemberActivityTime(latestByUser[a])
      );
      const people: any[] = [];
      for (let i = 0; i < selectedIds.length; i += 500) {
        const { data, error } = await supabase.from("users")
          .select("id,username,avatar_url").in("id", selectedIds.slice(i, i + 500));
        if (error) return respond({ error: "Could not load member profiles" }, 500);
        people.push(...(data || []));
      }
      const reviewRows: any[] = [];
      for (let i = 0; i < selectedIds.length; i += 500) {
        const { data, error } = await supabase.from("music_reviews")
          .select("user_id,rating,review_text").eq("item_type", "track").eq("item_id", itemId)
          .in("user_id", selectedIds.slice(i, i + 500));
        if (error) return respond({ error: "Could not load member reviews" }, 500);
        reviewRows.push(...(data || []));
      }
      const profileMap = new Map(people.map((person: any) => [person.id, person]));
      const reviewMap = new Map(reviewRows.map((review: any) => [review.user_id, review]));
      const members = selectedIds.flatMap((id) => {
        const person: any = profileMap.get(id);
        if (!person) return [];
        const review: any = reviewMap.get(id);
        return [{
          id,
          username: person.username || null,
          avatar_url: person.avatar_url || null,
          rating: review && Number(review.rating) > 0 ? Number(review.rating) : null,
          liked: Boolean(latestByUser[id].liked),
          has_review: Boolean(review && String(review.review_text || "").trim()),
        }];
      });
      return respond({ success: true, relationship, members, total: members.length });
    }

    if (body.action === "inbox") {
      // Fetch every page; do not silently truncate the inbox/history at 100.
      async function fetchAll(field: "recipient_id" | "user_id") {
        const all: any[] = [];
        for (let from = 0; ; from += 500) {
          const { data, error } = await supabase.from("shared_songs")
            .select("id, user_id, recipient_id, item_type, item_id, album_id, item_name, artist_name, cover_url, message, created_at")
            .eq(field, userId).order("created_at", { ascending: false })
            .range(from, from + 499);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < 500) break;
        }
        return all;
      }

      const [rows, sentRows] = await Promise.all([fetchAll("recipient_id"), fetchAll("user_id")]);
      const { data: blockRows, error: blockLookupError } = await supabase
        .from("blocked_users")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
      if (blockLookupError) return respond({ error: "Could not verify block settings" }, 500);
      const blockedIds = new Set((blockRows || []).map((row) =>
        row.blocker_id === user.id ? row.blocked_id : row.blocker_id
      ));
      const visibleRows = rows.filter((row) => !blockedIds.has(row.user_id));
      const visibleSentRows = sentRows.filter((row) => !blockedIds.has(row.recipient_id));
      const allRows = [...visibleRows, ...visibleSentRows];
      const shareIds = [...new Set(allRows.map((r) => r.id))];
      const participantIds = [...new Set([
        user.id,
        ...visibleRows.map((r) => r.user_id),
        ...visibleSentRows.map((r) => r.recipient_id),
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
      return respond({ success: true, items: visibleRows.map((r) => mapItem(r, false)), sentItems: visibleSentRows.map((r) => mapItem(r, true)) });
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
    try {
      if (await usersAreBlocked(user.id, recipient.id)) {
        return respond({ error: "You cannot share music with a user involved in a block" }, 403);
      }
    } catch (blockError) {
      console.error("Could not verify block status:", blockError);
      return respond({ error: "Could not verify recipient permissions" }, 500);
    }

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
