import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
  const offset = (page - 1) * limit;

  const db = getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  const school = searchParams.get("school");
  if (school) { conditions.push("school = ?"); params.push(school); }

  const topic = searchParams.get("topic");
  if (topic) { conditions.push("topic LIKE ?"); params.push(`%${topic}%`); }

  const concept = searchParams.get("concept");
  if (concept) {
    conditions.push("EXISTS (SELECT 1 FROM json_each(questions.concepts) WHERE json_each.value = ?)");
    params.push(concept);
  }

  const year = searchParams.get("year");
  if (year) { conditions.push("year_label = ?"); params.push(`${year}學年度`); }

  const minScore = searchParams.get("min_value_score");
  if (minScore) { conditions.push("value_score >= ?"); params.push(parseFloat(minScore)); }

  const sourceType = searchParams.get("source_type");
  if (sourceType) { conditions.push("source_type = ?"); params.push(sourceType); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total: number = (
    db.prepare(`SELECT COUNT(*) as cnt FROM questions ${where}`).get(...params) as { cnt: number }
  ).cnt;

  const items = db
    .prepare(`SELECT * FROM questions ${where} ORDER BY value_score DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  return NextResponse.json({ items, page, limit, total });
}
