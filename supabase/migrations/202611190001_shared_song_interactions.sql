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

-- Permit realtime SELECT events only to the two participants in a share.
alter table public.shared_songs enable row level security;

drop policy if exists "Shared participants can view shared songs" on public.shared_songs;
create policy "Shared participants can view shared songs"
  on public.shared_songs for select to authenticated
  using (user_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "Shared participants can view likes" on public.shared_song_likes;
create policy "Shared participants can view likes"
  on public.shared_song_likes for select to authenticated
  using (exists (
    select 1 from public.shared_songs s
    where s.id = shared_song_id
      and (s.user_id = auth.uid() or s.recipient_id = auth.uid())
  ));

drop policy if exists "Shared participants can view replies" on public.shared_song_replies;
create policy "Shared participants can view replies"
  on public.shared_song_replies for select to authenticated
  using (exists (
    select 1 from public.shared_songs s
    where s.id = shared_song_id
      and (s.user_id = auth.uid() or s.recipient_id = auth.uid())
  ));
