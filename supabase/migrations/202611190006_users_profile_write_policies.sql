-- Allow an authenticated account to create or update only its own profile row.
-- Existing public-profile SELECT policies are intentionally left unchanged.
alter table public.users enable row level security;

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
on public.users
for insert
to authenticated
with check (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
on public.users
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
