-- Cloud-backed music lists with enforceable public/friends/link/private visibility.
create table if not exists public.music_lists (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  privacy text not null default 'public'
    check (privacy in ('public', 'friends', 'link', 'private')),
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array'),
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists music_lists_user_updated_idx
  on public.music_lists (user_id, updated_at desc);
create unique index if not exists music_lists_share_token_uidx
  on public.music_lists (share_token);

alter table public.music_lists enable row level security;

-- Security-definer helper lets the list policy verify mutual follows without
-- depending on the caller's visibility into another user's friendship rows.
create or replace function public.are_mutual_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $
  select
    auth.uid() in (p_user_a, p_user_b)
    and exists (
      select 1 from public.friendships f1
      where f1.user_id = p_user_a and f1.friend_id = p_user_b
    )
    and exists (
      select 1 from public.friendships f2
      where f2.user_id = p_user_b and f2.friend_id = p_user_a
    );
$;

revoke all on function public.are_mutual_friends(uuid, uuid) from public;
grant execute on function public.are_mutual_friends(uuid, uuid) to authenticated;

drop policy if exists "Owners can manage their music lists" on public.music_lists;
create policy "Owners can manage their music lists"
  on public.music_lists for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Public and mutual friends can view music lists" on public.music_lists;
create policy "Public and mutual friends can view music lists"
  on public.music_lists for select to authenticated
  using (
    privacy = 'public'
    or user_id = auth.uid()
    or (
      privacy = 'friends'
      and public.are_mutual_friends(music_lists.user_id, auth.uid())
    )
  );

revoke all on public.music_lists from anon;
grant select, insert, update, delete on public.music_lists to authenticated;
grant all on public.music_lists to service_role;

-- Link-only lists are retrieved through this token-checking function, never by
-- querying the table directly. UUID tokens are not exposed in profile listings.
create or replace function public.get_link_shared_list(
  p_list_id text,
  p_share_token uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', l.id,
    'name', l.name,
    'description', l.description,
    'items', l.items,
    'created_at', l.created_at
  )
  from public.music_lists l
  where l.id = p_list_id
    and l.privacy = 'link'
    and l.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_link_shared_list(text, uuid) from public;
grant execute on function public.get_link_shared_list(text, uuid) to anon, authenticated;
