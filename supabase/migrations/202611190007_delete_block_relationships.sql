-- Remove all application rows and avatar files belonging to one authenticated account.
-- The Edge Function calls this RPC with the service-role client after password re-authentication.
create or replace function public.delete_account_data(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  target_table record;
  target_column record;
  delete_filter text;
begin
  if p_auth_user_id is null then
    raise exception 'Account id is required';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and auth.uid() is distinct from p_auth_user_id then
    raise exception 'Not authorized to delete this account';
  end if;

  -- Remove profile images owned by this account.
  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = p_auth_user_id::text;

  -- Delete child tables before their referenced parent tables. Include tables
  -- without declared foreign keys when they use a conventional owner column.
  for target_table in
    with recursive descendants(relid, depth, path) as (
      select
        constraint_row.conrelid,
        1,
        array[constraint_row.confrelid, constraint_row.conrelid]
      from pg_catalog.pg_constraint constraint_row
      where constraint_row.contype = 'f'
        and constraint_row.confrelid in (
          'auth.users'::regclass,
          'public.users'::regclass
        )
        and constraint_row.conrelid <> constraint_row.confrelid

      union all

      select
        child.conrelid,
        parent.depth + 1,
        parent.path || child.conrelid
      from pg_catalog.pg_constraint child
      join descendants parent
        on child.confrelid = parent.relid
      where child.contype = 'f'
        and not child.conrelid = any(parent.path)
    ),
    depths as (
      select relid, max(depth) as depth
      from descendants
      group by relid
    )
    select
      namespace_row.nspname as schema_name,
      table_row.relname as table_name,
      coalesce(depths.depth, 0) as depth
    from pg_catalog.pg_class table_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    left join depths
      on depths.relid = table_row.oid
    where namespace_row.nspname = 'public'
      and table_row.relkind in ('r', 'p')
      and (
        depths.relid is not null
        or table_row.relname = 'users'
        or exists (
          select 1
          from information_schema.columns column_row
          where column_row.table_schema = namespace_row.nspname
            and column_row.table_name = table_row.relname
            and column_row.column_name in (
              'user_id',
              'auth_user_id',
              'owner_id',
              'created_by',
              'sender_id',
              'recipient_id',
              'friend_id',
              'follower_id',
              'followed_id',
              'blocker_id',
              'blocked_id'
            )
        )
      )
    order by coalesce(depths.depth, 0) desc, table_row.relname
  loop
    delete_filter := '';

    for target_column in
      select column_row.column_name
      from information_schema.columns column_row
      where column_row.table_schema = target_table.schema_name
        and column_row.table_name = target_table.table_name
        and (
          column_row.column_name in (
            'user_id',
            'auth_user_id',
            'owner_id',
            'created_by',
            'sender_id',
            'recipient_id',
            'friend_id',
            'follower_id',
            'followed_id',
              'blocker_id',
              'blocked_id'
          )
          or (
            target_table.table_name = 'users'
            and column_row.column_name = 'id'
          )
        )
    loop
      delete_filter := concat_ws(
        ' OR ',
        nullif(delete_filter, ''),
        format('%I::text = $1', target_column.column_name)
      );
    end loop;

    if delete_filter <> '' then
      execute format(
        'delete from %I.%I where %s',
        target_table.schema_name,
        target_table.table_name,
        delete_filter
      )
      using p_auth_user_id::text;
    end if;
  end loop;
end;
$$;

revoke all on function public.delete_account_data(uuid) from public;
revoke all on function public.delete_account_data(uuid) from anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
