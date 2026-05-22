import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const supabase = await createClient();

  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const from = (page - 1) * limit;

  let query = supabase
    .from("questions")
    .select(`
      id, year_label, question_number, question_text, question_type,
      topic, subtopic, difficulty, value_score, verified_status,
      school:schools(id, code, name_zh),
      subject:subjects(id, code, name_zh)
    `, { count: "exact" });

  const school = searchParams.get("school");
  if (school) {
    const { data: s } = await supabase.from("schools").select("id").eq("code", school).single();
    if (s) query = query.eq("school_id", s.id);
  }

  const subject = searchParams.get("subject");
  if (subject) {
    const { data: sub } = await supabase.from("subjects").select("id").eq("code", subject).single();
    if (sub) query = query.eq("subject_id", sub.id);
  }

  const topic = searchParams.get("topic");
  if (topic) query = query.ilike("topic", `%${topic}%`);

  const year = searchParams.get("year");
  if (year) query = query.eq("year_label", `${year}學年度`);

  const minScore = searchParams.get("min_value_score");
  if (minScore) query = query.gte("value_score", parseFloat(minScore));

  const { data, error, count } = await query
    .order("value_score", { ascending: false })
    .range(from, from + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data, page, limit, total: count ?? 0 });
}
