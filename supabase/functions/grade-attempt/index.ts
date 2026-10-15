// Supabase Edge Function — ports apps/web/src/app/api/attempts/[id]/grade/route.ts.
// Runs as the calling user (via the forwarded Authorization header), so RLS
// still applies — this function never uses the service_role key. The Groq
// API key stays server-side as a Supabase secret (`supabase secrets set
// GROQ_API_KEY=...`), never shipped to the mobile app.
//
// Deploy: npx supabase functions deploy grade-attempt

import { createClient } from "jsr:@supabase/supabase-js@2";

const GRADER_SYSTEM = `你是台灣資管所研究所入學考試的閱卷老師。根據題目與參考詳解，批改考生的申論答案。
以繁體中文回覆，只輸出 JSON（無 markdown），格式：
{"name_checks": [{"as_written": "考生寫的專有名詞", "context_clues": "上下文線索", "intended": "推斷考生指涉的正確事物，無法推斷則 null", "classification": "correct|typo|concept_error"}],
 "score": 0-10 整數, "verdict": "correct|partial|wrong",
 "got_points": [{"point": "答對的要點", "quote": "逐字複製考生答案中支持此得分點的原文片段"}],
 "missing_points": ["漏掉的得分點"], "wrong_points": ["寫錯的內容與訂正"], "feedback": "2-3 句總評與下一步建議"}

證據原則（最重要的規則）：
- 每個 got_point 的 quote 必須【逐字】取自考生答案——不可改寫、不可翻譯、不可補字。找不到原文支持的得分點不存在。
- 只評「考生實際寫了什麼」，不評「考生可能想表達什麼」。得分點的關鍵性質（遞增、由小到大、順序、方向、複雜度數值）沒有明文寫出就是沒答到，列入 missing_points。
- 逐一核對事實宣稱：考生對順序、方向、大小關係、複雜度的每一句宣稱，都要跟詳解比對。宣稱與正確答案相反或錯置（例：把中序走訪寫成「根→左→右」、把兩個東西的性質對調）→【必須】列入 wrong_points 並訂正，即使名詞本身出現在詳解裡也絕不給分。

name_checks 規則（先做這一步，再評分）：把考生答案中出現的每一個專有名詞（系統名、演算法名、人名、標準名）列出來，先填 intended（從上下文線索——機構、國家、領域、描述的性質——推斷考生想指的正確事物；推斷不出唯一答案才填 null）。
然後 classification 按以下機械式規則決定，不做其他判斷：
- 名稱寫對，或與詳解接受的名稱一致 → "correct"
- intended 非 null，且考生描述的性質符合 intended 這個事物 → 【必須】"typo"（寫錯名字但指涉正確）。typo 視同答對：按 intended 給分、列入 got_points 附訂正，【禁止】出現在 wrong_points、【禁止】因此扣分。
- intended 為 null，或考生把別的事物的性質安在這個名稱上（張冠李戴） → "concept_error"，列入 wrong_points。
注意：詳解本身使用的名稱（即使學理上可再細分，如詳解稱 Windows 為 monolithic）一律 "correct"，細節放 feedback 補充即可。

評分標準：
1. 對照詳解的得分點給分；語意對但用詞不精確可部分給分。給分錨點：先數詳解的得分點總數，score ≈ 10 ×（答到的得分點數 ÷ 總得分點數），有概念錯誤再額外扣 1-2 分。只答對一半的得分點就是 5 分上下，不要因為「方向大致正確」加分。
2. wrong_points 只能包含 name_checks 中 classification 為 "concept_error" 的名詞，以及推理／機制上的實質錯誤；"typo" 一律給分並訂正。
3. 只有結論、沒有推理，不給該點的分：申論題的分數在「為什麼」。若考生結論正確但未說明原因（例：只寫「太浪費」「比較難商用」而未解釋機制），列入 missing_points 並在 feedback 明確指出「結論對但缺推理，考場上這樣拿不到分」，說明該結論背後應寫出的機制。
4. 概念錯誤（張冠李戴、性質記反）要在 wrong_points 明確指出並給出正確版本。
5. 你是領域專家：若參考詳解本身有不精確或過度簡化之處，照詳解給分，但可在 feedback 補充更精確的說法（例：詳解稱 Windows 為 monolithic，可補充 Windows NT 嚴格而言是 hybrid kernel）。
6. 題目要求畫圖（樹、圖、UML 類別圖、狀態圖、流程圖等）時，考生在手機上只能打字：用文字表示的圖（括號巢狀如 15(11(9,14),23)、逐層列出節點、邊的列表如 a-b:3、類別名稱加屬性與方法清單、狀態→狀態的轉換列表）等同畫出圖形。依結構是否正確給分，【禁止】因為「沒有畫出圖」或格式不同而扣分。`;

