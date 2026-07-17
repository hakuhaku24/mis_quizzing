import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) as cnt FROM questions").get() as { cnt: number }).cnt;
  const byTopic = db
    .prepare("SELECT topic, COUNT(*) as cnt FROM questions GROUP BY topic ORDER BY cnt DESC")
    .all() as { topic: string; cnt: number }[];
  const bySource = db
    .prepare("SELECT source_type, COUNT(*) as cnt FROM questions GROUP BY source_type")
    .all() as { source_type: string; cnt: number }[];
  const byYear = db
    .prepare("SELECT year_label, COUNT(*) as cnt FROM questions WHERE year_label != '範本題' GROUP BY year_label ORDER BY year_label DESC")
    .all() as { year_label: string; cnt: number }[];

  return NextResponse.json({ total, byTopic, bySource, byYear });
}
