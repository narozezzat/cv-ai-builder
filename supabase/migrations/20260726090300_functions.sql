-- Server-side primitives: rate limiting, credit metering, dashboard aggregation,
-- trash retention.
--
-- Everything here is SECURITY DEFINER, which means everything here is a piece of
-- attack surface. Three rules apply to every function in this file:
--
-- 1. `set search_path = ''` and fully-qualified names. A definer function that
--    resolves `profiles` through a mutable search_path can be pointed at an
--    attacker's table.
-- 2. No function takes a user id. Anything that acts on behalf of a user reads
--    `auth.uid()` itself. A `p_user_id` parameter on a definer function is just a
--    documented way to act as anyone.
-- 3. Execute is revoked from `public` and granted deliberately. The default on a
--    new function is execute-to-public, so silence here means "callable by
--    anonymous visitors".
--
-- Rule 2 is also why there is no `record_ai_usage` or `log_activity` function
-- here. Both would have to read `auth.uid()`, which means being callable by
-- `authenticated` — and every function callable by `authenticated` is callable
-- from the browser via `supabase.rpc()`, not only from our server actions. That
-- would let a client forge its own audit entries and poison the cost figures the
-- AI ledger exists to reconcile. Those two tables are written by
-- `services/supabase/admin.ts` with the service role instead, which bypasses RLS
-- and takes the user id from the session the server already verified.
--
-- `charge_ai_credits` below cannot use that route: it must know who the caller is,
-- and under the service role `auth.uid()` is null. It is client-callable by
-- necessity, and safe because the only thing it can do is subtract.

