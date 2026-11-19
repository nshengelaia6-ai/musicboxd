
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

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    const accessToken = authorization?.replace(/^Bearer\s+/i, "");

    if (!accessToken) {
      return respond({ error: "Supabase session required" }, 401);
    }

    const body = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Server configuration missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData.user) return respond({ error: "Invalid or expired session" }, 401);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (userError || !user) {
      return respond({ error: "User profile not found in the app" }, 403);
    }

    // Inbox: return only music addressed to the authenticated Spotify user.
    if (body.action === "inbox") {
      const { data: rows, error } = await supabase
        .from("shared_songs")
        .select(
          "id, user_id, recipient_id, item_type, item_id, item_name, artist_name, cover_url, message, created_at"
        )
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Inbox query failed:", error.message);
        return respond({ error: "Could not load inbox" }, 500);
      }

      const { data: sentRows, error: sentError } = await supabase.from("shared_songs").select("id, user_id, recipient_id, item_type, item_id, item_name, artist_name, cover_url, message, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (sentError) return respond({ error: "Could not load sent history" }, 500);
      const recipientIds = [...new Set((sentRows || []).map((r) => r.recipient_id))];
      const { data: recipients } = recipientIds.length ? await supabase.from("users").select("id, username, avatar_url").in("id", recipientIds) : { data: [] };
      const recipientsById: Record<string, any> = {};
      for (const recipient of recipients || []) recipientsById[recipient.id] = recipient;

      const senderIds = [...new Set((rows || []).map((r) => r.user_id))];

      let sendersById: Record<string, any> = {};

      if (senderIds.length) {
        const { data: senders, error: sendersError } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .in("id", senderIds);

        if (sendersError) {
          console.error("Sender lookup failed:", sendersError.message);
          return respond({ error: "Could not load senders" }, 500);
        }

        for (const sender of senders || []) {
          sendersById[sender.id] = sender;
        }
      }

      return respond({
        success: true,
        items: (rows || []).map((row) => {
          const sender = sendersById[row.user_id];

          return {
            id: `remote-${row.id}`,
            itemId: row.item_id,
            type: row.item_type,
            name: row.item_name,
            artist: row.artist_name || "",
            cover: row.cover_url || "",
            message: row.message || "",
            from: sender?.username || "Friend",
            username: sender?.username || "Friend",
            fromAvatar: sender?.avatar_url || "",
            date: row.created_at,
            url: `https://open.spotify.com/${row.item_type}/${row.item_id}`,
          };
        }),
        sentItems: (sentRows || []).map((row) => ({ id: `sent-${row.id}`, itemId: row.item_id, type: row.item_type, name: row.item_name, artist: row.artist_name || "", cover: row.cover_url || "", message: String(row.message || "").replace(/[\u0080-\u009F]/g, ""), to: recipientsById[row.recipient_id]?.username || "Friend", username: recipientsById[row.recipient_id]?.username || "Friend", date: row.created_at, url: `https://open.spotify.com/${row.item_type}/${row.item_id}` })),
      });
    }

    // Existing send-music action.
    const {
      recipient_id,
      item_type,
      item_id,
      item_name,
      artist_name,
      cover_url,
      message,
    } = body;

    if (
      !recipient_id ||
      !["album", "track"].includes(item_type) ||
      typeof item_id !== "string" ||
      !item_id ||
      typeof item_name !== "string" ||
      !item_name
    ) {
      return respond({ error: "Missing or invalid music details" }, 400);
    }

    const { data: recipient, error: recipientError } = await supabase
      .from("users")
      .select("id")
      .eq("id", recipient_id)
      .maybeSingle();

    if (recipientError || !recipient) {
      return respond({ error: "Recipient not found" }, 404);
    }

    if (user.id === recipient.id) {
      return respond({ error: "You cannot send music to yourself" }, 400);
    }

    const { data: friendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("id")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${recipient.id}),and(user_id.eq.${recipient.id},friend_id.eq.${user.id})`
      )
      .limit(1)
      .maybeSingle();

    if (friendshipError) {
      return respond({ error: "Could not verify friendship" }, 500);
    }

    if (!friendship) {
      return respond({ error: "You must be friends to share music" }, 403);
    }

    const { data, error } = await supabase
      .from("shared_songs")
      .insert({
        user_id: user.id,
        recipient_id: recipient.id,
        item_type,
        item_id,
        item_name,
        artist_name: typeof artist_name === "string" ? artist_name.slice(0, 300) : "",
        cover_url: typeof cover_url === "string" ? cover_url.slice(0, 2000) : "",
        message: typeof message === "string" ? message.slice(0, 500) : "",
      })
      .select("id")
      .single();

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





