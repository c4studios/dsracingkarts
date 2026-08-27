-- Webhook idempotency.
--
-- Square retries webhooks for up to 72 hours, at-least-once. The handler as
-- written on 27 Aug 2026 is safe to replay: it performs only updates and
-- upserts, with no inserts, emails or increments. That is a property of the
-- current code rather than a guarantee, so record event ids and skip replays
-- before anyone adds a side effect that is not replay-safe.
--
-- NOT YET APPLIED. Run this in the Supabase SQL editor (the MCP connection
-- used during the 27 Aug audit did not have DDL permission), then wire the
-- dedupe into src/app/api/webhooks/square/route.ts.

create table if not exists public.webhook_events (
  event_id    text primary key,
  provider    text not null default 'square',
  event_type  text,
  received_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_received_at
  on public.webhook_events (received_at desc);

-- Service-role only. RLS on with no policy denies anon and authenticated
-- outright; the webhook handler uses the service client, which bypasses RLS.
alter table public.webhook_events enable row level security;
