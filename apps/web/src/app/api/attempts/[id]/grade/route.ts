import { NextRequest, NextResponse } from "next/server";
import { getWriteDb } from "@/lib/db";
import type { AiGrade } from "@/lib/types";

const GRADER_SYSTEM = `你是台灣資管所研究所入學考試的閱卷老師。根據題目與參考詳解，批改考生的申論答案。
以繁體中文回覆，只輸出 JSON（無 markdown），格式：
{"score": 0-10 整數, "verdict": "correct|partial|wrong", "got_points": ["答對的要點"], "missing_points": ["漏掉的得分點"], "wrong_points": ["寫錯的內容與訂正"], "feedback": "2-3 句總評與下一步建議"}

評分標準：
1. 對照詳解的得分點給分；語意對但用詞不精確可部分給分。
2. 【強制檢查】在把任何內容列入 wrong_points 之前，先逐一檢查：這是「概念錯誤」還是「拼寫錯誤」？專有名詞拼錯、記錯一兩個字母，但從上下文線索（機構名、國家、領域、描述的性質）能唯一推斷出考生指的是哪個正確事物時，這是拼寫錯誤，【必須】列入 got_points 給分，並在該條目內附上訂正（例：考生寫「卡內基大學的 bach OS」→ 卡內基美隆大學做的微核心就是 Mach，拼成 bach，應寫入 got_points：「舉出 microkernel 代表 Mach（拼寫訂正：bach → Mach）」，禁止列入 wrong_points）。只有考生指涉的事物本身錯誤（張冠李戴）才算概念錯誤。
3. 只有結論、沒有推理，不給該點的分：申論題的分數在「為什麼」。若考生結論正確但未說明原因（例：只寫「太浪費」「比較難商用」而未解釋機制），列入 missing_points 並在 feedback 明確指出「結論對但缺推理，考場上這樣拿不到分」，說明該結論背後應寫出的機制。
4. 概念錯誤（張冠李戴、性質記反）要在 wrong_points 明確指出並給出正確版本。
5. 你是領域專家：若參考詳解本身有不精確或過度簡化之處，照詳解給分，但可在 feedback 補充更精確的說法（例：詳解稱 Windows 為 monolithic，可補充 Windows NT 嚴格而言是 hybrid kernel）。`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const force = (await req.json().catch(() => ({})))?.force === true;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const db = getWriteDb();
  try {
    const row = db
      .prepare(
        `SELECT a.answer_text, a.ai_feedback, q.question_text, q.question_type,
                s.solution_text, s.explanation
         FROM user_attempts a
         JOIN questions q ON q.id = a.question_id
         LEFT JOIN solutions s ON s.question_id = q.id
         WHERE a.id = ?`
      )
      .get(id) as
      | {
          answer_text: string | null;
          ai_feedback: string | null;
          question_text: string;
          question_type: string | null;
          solution_text: string | null;
          explanation: string | null;
        }
      | undefined;

    if (!row) return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    if (row.question_type === "multiple_choice")
      return NextResponse.json({ error: "MC questions are auto-graded" }, { status: 400 });
    if (!row.answer_text?.trim())
      return NextResponse.json({ error: "no answer to grade" }, { status: 400 });
    if (!row.solution_text)
      return NextResponse.json({ error: "question has no solution to grade against" }, { status: 400 });

    // Already graded → return the stored grade instead of paying again (unless force)
    if (row.ai_feedback && !force) {
      return NextResponse.json({ grade: JSON.parse(row.ai_feedback) as AiGrade, cached: true });
    }

    const userMsg = `【題目】\n${row.question_text}\n\n【參考詳解】\n${row.solution_text}\n${row.explanation ?? ""}\n\n【考生答案】\n${row.answer_text}`;

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "mis-grad-exam-coach/1.0",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: GRADER_SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json(
        { error: `grader API error (${resp.status})`, detail: detail.slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await resp.json();
    let grade: AiGrade;
    try {
      grade = JSON.parse(data.choices[0].message.content);
    } catch {
      return NextResponse.json({ error: "grader returned invalid JSON" }, { status: 502 });
    }
    const score = Math.max(0, Math.min(10, Math.round(Number(grade.score) || 0)));
    grade.score = score;

    db.prepare("UPDATE user_attempts SET ai_score = ?, ai_feedback = ? WHERE id = ?").run(
      score,
      JSON.stringify(grade),
      id
    );

    return NextResponse.json({ grade, cached: false });
  } finally {
    db.close();
  }
}
