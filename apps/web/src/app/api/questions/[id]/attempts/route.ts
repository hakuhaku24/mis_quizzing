import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const { answer_text, selected_option, time_spent_seconds } = body;
  // For MVP, use a fixed demo user_id
  const user_id = body.user_id ?? "00000000-0000-0000-0000-000000000001";

  const { data: attempt, error } = await supabase
    .from("user_attempts")
    .insert({ question_id: id, user_id, answer_text, selected_option, time_spent_seconds })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Upsert user_question_state
  await supabase.from("user_question_states").upsert({
    user_id,
    question_id: id,
    status: "learning",
    last_attempt_at: new Date().toISOString(),
  }, { onConflict: "user_id,question_id" });

  return NextResponse.json(attempt, { status: 201 });
}
