-- Store each user's album listening status in the cloud so friend shelves
-- reflect the current state across devices, not stale activity log events.
create table if not exists public.music_album_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  album_id text not null,
  status text not null check (status in ('listened', 'wants_to_listen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, album_id, status)
);

create index if not exists music_album_status_album_status_idx
  on public.music_album_status (album_id, status);

alter table public.music_album_status enable row level security;

drop policy if exists "Users can view own and unblocked mutual friends album statuses"
  on public.music_album_status;
create policy "Users can view own and unblocked mutual friends album statuses"
  on public.music_album_status for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.are_mutual_friends(user_id, auth.uid())
      and not public.are_users_blocked(user_id, auth.uid())
    )
  );

drop policy if exists "Users can manage their own album statuses"
  on public.music_album_status;
create policy "Users can manage their own album statuses"
  on public.music_album_status for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.music_album_status to authenticated;
grant all on public.music_album_status to service_role;
