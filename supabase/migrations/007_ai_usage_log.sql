-- One row per PAID AI call (the Gemini fallback used when Groq's free quota
-- is exhausted or Groq fails), so the developer can see when and how much
-- paid usage happens. Deliberately has no user id: nothing personal is kept.
-- RLS is on with no policies, so only the service role (Edge Functions,
-- dashboard) can read or write it.

create table ai_usage_log (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  purpose          text not null,            -- grade | regrade | verify
  provider         text not null,            -- gemini
  model            text not null,
  prompt_tokens    int,
  output_tokens    int,                      -- includes thinking tokens (billed as output)
  est_cost_usd     numeric(10, 6),
  fallback_reason  text                      -- why the free provider was skipped
);

create index ai_usage_log_created_at_idx on ai_usage_log (created_at);

alter table ai_usage_log enable row level security;
