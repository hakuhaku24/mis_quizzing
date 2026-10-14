-- 003_bump_sequences.sql
-- The SQLite->Supabase content migration (pipeline/jobs/migrate_to_supabase.py)
-- inserted questions/solutions with explicit ids preserved from SQLite, but
-- never advanced the identity sequences past them (the migration script's
-- fallback RPC for this doesn't exist on a stock project). Any INSERT that
-- lets Postgres pick the id itself collides with an already-used one.
select setval(pg_get_serial_sequence('questions', 'id'), (select max(id) from questions));
select setval(pg_get_serial_sequence('solutions', 'id'), (select max(id) from solutions));
