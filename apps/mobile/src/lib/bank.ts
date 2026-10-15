import { supabase } from "./supabase";
import { fetchAll } from "./fetchAll";
import type { AttemptOutcome } from "./labels";
import type { Question } from "./types";

export interface BankItem extends Question {
  last_attempt: AttemptOutcome | null;
}

export interface BankFilters {
  school: "all" | "real" | "template";
  /** a specific school code (e.g. "NTU") when filtering real exam questions */
  schoolCode: string | "all";
  topic: "all" | "CS" | "DS" | "MIS" | "STAT";
  examYear: number | "all";
  concept: string | "all";
}

const SCHOOL_ORDER = ["NTU", "NTHU", "NYCU", "NCKU", "NCCU", "NCU"]; // 臺清交成政, then 中央

/** Schools that have real exam questions in the bank, 臺清交成政 order first. */
export async function getBankSchools(): Promise<string[]> {
  const rows = await fetchAll<{ school: string }>((from, to) =>
    supabase.from("questions").select("school").neq("school", "template").not("school", "is", null)
      .order("id").range(from, to).returns<{ school: string }[]>()
  );
  const rank = (s: string) => (SCHOOL_ORDER.includes(s) ? SCHOOL_ORDER.indexOf(s) : SCHOOL_ORDER.length);
  return [...new Set(rows.map((r) => r.school))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
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

export async function getBankYears(schoolCode: string | "all" = "all"): Promise<number[]> {
  const rows = await fetchAll<{ exam_year: number }>((from, to) => {
    let q = supabase.from("questions").select("exam_year").not("exam_year", "is", null);
    if (schoolCode !== "all") q = q.eq("school", schoolCode);
    return q.order("id").range(from, to).returns<{ exam_year: number }[]>();
  });
  return [...new Set(rows.map((r) => r.exam_year))].sort((a, b) => b - a);
}

/** Concept tags for a given topic, most-used first (capped — the long tail
 *  of 1-2-count tags isn't worth a chip). "all" topic returns none: concepts
 *  only make sense once you've narrowed to one subject. */
export async function getBankConcepts(topic: BankFilters["topic"]): Promise<string[]> {
  if (topic === "all") return [];
  const rows = await fetchAll<{ concepts: string[] | null }>((from, to) =>
    supabase.from("questions").select("concepts").eq("topic", topic).order("id").range(from, to)
      .returns<{ concepts: string[] | null }[]>()
  );
  const counts = new Map<string, number>();
  for (const row of rows) {
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
  if (filters.school === "real" && filters.schoolCode !== "all") query = query.eq("school", filters.schoolCode);

  if (filters.topic !== "all") query = query.eq("topic", filters.topic);
  if (filters.examYear !== "all") query = query.eq("exam_year", filters.examYear);
  // concepts is jsonb: containment needs a JSON array; a JS array is sent as a
  // Postgres array literal ({...}) and the request fails with 22P02
  if (filters.concept !== "all") query = query.contains("concepts", JSON.stringify([filters.concept]));

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
