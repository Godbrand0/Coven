-- Adds the 'request_sent' activity type: the requester's own feed entry for a payment request they
-- made ("You requested $5 from @bob"). Until now only the person asked got an entry (request_received),
-- so someone who made a request saw nothing in Recent activity or Notifications. Same two-perspective
-- pattern as payment_sent/payment_received. Run once in the Supabase SQL editor on every database
-- (testnet and mainnet) BEFORE deploying the code that writes this type. (schema.sql already reflects
-- this for fresh installs.)

alter table activity drop constraint activity_type_check;
alter table activity add constraint activity_type_check
  check (type in ('payment_sent','payment_received','request_received','request_sent',
                  'request_paid','request_rejected','request_declined','split_created',
                  'split_paid','split_complete','offramp_completed','offramp_failed',
                  'circle_joined','goal_created','goal_target_reached',
                  'goal_withdrawal_requested','goal_withdrawn'));

-- Backfill: give every request made before this change its entry, marked read so the bell does not
-- light up for old requests. Safe to run twice.
insert into activity (user_id, type, reference_id, actor_id, amount_usdc, note, read, created_at)
select r.from_user_id, 'request_sent', r.id, r.to_user_id, r.amount_usdc, r.note, true, r.created_at
from payment_requests r
where not exists (
  select 1 from activity a where a.type = 'request_sent' and a.reference_id = r.id
);
