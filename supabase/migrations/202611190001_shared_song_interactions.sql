-- Shared music interactions and track-to-album navigation.
alter table public.shared_songs
  add column if not exists album_id text;

create table if not exists public.shared_song_likes (
  id uuid primary key default gen_random_uuid(),
  shared_song_id uuid not null references public.shared_songs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shared_song_id, user_id)
);

create table if not exists public.shared_song_replies (
  id uuid primary key default gen_random_uuid(),
  shared_song_id uuid not null references public.shared_songs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists shared_song_likes_shared_song_id_idx
  on public.shared_song_likes(shared_song_id);
create index if not exists shared_song_replies_shared_song_id_created_at_idx
  on public.shared_song_replies(shared_song_id, created_at);

-- Interactions are accessed through the authenticated swift-service Edge Function.
alter table public.shared_song_likes enable row level security;
alter table public.shared_song_replies enable row level security;

-- Keep the Shared screen in sync when either participant interacts.
do $$
begin
  alter publication supabase_realtime add table public.shared_songs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.shared_song_likes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.shared_song_replies;
exception when duplicate_object then null;
end $$;
