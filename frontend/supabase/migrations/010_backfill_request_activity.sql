-- Backfills activity entries that three early requests (25 July 2026, while the pay and decline
-- features were first being built) never got:
--   * a paid request with no entries at all: the requester's request_paid and the payer's payment_sent
--   * a declined request with only the requester's half: the decliner's request_declined
-- Entries are marked read so the bell does not light up for old events, and dated to the event.
-- Safe to run more than once, and a no-op on a database that has none of these gaps.

-- Requester: "@payer paid your request"
insert into activity (user_id, type, reference_id, actor_id, amount_usdc, note, read, created_at)
select r.from_user_id, 'request_paid', r.id, r.to_user_id, r.amount_usdc, r.note, true, p.created_at
from payment_requests r
join payments p on p.id = r.payment_id
where r.status = 'paid'
  and not exists (select 1 from activity a where a.type = 'request_paid' and a.reference_id = r.id);

-- Payer: "You sent @requester" (its reference is the payment, and the actor is the payer themself)
insert into activity (user_id, type, reference_id, actor_id, amount_usdc, note, read, created_at)
select r.to_user_id, 'payment_sent', p.id, r.to_user_id, r.amount_usdc, r.note, true, p.created_at
from payment_requests r
join payments p on p.id = r.payment_id
where r.status = 'paid'
  and not exists (select 1 from activity a where a.type = 'payment_sent' and a.reference_id = p.id);

-- Decliner: "You declined @requester's request" (the table keeps no decline time, so the request's date is used)
insert into activity (user_id, type, reference_id, actor_id, amount_usdc, note, read, created_at)
select r.to_user_id, 'request_declined', r.id, r.from_user_id, r.amount_usdc, r.note, true, r.created_at
from payment_requests r
where r.status = 'rejected'
  and not exists (select 1 from activity a where a.type = 'request_declined' and a.reference_id = r.id);
