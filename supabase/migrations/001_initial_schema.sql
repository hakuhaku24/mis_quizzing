-- 001_initial_schema.sql

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- schools
create table schools (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_zh text not null,
  name_en text,
  created_at timestamptz default now()
);

-- departments
create table departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  name_zh text not null,
  group_name text,
  degree_level text default 'master',
  created_at timestamptz default now()
);

-- subjects
create table subjects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_zh text not null,
  name_en text
);

-- exam_assets: 原始 PDF / HTML / 圖片資源
create table exam_assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id),
  department_id uuid references departments(id),
  subject_id uuid references subjects(id),
  year_label text not null,
  exam_year int,
  source_url text not null,
  asset_url text,
  storage_path text,
  sha256_hash text,
  mime_type text,
  fetch_strategy text,
  extraction_status text default 'pending',
  legal_status text default 'public_exam_question_only',
  downloaded_at timestamptz,
  created_at timestamptz default now()
);

-- questions
create table questions (
  id uuid primary key default gen_random_uuid(),
  exam_asset_id uuid references exam_assets(id),
  school_id uuid references schools(id),
  department_id uuid references departments(id),
  subject_id uuid references subjects(id),
  year_label text,
  question_number text,
  question_text text not null,
  question_type text,          -- essay / multiple_choice / short_answer / calculation
  topic text,
  subtopic text,
  difficulty int check (difficulty between 1 and 5),
  estimated_time_minutes int,
  value_score numeric,
  value_score_reason text,
  extraction_confidence numeric,
  verified_status text default 'unverified',
  source_page_start int,
  source_page_end int,
  embedding vector(1536),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- solutions
create table solutions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  solution_text text not null,
  explanation text,
  source_type text not null,   -- ai_draft / human_written / human_verified / teacher_verified / official_if_available
  verified_status text default 'ai_draft',
  confidence numeric,
  created_by uuid,
  created_at timestamptz default now()
);

-- user_attempts
create table user_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question_id uuid references questions(id),
  answer_text text,
  selected_option text,
  is_correct boolean,
  score numeric,
  time_spent_seconds int,
  feedback text,
  created_at timestamptz default now()
);

-- user_question_states
create table user_question_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question_id uuid references questions(id),
  status text default 'new',   -- new / learning / wrong / reviewing / mastered / skipped
  last_attempt_at timestamptz,
  next_review_at timestamptz,
  mastery_score numeric default 0,
  wrong_count int default 0,
  correct_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, question_id)
);

-- indexes
create index questions_school_id_idx on questions(school_id);
create index questions_subject_id_idx on questions(subject_id);
create index questions_topic_idx on questions(topic);
create index questions_value_score_idx on questions(value_score desc);
create index questions_verified_status_idx on questions(verified_status);
create index user_attempts_user_id_idx on user_attempts(user_id);
create index user_question_states_user_id_idx on user_question_states(user_id);
create index exam_assets_school_id_idx on exam_assets(school_id);