-- ── Rate limiting ─────────────────────────────────────────────────────────────
--
-- Postgres rather than Redis. The limits that matter here are per-user-per-day AI
-- calls and per-minute export jobs — hundreds of rows, not millions — and a
-- second stateful service to operate is a real cost against a table that already
-- exists and is already backed up.
--
-- `subject` is a caller-supplied string (a user id, or a hashed IP for
-- unauthenticated actions) which is exactly why this function is NOT callable by
-- `anon` or `authenticated`: a client that could pass an arbitrary subject could
-- pass someone else's user id and burn their quota. Only trusted server code,
-- which derives the subject from the verified session, may call it.
create or replace function public.check_rate_limit(
  p_subject text,
  p_action text,
  p_window interval,
  p_max_count integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_subject is null or p_subject = '' or p_action is null or p_action = '' then
    raise exception 'check_rate_limit requires a subject and an action'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Without this, two requests arriving together both read a count below the
  -- limit and both insert, so a limit of N admits N+1. The lock is per
  -- subject+action and transaction-scoped, so it serializes one user's calls to
  -- one capability and nothing else.
  perform pg_advisory_xact_lock(hashtextextended(p_subject || ':' || p_action, 0));

  -- Pruning on read keeps the table bounded without a scheduled job. Scoped to
  -- this subject and action so a hot path never scans the whole table.
  delete from public.rate_limit_events
   where subject = p_subject
     and action = p_action
     and occurred_at < now() - p_window;

  select count(*)
    into v_count
    from public.rate_limit_events
   where subject = p_subject
     and action = p_action
     and occurred_at >= now() - p_window;

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.rate_limit_events (subject, action)
  values (p_subject, p_action);

  return true;
end;
$$;

comment on function public.check_rate_limit is
  'Consumes one unit of a subject''s allowance for an action. Returns false when the limit is already reached. Service role only: the subject is caller-supplied, so a client-callable version would let anyone exhaust another user''s quota.';

revoke all on function public.check_rate_limit(text, text, interval, integer) from public;
grant execute on function public.check_rate_limit(text, text, interval, integer) to service_role;

-- ── AI credit metering ────────────────────────────────────────────────────────
--
-- Charge before the model runs, not after. Charging on completion means a user
-- can fire twenty concurrent requests against a balance of one, and the provider
-- bill arrives regardless of what our ledger says.
--
-- There is intentionally no refund function. A user-callable
-- `refund_ai_credits(n)` is a credit-minting primitive no matter how carefully it
-- is written, and the failure it would compensate for — a provider error after
-- tokens were already spent — is one we pay for anyway. Operators can adjust a
-- balance with the service role.
create or replace function public.charge_ai_credits(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_remaining integer;
begin
  if v_user_id is null then
    raise exception 'charge_ai_credits requires an authenticated session'
      using errcode = 'insufficient_privilege';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'charge_ai_credits requires a positive amount'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Transaction-local, and read by `protect_profile_privileges` to allow this one
  -- write. `is_local => true` matters: a session-level setting would leave the
  -- connection able to move credits for every later request that reuses it out of
  -- the pool.
  perform set_config('app.privileged_write', 'ai_credits', true);

  -- The `>=` in the predicate is the concurrency control. Two simultaneous calls
  -- against a balance of one both take the row lock, and the second re-evaluates
  -- the predicate against the updated row and matches nothing. Doing this as
  -- select-then-update would let both succeed.
  update public.profiles
     set ai_credits = ai_credits - p_amount
   where id = v_user_id
     and ai_credits >= p_amount
  returning ai_credits into v_remaining;

  perform set_config('app.privileged_write', '', true);

  if v_remaining is null then
    -- Distinguishable from every other failure so the AI layer can render "out of
    -- credits" with an upgrade path instead of a generic error.
    raise exception 'insufficient AI credits'
      using errcode = 'insufficient_resources';
  end if;

  return v_remaining;
end;
$$;

comment on function public.charge_ai_credits is
  'Atomically debits the calling user''s AI credits and returns the new balance. Raises insufficient_resources (53000) when the balance is too low. Security control: reads auth.uid() rather than accepting a user id.';

revoke all on function public.charge_ai_credits(integer) from public;
grant execute on function public.charge_ai_credits(integer) to authenticated, service_role;

-- ── Dashboard counters ────────────────────────────────────────────────────────
--
-- The dashboard needs five numbers. Fetching them as five round-trips from an RSC
-- is five sequential network hops before the page can stream; this is one.
--
-- Not SECURITY DEFINER — it runs under the caller's RLS, so it can only ever
-- aggregate rows the caller could have selected one by one.
create or replace function public.get_dashboard_stats()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'resumeCount', (
      select count(*) from public.resumes
       where user_id = auth.uid() and deleted_at is null
    ),
    'trashedCount', (
      select count(*) from public.resumes
       where user_id = auth.uid() and deleted_at is not null
    ),
    'downloadCount', (
      select count(*) from public.exports
       where user_id = auth.uid() and status = 'completed'
    ),
    'aiCredits', (
      select ai_credits from public.profiles where id = auth.uid()
    ),
    'lastEditedAt', (
      select max(last_edited_at) from public.resumes
       where user_id = auth.uid() and deleted_at is null
    )
  );
$$;

comment on function public.get_dashboard_stats is
  'Dashboard stat cards in one round-trip. Runs under the caller''s RLS on purpose.';

revoke all on function public.get_dashboard_stats() from public;
grant execute on function public.get_dashboard_stats() to authenticated;

-- ── Trash retention ──────────────────────────────────────────────────────────
--
-- Soft-deleted resumes are recoverable for 30 days and then gone. Without this
-- the trash bin is an unbounded archive of data users believe they deleted, which
-- is a liability rather than a feature.
--
-- Service role only, invoked by a scheduled job. Takes a retention window so the
-- schedule owns the policy and changing it does not need a migration.
create or replace function public.purge_trashed_resumes(p_retention interval default '30 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with purged as (
    delete from public.resumes
     where deleted_at is not null
       and deleted_at < now() - p_retention
    returning 1
  )
  select count(*) into v_deleted from purged;

  return v_deleted;
end;
$$;

comment on function public.purge_trashed_resumes is
  'Permanently removes resumes trashed longer ago than the retention window. Service role only; intended for a scheduled job.';

revoke all on function public.purge_trashed_resumes(interval) from public;
grant execute on function public.purge_trashed_resumes(interval) to service_role;
