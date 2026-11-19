-- A follow relationship must exist only once for each direction.
-- Remove any duplicate rows already created by repeated follow requests.
with ranked_friendships as (
  select
    ctid,
    row_number() over (
      partition by user_id, friend_id
      order by ctid
    ) as row_num
  from public.friendships
)
delete from public.friendships as friendship
using ranked_friendships as ranked
where friendship.ctid = ranked.ctid
  and ranked.row_num > 1;

create unique index if not exists friendships_user_id_friend_id_unique
  on public.friendships (user_id, friend_id);