const VERIFIER_SYSTEM = `你是批改結果的審核員。輸入是題目的參考詳解，以及一組「得分點＋考生原文引文」。
逐一判斷引文與該得分點的關係，verdict 三選一：
- "valid"：引文內容正確，且支撐該得分點的【核心主張】（用詞不精確、口語化、只寫到大意都算 valid，不要求完整）
- "partial"：引文內容正確、與詳解不矛盾，但只涵蓋該得分點的一部分（缺細節、缺完整列舉）——這仍算有答到，不是錯
- "wrong"：引文內容與詳解【相反】或包含錯誤事實（如順序寫反、性質對調、優缺點張冠李戴），或該得分點的核心主張在引文中完全沒有出現（例：得分點說「輸出遞增序列」，引文只說「看出排列」——「遞增」這個核心性質沒被寫出來）
注意：「不完整」不是 wrong。只有「錯誤」或「核心主張缺席」才是 wrong。
只輸出 JSON（無 markdown）：{"checks": [{"index": 0, "verdict": "valid|partial|wrong", "reason": "..."}]}，index 對應輸入順序。`;

interface GotPoint {
  point: string;
  quote?: string;
}
interface Grade {
  name_checks?: { as_written: string; classification: string }[];
  score: number;
  verdict: string;
  got_points: (GotPoint | string)[];
  missing_points: string[];
  wrong_points: string[];
  feedback: string;
}

