-- Public, item-scoped reviews for albums and tracks.
-- Existing local/profile review data is preserved; new writes can be mirrored here.
create table if not exists public.music_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  item_type text not null check (item_type in ('album', 'track')),
  item_id text not null,
  parent_album_id text,
  item_name text not null,
  artist_name text not null default '',
  cover_url text not null default '',
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  review_text text not null default '' check (char_length(review_text) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_reviews_item_identity_check check (
    char_length(item_id) between 1 and 200
    and char_length(item_name) between 1 and 300
  ),
  constraint music_reviews_content_check check (rating > 0 or char_length(trim(review_text)) > 0),
  constraint music_reviews_track_parent_check check (
    item_type = 'album' or parent_album_id is not null
  ),
  constraint music_reviews_rating_half_steps check (rating * 2 = trunc(rating * 2))
);

create unique index if not exists music_reviews_user_item_uidx
  on public.music_reviews (user_id, item_type, item_id);
create index if not exists music_reviews_item_recent_idx
  on public.music_reviews (item_type, item_id, created_at desc);
create index if not exists music_reviews_item_rating_idx
  on public.music_reviews (item_type, item_id, rating desc, updated_at desc);

alter table public.music_reviews enable row level security;

drop policy if exists "Authenticated users can read unblocked music reviews" on public.music_reviews;
create policy "Authenticated users can read unblocked music reviews"
  on public.music_reviews for select to authenticated
  using (
    auth.uid() is not null
    and not exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = music_reviews.user_id)
         or (b.blocker_id = music_reviews.user_id and b.blocked_id = auth.uid())
    )
  );

drop policy if exists "Users can create their own music reviews" on public.music_reviews;
create policy "Users can create their own music reviews"
  on public.music_reviews for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own music reviews" on public.music_reviews;
create policy "Users can update their own music reviews"
  on public.music_reviews for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own music reviews" on public.music_reviews;
create policy "Users can delete their own music reviews"
  on public.music_reviews for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.music_reviews from anon;
grant select, insert, update, delete on public.music_reviews to authenticated;
grant all on public.music_reviews to service_role;
