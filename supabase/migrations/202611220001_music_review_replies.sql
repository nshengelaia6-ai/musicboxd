-- Replies posted directly beneath public album and track reviews.
create table if not exists public.music_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.music_reviews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reply_text text not null check (char_length(trim(reply_text)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists music_review_replies_review_idx
  on public.music_review_replies (review_id, created_at asc);
create index if not exists music_review_replies_user_idx
  on public.music_review_replies (user_id, created_at desc);

alter table public.music_review_replies enable row level security;

drop policy if exists "Authenticated users can read unblocked review replies" on public.music_review_replies;
create policy "Authenticated users can read unblocked review replies"
  on public.music_review_replies for select to authenticated
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.music_reviews r
      where r.id = music_review_replies.review_id
        and not public.are_users_blocked(r.user_id, auth.uid())
    )
    and not public.are_users_blocked(music_review_replies.user_id, auth.uid())
  );

drop policy if exists "Users can reply to reviews" on public.music_review_replies;
create policy "Users can reply to reviews"
  on public.music_review_replies for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.music_reviews r
      where r.id = music_review_replies.review_id
        and not public.are_users_blocked(r.user_id, auth.uid())
    )
  );

drop policy if exists "Users can delete their own review replies" on public.music_review_replies;
create policy "Users can delete their own review replies"
  on public.music_review_replies for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.music_review_replies to authenticated;
grant all on public.music_review_replies to service_role;
