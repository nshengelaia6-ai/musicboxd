-- Restrict activity reads to the account owner and users connected by a follow relationship.
drop policy if exists "Authenticated users can view user activity"
on public.user_activity;

create policy "Users can view own and connected activity"
on public.user_activity
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where
      (f.user_id = auth.uid() and f.friend_id = user_activity.user_id)
      or
      (f.user_id = user_activity.user_id and f.friend_id = auth.uid())
  )
);

-- Ensure the tables used by the Activity live feed publish change events.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_activity'
  ) then
    alter publication supabase_realtime add table public.user_activity;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end
$$;
