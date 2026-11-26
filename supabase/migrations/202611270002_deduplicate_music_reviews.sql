-- Repair legacy duplicate reviews while preserving their likes and replies.
-- Keep the most recently updated review for each user/item combination.
begin;

create temporary table music_review_duplicate_map on commit drop as
with ranked as (
  select
    id,
    first_value(id) over (
      partition by user_id, item_type, item_id
      order by updated_at desc, created_at desc, id
    ) as keep_id,
    row_number() over (
      partition by user_id, item_type, item_id
      order by updated_at desc, created_at desc, id
    ) as position
  from public.music_reviews
)
select id as duplicate_id, keep_id
from ranked
where position > 1;

-- Move likes to the surviving review. Existing likes by the same user
-- are retained once, using the unique (review_id, user_id) key.
insert into public.music_review_likes (review_id, user_id, created_at)
select distinct mapping.keep_id, likes.user_id, likes.created_at
from public.music_review_likes as likes
join music_review_duplicate_map as mapping
  on mapping.duplicate_id = likes.review_id
on conflict (review_id, user_id) do nothing;

delete from public.music_review_likes as likes
using music_review_duplicate_map as mapping
where likes.review_id = mapping.duplicate_id;

-- Preserve every reply by attaching it to the surviving review.
update public.music_review_replies as replies
set review_id = mapping.keep_id
from music_review_duplicate_map as mapping
where replies.review_id = mapping.duplicate_id;

delete from public.music_reviews as reviews
using music_review_duplicate_map as mapping
where reviews.id = mapping.duplicate_id;

create unique index if not exists music_reviews_user_item_uidx
  on public.music_reviews (user_id, item_type, item_id);

commit;
