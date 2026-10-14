-- Average 考前準備度 across all placed users, for the "所有使用者的平均" line.
--
-- Scoring MUST match apps/mobile/src/lib/scoring.ts (attemptScore,
-- latestScores, readiness): MC correctness, else self-assessment
-- (overrides AI), else ai_score/10; each question counts once via its latest
-- scored attempt; a user counts once they have >= 5 scored questions.
--
-- SECURITY DEFINER so it can aggregate past RLS, but it only ever returns a
-- single rounded average, and nothing until >= 10 users are placed, so no one
-- can back out another user's score from it.

create or replace function public.readiness_average()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select
      user_id,
      question_id,
      created_at,
      case
        when is_correct is not null then case when is_correct then 1.0 else 0.0 end
        when self_assessment = 'correct' then 1.0
        when self_assessment = 'partial' then 0.5
        when self_assessment = 'wrong' then 0.0
        when ai_score is not null then ai_score / 10.0
      end as score
    from user_attempts
  ),
  latest as (
    select distinct on (user_id, question_id) user_id, score
    from scored
    where score is not null
    order by user_id, question_id, created_at desc
  ),
  per_user as (
    select avg(score) as readiness
    from latest
    group by user_id
    having count(*) >= 5
  )
  select case when count(*) >= 10 then round(avg(readiness) * 100)::integer end
  from per_user;
$$;

revoke all on function public.readiness_average() from public;
revoke all on function public.readiness_average() from anon;
grant execute on function public.readiness_average() to authenticated;
