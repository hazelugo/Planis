-- Enable Supabase Realtime for cross-device trip sync.
-- Run once in Supabase → SQL Editor (same-browser tabs use BroadcastChannel and do not need this).

alter publication supabase_realtime add table public.trips;

-- Optional: improves filtered DELETE/UPDATE delivery if you add server-side filters later.
alter table public.trips replica identity full;
