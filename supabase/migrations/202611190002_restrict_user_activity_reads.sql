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
