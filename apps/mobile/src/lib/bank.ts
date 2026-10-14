import { supabase } from "./supabase";
import type { AttemptOutcome } from "./labels";
import type { Question } from "./types";

export interface BankItem extends Question {
  last_attempt: AttemptOutcome | null;
}

export interface BankFilters {
  school: "all" | "real" | "template";
  topic: "all" | "CS" | "DS" | "MIS" | "STAT";
  examYear: number | "all";
  concept: string | "all";
}

const PAGE_SIZE = 20;
const MAX_CONCEPT_CHIPS = 10;

/** Latest attempt per question (RLS limits rows to the current user). */
export async function getLatestAttempts(questionIds: number[]): Promise<Map<number, AttemptOutcome>> {
  const latest = new Map<number, AttemptOutcome>();
  if (!questionIds.length) return latest;
  const { data } = await supabase
    .from("user_attempts")
    .select("question_id, is_correct, ai_score, self_assessment")
    .in("question_id", questionIds)
    .order("created_at", { ascending: false });
  for (const a of data ?? []) {
    if (!latest.has(a.question_id)) latest.set(a.question_id, a);
  }
  return latest;
}

export async function getBankYears(): Promise<number[]> {
  const { data } = await supabase
    .from("questions")
    .select("exam_year")
    .not("exam_year", "is", null)
    .order("exam_year", { ascending: false });
  return [...new Set((data ?? []).map((r) => r.exam_year as number))];
}

/** Concept tags for a given topic, most-used first (capped — the long tail
 *  of 1-2-count tags isn't worth a chip). "all" topic returns none: concepts
 *  only make sense once you've narrowed to one subject. */
export async function getBankConcepts(topic: BankFilters["topic"]): Promise<string[]> {
  if (topic === "all") return [];
  const { data } = await supabase.from("questions").select("concepts").eq("topic", topic);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    for (const c of (row.concepts as string[] | null) ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CONCEPT_CHIPS)
    .map(([c]) => c);
}

export async function getBankPage(
  filters: BankFilters,
  page: number
): Promise<{ items: BankItem[]; hasMore: boolean }> {
  let query = supabase
    .from("questions")
    .select("id, school, topic, subtopic, year_label, exam_year, question_number, question_text, question_type, difficulty, concepts, options, correct_option");

  if (filters.school === "real") query = query.neq("school", "template");
  else if (filters.school === "template") query = query.eq("school", "template");

  if (filters.topic !== "all") query = query.eq("topic", filters.topic);
  if (filters.examYear !== "all") query = query.eq("exam_year", filters.examYear);
  if (filters.concept !== "all") query = query.contains("concepts", [filters.concept]);

  const from = page * PAGE_SIZE;
  const { data, error } = await query
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE); // fetch one extra to know if there's a next page

  if (error) throw error;
  const questions = (data ?? []).slice(0, PAGE_SIZE) as Question[];

  const latest = await getLatestAttempts(questions.map((q) => q.id));
  const items = questions.map((q) => ({ ...q, last_attempt: latest.get(q.id) ?? null }));
  return { items, hasMore: (data ?? []).length > PAGE_SIZE };
}
