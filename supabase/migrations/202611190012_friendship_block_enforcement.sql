-- Make follow relationships private to their two participants and reject
-- follows in either direction whenever either participant has blocked the other.
alter table public.friendships enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'friendships'
  loop
    execute format('drop policy %I on public.friendships', existing_policy.policyname);
  end loop;
end;
$$;

create policy "Users can view relationships involving themselves"
  on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "Users can follow from their own account"
  on public.friendships for insert to authenticated
  with check (user_id = auth.uid() and user_id <> friend_id);

create policy "Participants can remove a relationship"
  on public.friendships for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "Blocked users cannot follow each other"
  on public.friendships as restrictive for all to authenticated
  using (not public.are_users_blocked(user_id, friend_id))
  with check (not public.are_users_blocked(user_id, friend_id));

revoke all on public.friendships from anon;
grant select, insert, delete on public.friendships to authenticated;
grant all on public.friendships to service_role;
