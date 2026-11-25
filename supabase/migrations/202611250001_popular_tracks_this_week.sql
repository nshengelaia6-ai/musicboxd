-- Expose only anonymized, aggregated track popularity across the platform.
-- Individual user activity remains protected by the user_activity RLS policy.
create or replace function public.get_popular_tracks_this_week()
returns table (
  item_id text,
  item_name text,
  artist_name text,
  cover_url text,
  listener_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ua.item_key::text as item_id,
    (array_agg(
      coalesce(ua.data ->> 'name', 'Unknown track')
      order by ua.created_at desc
    ))[1] as item_name,
    (array_agg(
      coalesce(
        ua.data ->> 'artist_name',
        ua.data ->> 'artistName',
        ua.data ->> 'artist',
        ua.data ->> 'artists',
        ''
      )
      order by ua.created_at desc
    ))[1] as artist_name,
    (array_agg(
      coalesce(ua.data ->> 'cover', ua.data ->> 'cover_url', '')
      order by ua.created_at desc
    ))[1] as cover_url,
    count(distinct ua.user_id)::bigint as listener_count
  from public.user_activity as ua
  where ua.activity_type in ('listened', 'reviewed')
    and ua.created_at >= now() - interval '7 days'
    and ua.data ->> 'type' = 'track'
    and ua.item_key is not null
  group by ua.item_key
  order by count(distinct ua.user_id) desc, max(ua.created_at) desc
  limit 100;
$$;

revoke all on function public.get_popular_tracks_this_week() from public;
revoke all on function public.get_popular_tracks_this_week() from anon;
grant execute on function public.get_popular_tracks_this_week() to authenticated;