async function callGroq(apiKey: string, messages: { role: string; content: string }[]) {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "mis-grad-exam-coach-mobile/1.0",
    },
    body: JSON.stringify({
      model: Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`grader API error (${resp.status}): ${detail.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content as string;
}

Deno.serve(async (req: Request) => {
  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });

    const { attempt_id } = await req.json();
    if (!attempt_id) return Response.json({ error: "attempt_id required" }, { status: 400 });

    // Act as the calling user — RLS still applies, so this can only ever
    // touch that user's own attempt.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: attempt, error: attemptErr } = await supabase
      .from("user_attempts")
      .select("question_id, answer_text, ai_feedback")
      .eq("id", attempt_id)
      .single();
    if (attemptErr || !attempt) return Response.json({ error: "找不到這筆作答" }, { status: 404 });

    const { data: question } = await supabase
      .from("questions")
      .select("question_text, question_type")
      .eq("id", attempt.question_id)
      .single();
    const { data: solutionRows } = await supabase
      .from("solutions")
      .select("solution_text, explanation")
      .eq("question_id", attempt.question_id)
      .limit(1);
    const solution = solutionRows?.[0];

    if (!question) return Response.json({ error: "找不到題目" }, { status: 404 });
    if (question.question_type === "multiple_choice")
      return Response.json({ error: "選擇題自動判分，無需 AI 批改" }, { status: 400 });
    if (!attempt.answer_text?.trim())
      return Response.json({ error: "沒有作答內容可批改" }, { status: 400 });
    if (!solution?.solution_text)
      return Response.json({ error: "此題尚未生成詳解（背景生成中，稍後再試）" }, { status: 400 });

    if (attempt.ai_feedback) {
      return Response.json({ grade: attempt.ai_feedback, cached: true });
    }

    // Daily per-user cap — the shared Groq free-tier quota gets exhausted
    // fast once more than one person uses grading (proven the hard way
    // tonight). RLS already scopes this count to the caller's own rows, so
    // no explicit user_id filter is needed. Adjustable without redeploying:
    // `supabase secrets set DAILY_GRADE_LIMIT=20`.
    const dailyLimit = Number(Deno.env.get("DAILY_GRADE_LIMIT") ?? "15");
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: gradedToday } = await supabase
      .from("user_attempts")
      .select("id", { count: "exact", head: true })
      .not("ai_score", "is", null)
      .gte("created_at", todayStart.toISOString());
    if ((gradedToday ?? 0) >= dailyLimit) {
      return Response.json(
        { error: `今日 AI 批改次數已達上限（${dailyLimit} 次），明天再繼續，或先用自評記錄這題` },
        { status: 429 }
      );
    }

    const userMsg = `【題目】\n${question.question_text}\n\n【參考詳解】\n${solution.solution_text}\n${solution.explanation ?? ""}\n\n【考生答案】\n${attempt.answer_text}`;

    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
    const answerNorm = norm(attempt.answer_text);
    const quoteValid = (gp: unknown) =>
      typeof gp === "object" && gp !== null &&
      typeof (gp as GotPoint).quote === "string" &&
      answerNorm.includes(norm((gp as GotPoint).quote!));

    const messages: { role: string; content: string }[] = [
      { role: "system", content: GRADER_SYSTEM },
      { role: "user", content: userMsg },
    ];

    let grade: Grade | null = null;
    let droppedPoints = 0;
    for (let attempt_n = 0; attempt_n < 2; attempt_n++) {
      const content = await callGroq(apiKey, messages);
      let parsed: Grade;
      try {
        parsed = JSON.parse(content);
      } catch {
        return Response.json({ error: "grader returned invalid JSON" }, { status: 502 });
      }
      const invalid = (parsed.got_points ?? []).filter((gp) => !quoteValid(gp));
      if (invalid.length === 0 || attempt_n === 1) {
        droppedPoints = invalid.length;
        parsed.got_points = (parsed.got_points ?? []).filter(quoteValid);
        grade = parsed;
        break;
      }
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `你上一次批改違反證據原則：以下 got_points 的 quote 不是考生答案的逐字原文（考生根本沒寫這些內容）：\n${JSON.stringify(invalid, null, 2)}\n重新批改。凡是考生沒有明文寫出的內容一律不得列入 got_points；若考生實際寫的內容與該得分點相反，改列入 wrong_points 並相應扣分。只輸出修正後的完整 JSON。`,
      });
    }
    if (!grade) return Response.json({ error: "grading failed" }, { status: 502 });

    const structured = (grade.got_points ?? []).filter(
      (gp): gp is GotPoint => typeof gp === "object" && gp !== null
    );
    if (structured.length) {
      try {
        const vcontent = await callGroq(apiKey, [
          { role: "system", content: VERIFIER_SYSTEM },
          {
            role: "user",
            content: `【參考詳解】\n${solution.solution_text}\n${solution.explanation ?? ""}\n\n【待審核的得分點】\n${JSON.stringify(
              structured.map((gp, i) => ({ index: i, point: gp.point, quote: gp.quote })),
              null, 2
            )}`,
          },
        ]);
        const checks: { index: number; verdict?: string; reason?: string }[] = JSON.parse(vcontent).checks ?? [];
        const verdictOf = (i: number) => checks.find((c) => c.index === i)?.verdict ?? "valid";
        const kept: GotPoint[] = [];
        structured.forEach((gp, i) => {
          const v = verdictOf(i);
          if (v === "wrong") {
            const reason = checks.find((c) => c.index === i)?.reason;
            grade!.wrong_points = [...(grade!.wrong_points ?? []), `${gp.point}：${reason ?? "引文內容與詳解不符"}`];
            droppedPoints += 1;
          } else {
            kept.push(v === "partial" ? { ...gp, point: `${gp.point}（部分）` } : gp);
          }
        });
        grade.got_points = kept;
      } catch (e) {
        console.error("grade verifier pass failed, keeping first-pass result:", e);
      }
    }

    const typos = (grade.name_checks ?? []).filter((n) => n.classification === "typo" && n.as_written);
    if (typos.length && Array.isArray(grade.wrong_points)) {
      grade.wrong_points = grade.wrong_points.filter((w) => !typos.some((t) => w.includes(t.as_written)));
    }

    const score = Math.max(0, Math.min(10, Math.round(Number(grade.score) || 0) - droppedPoints));
    grade.score = score;

    await supabase.from("user_attempts").update({ ai_score: score, ai_feedback: grade }).eq("id", attempt_id);

    return Response.json({ grade, cached: false });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
