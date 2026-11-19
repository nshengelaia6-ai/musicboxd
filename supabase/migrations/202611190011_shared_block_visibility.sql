-- Hide existing shared conversations and interactions after either participant blocks the other.
create or replace function public.are_users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() in (p_user_a, p_user_b)
    and exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
         or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
    );
$$;

revoke all on function public.are_users_blocked(uuid, uuid) from public;
grant execute on function public.are_users_blocked(uuid, uuid) to authenticated;

-- Remove any older permissive SELECT policies; PostgreSQL combines permissive
-- policies with OR, so leaving one behind could bypass the block restriction.
do $block$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('shared_songs', 'shared_song_likes', 'shared_song_replies')
      and cmd in ('SELECT', 'ALL')
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end;
$block$;

drop policy if exists "Shared participants can view shared songs" on public.shared_songs;
create policy "Unblocked shared participants can view shared songs"
  on public.shared_songs for select to authenticated
  using (
    (user_id = auth.uid() or recipient_id = auth.uid())
    and not public.are_users_blocked(user_id, recipient_id)
  );

drop policy if exists "Shared participants can view likes" on public.shared_song_likes;
drop policy if exists "Unblocked shared participants can view likes" on public.shared_song_likes;
create policy "Unblocked shared participants can view likes"
  on public.shared_song_likes for select to authenticated
  using (exists (
    select 1 from public.shared_songs s
    where s.id = shared_song_id
      and (s.user_id = auth.uid() or s.recipient_id = auth.uid())
      and not public.are_users_blocked(s.user_id, s.recipient_id)
  ));

drop policy if exists "Shared participants can view replies" on public.shared_song_replies;
drop policy if exists "Unblocked shared participants can view replies" on public.shared_song_replies;
create policy "Unblocked shared participants can view replies"
  on public.shared_song_replies for select to authenticated
  using (exists (
    select 1 from public.shared_songs s
    where s.id = shared_song_id
      and (s.user_id = auth.uid() or s.recipient_id = auth.uid())
      and not public.are_users_blocked(s.user_id, s.recipient_id)
  ));
