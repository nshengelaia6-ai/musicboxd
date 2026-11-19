-- Enforce ownership and visibility for block relationships.
create table if not exists public.blocked_users (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

-- Remove malformed/self and duplicate legacy rows before adding strict constraints.
delete from public.blocked_users
where blocker_id = blocked_id;

delete from public.blocked_users older
using public.blocked_users newer
where older.blocker_id = newer.blocker_id
  and older.blocked_id = newer.blocked_id
  and older.ctid > newer.ctid;

create unique index if not exists blocked_users_blocker_blocked_uidx
  on public.blocked_users (blocker_id, blocked_id);
create index if not exists blocked_users_blocked_blocker_idx
  on public.blocked_users (blocked_id, blocker_id);

alter table public.blocked_users enable row level security;

-- Remove any legacy permissive policies before installing the strict policy set.
do $block$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blocked_users'
  loop
    execute format('drop policy %I on public.blocked_users', existing_policy.policyname);
  end loop;
end;
$block$;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.blocked_users'::regclass
      and conname = 'blocked_users_not_self'
  ) then
    alter table public.blocked_users
      add constraint blocked_users_not_self check (blocker_id <> blocked_id);
  end if;
end;
$block$;

drop policy if exists "Users can view blocks involving themselves" on public.blocked_users;
drop policy if exists "Users can view their own blocks" on public.blocked_users;
create policy "Users can view their own blocks"
  on public.blocked_users for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "Users can create their own blocks" on public.blocked_users;
create policy "Users can create their own blocks"
  on public.blocked_users for insert to authenticated
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

drop policy if exists "Users can remove their own blocks" on public.blocked_users;
create policy "Users can remove their own blocks"
  on public.blocked_users for delete to authenticated
  using (blocker_id = auth.uid());

revoke all on public.blocked_users from anon;
grant select, insert, delete on public.blocked_users to authenticated;
grant all on public.blocked_users to service_role;
