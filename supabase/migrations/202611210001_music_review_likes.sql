-- Likes for public album and track reviews.
create table if not exists public.music_review_likes (
  review_id uuid not null references public.music_reviews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists music_review_likes_user_idx
  on public.music_review_likes (user_id, created_at desc);

alter table public.music_review_likes enable row level security;

drop policy if exists "Authenticated users can read review likes" on public.music_review_likes;
create policy "Authenticated users can read review likes"
  on public.music_review_likes for select to authenticated
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.music_reviews r
      where r.id = music_review_likes.review_id
        and not public.are_users_blocked(r.user_id, auth.uid())
    )
  );

drop policy if exists "Users can like reviews" on public.music_review_likes;
create policy "Users can like reviews"
  on public.music_review_likes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can unlike reviews" on public.music_review_likes;
create policy "Users can unlike reviews"
  on public.music_review_likes for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.music_review_likes to authenticated;
grant all on public.music_review_likes to service_role;
