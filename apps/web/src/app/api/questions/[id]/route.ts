import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: question, error } = await supabase
    .from("questions")
    .select(`
      *,
      school:schools(id, code, name_zh),
      subject:subjects(id, code, name_zh),
      solutions(id, solution_text, explanation, source_type, verified_status)
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(question);
}
