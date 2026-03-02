-- Enable real-time replication for users (for when employees are added/deleted)
alter publication supabase_realtime add table public.users;

-- Enable real-time replication for shifts (for when shifts are assigned/edited/deleted)
alter publication supabase_realtime add table public.shifts;
