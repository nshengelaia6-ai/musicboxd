-- Likes for public music lists.
create table if not exists public.music_list_likes (
  list_id text not null references public.music_lists(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create index if not exists music_list_likes_list_created_idx
  on public.music_list_likes (list_id, created_at desc);
create index if not exists music_list_likes_user_created_idx
  on public.music_list_likes (user_id, created_at desc);

alter table public.music_list_likes enable row level security;

drop policy if exists "Authenticated users can read public list likes" on public.music_list_likes;
create policy "Authenticated users can read public list likes"
  on public.music_list_likes for select to authenticated
  using (
    exists (
      select 1 from public.music_lists l
      where l.id = music_list_likes.list_id
        and l.privacy = 'public'
        and not public.are_users_blocked(l.user_id, auth.uid())
    )
  );

drop policy if exists "Users can like public lists" on public.music_list_likes;
create policy "Users can like public lists"
  on public.music_list_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.music_lists l
      where l.id = music_list_likes.list_id
        and l.privacy = 'public'
        and l.user_id <> auth.uid()
        and not public.are_users_blocked(l.user_id, auth.uid())
    )
  );

drop policy if exists "Users can unlike lists" on public.music_list_likes;
create policy "Users can unlike lists"
  on public.music_list_likes for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.music_list_likes from anon;
grant select, insert, delete on public.music_list_likes to authenticated;
grant all on public.music_list_likes to service_role;
