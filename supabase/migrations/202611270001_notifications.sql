-- In-app notifications for follows, review/list likes, and review replies.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  notification_type text not null check (notification_type in ('new_follower','review_like','review_reply','list_like')),
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());

revoke all on public.notifications from anon;
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

create or replace function public.create_musicboxd_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_entity_id text,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;
  if public.are_users_blocked(p_recipient, p_actor) then
    return;
  end if;
  insert into public.notifications(recipient_id, actor_id, notification_type, entity_id, data)
  values (p_recipient, p_actor, p_type, p_entity_id, coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke all on function public.create_musicboxd_notification(uuid,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_musicboxd_notification(uuid,uuid,text,text,jsonb) to service_role;

create or replace function public.notify_musicboxd_follow() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  perform public.create_musicboxd_notification(NEW.friend_id, NEW.user_id, 'new_follower', NEW.user_id::text, '{}'::jsonb);
  return NEW;
end;
$$;
drop trigger if exists musicboxd_notify_follow on public.friendships;
create trigger musicboxd_notify_follow after insert on public.friendships
for each row execute function public.notify_musicboxd_follow();

create or replace function public.notify_musicboxd_review_like() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare review_owner uuid;
begin
  select user_id into review_owner from public.music_reviews where id = NEW.review_id;
  perform public.create_musicboxd_notification(review_owner, NEW.user_id, 'review_like', NEW.review_id::text, '{}'::jsonb);
  return NEW;
end;
$$;
drop trigger if exists musicboxd_notify_review_like on public.music_review_likes;
create trigger musicboxd_notify_review_like after insert on public.music_review_likes
for each row execute function public.notify_musicboxd_review_like();

create or replace function public.notify_musicboxd_review_reply() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare review_owner uuid;
begin
  select user_id into review_owner from public.music_reviews where id = NEW.review_id;
  perform public.create_musicboxd_notification(review_owner, NEW.user_id, 'review_reply', NEW.review_id::text,
    jsonb_build_object('reply_id', NEW.id, 'reply_text', NEW.reply_text));
  return NEW;
end;
$$;
drop trigger if exists musicboxd_notify_review_reply on public.music_review_replies;
create trigger musicboxd_notify_review_reply after insert on public.music_review_replies
for each row execute function public.notify_musicboxd_review_reply();

create or replace function public.notify_musicboxd_list_like() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare list_owner uuid;
begin
  select user_id into list_owner from public.music_lists where id = NEW.list_id;
  perform public.create_musicboxd_notification(list_owner, NEW.user_id, 'list_like', NEW.list_id, '{}'::jsonb);
  return NEW;
end;
$$;
drop trigger if exists musicboxd_notify_list_like on public.music_list_likes;
create trigger musicboxd_notify_list_like after insert on public.music_list_likes
for each row execute function public.notify_musicboxd_list_like();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
