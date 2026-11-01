-- Newly created functions require explicit API grants. Existing grants are preserved.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon,authenticated;
