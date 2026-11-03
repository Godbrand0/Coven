-- Who invited whom. Set once, when a new user claims their handle through someone's invite link
-- (POST /api/referrals/claim). Nothing is paid for a referral yet; this only records it. Run once in
-- the Supabase SQL editor against an existing database (schema.sql already reflects this for fresh
-- installs).

alter table users add column if not exists referred_by uuid references users(id);
alter table users drop constraint if exists users_not_self_referred;
alter table users add constraint users_not_self_referred check (referred_by is distinct from id);

create index if not exists idx_users_referred_by on users(referred_by);
