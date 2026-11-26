-- Persist followed Spotify artists per authenticated Musicboxd account.
create table if not exists public.artist_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id text not null check (char_length(artist_id) between 1 and 200),
  artist_name text not null default '',
  artist_image text not null default '',
  created_at timestamptz not null default now(),
  constraint artist_follows_user_artist_uidx unique (user_id, artist_id)
);

create index if not exists artist_follows_user_created_idx
  on public.artist_follows (user_id, created_at desc);

alter table public.artist_follows enable row level security;

drop policy if exists "Users can read their followed artists" on public.artist_follows;
create policy "Users can read their followed artists"
  on public.artist_follows for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can follow artists" on public.artist_follows;
create policy "Users can follow artists"
  on public.artist_follows for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their followed artists" on public.artist_follows;
create policy "Users can update their followed artists"
  on public.artist_follows for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can unfollow artists" on public.artist_follows;
create policy "Users can unfollow artists"
  on public.artist_follows for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.artist_follows from anon;
grant select, insert, update, delete on public.artist_follows to authenticated;
grant all on public.artist_follows to service_role;
