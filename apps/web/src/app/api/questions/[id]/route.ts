import { NextRequest, NextResponse } from "next/server";
import { getDb, QuestionWithSolutions } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const question = db
    .prepare("SELECT * FROM questions WHERE id = ?")
    .get(id);

  if (!question) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const solutions = db
    .prepare("SELECT * FROM solutions WHERE question_id = ?")
    .all(id);

  return NextResponse.json({ ...(question as object), solutions } as QuestionWithSolutions);
}
