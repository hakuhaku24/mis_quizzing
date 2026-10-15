-- Students report problems with a question (wrong answer key, wrong solution,
-- garbled text, missing figure). Reviewed by the developer in the Supabase
-- dashboard or via a script; status tracks what was done about it.
--
-- user_id cascades from auth.users, so deleting an account (delete-account
-- Edge Function) removes that person's reports without any extra code.

create table question_reports (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_id  bigint not null references questions(id) on delete cascade,
  attempt_id   bigint references user_attempts(id) on delete set null,
  reason       text not null check (reason in ('answer_key', 'solution', 'question_text', 'figure', 'other')),
  note         text check (char_length(note) <= 1000),
  status       text not null default 'open' check (status in ('open', 'fixed', 'rejected')),
  created_at   timestamptz not null default now()
);

create index question_reports_question_id_idx on question_reports (question_id);

alter table question_reports enable row level security;

create policy "users file their own reports" on question_reports
  for insert to authenticated with check (user_id = auth.uid());

create policy "users see their own reports" on question_reports
  for select to authenticated using (user_id = auth.uid());
