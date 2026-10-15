# -*- coding: utf-8 -*-
"""Re-key multiple-choice questions whose answer was forced to a single letter.

generate_draft_solutions.py used to ask for exactly one option and truncate
to the first letter, so "Select all that apply" questions were stored with a
wrong single-letter key and a wrong solution. This job re-solves candidates
with two independent models (Gemini + Groq) and only trusts answers they agree
on; disagreements are left for a human to decide.

Two phases, so what gets written is exactly what was reviewed:
  python -m pipeline.jobs.fix_multi_select --plan PLAN.json
      dry run: query both models, save the plan, print a summary, write nothing
  python -m pipeline.jobs.fix_multi_select --plan PLAN.json --apply [--set 386=A,C ...]
      write agreed answers (+ any --set overrides) to SQLite and Supabase

Requires supabase/migrations/005_question_flags.sql to be applied first.
"""
import argparse
import json
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from pipeline.jobs.generate_draft_solutions import (
    MC_SYSTEM,
    ensure_question_flag_columns,
    llm,
    parse_mc_answer,
    repair_json,
)

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "questions.db"
GEMINI_MODEL = "gemini-3.8-flash"
GROQ_MODEL = "openai/gpt-oss-120b"
MULTI_SIGNAL = re.compile(
    r"複選|多選|選出所有|全部正確|哪些(是|為)?正確|which of the following (are|statements are)"
    r"|select all|choose all|all that apply|more than one",
    re.I,
)
SUBJECT = {"CS": "計算機概論", "DS": "資料結構", "MIS": "管理資訊系統"}


def read_env(path: Path) -> dict:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def groq(key: str, system: str, user: str) -> dict:
    body = {
        "model": GROQ_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    for attempt in range(6):
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "mis-grad-exam-coach/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return repair_json(json.load(r)["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
                wait = min(int(e.headers.get("retry-after") or 2 ** (attempt + 2)) + 2, 300)
                print(f"    groq HTTP {e.code}, retry in {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("groq failed after retries")


OPENROUTER_FREE_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"


def openrouter_free(key: str, system: str, user: str) -> dict:
    body = {
        "model": OPENROUTER_FREE_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        out = repair_json(json.load(r)["choices"][0]["message"]["content"])
    # some free models double-escape newlines inside JSON strings
    if isinstance(out.get("solution_text"), str):
        out["solution_text"] = out["solution_text"].replace("\\n", "\n")
    return out


def free_llm(env_web: dict, env_root: dict, system: str, user: str) -> dict:
    """Free sources only (CURRENT_STATUS.md 6.2.4): Gemini free key, then
    OpenRouter free models. Never falls through to a paid key."""
    try:
        return llm(env_web["GEMINI_API_KEY"], system, user, model=GEMINI_MODEL, attempts=2)
    except Exception as e:
        print(f"    gemini free unavailable ({e}); using OpenRouter free model", flush=True)
        return openrouter_free(env_root["OPENROUTER_API_KEY"], system, user)


def prompt_for(row) -> tuple[str, list[str]]:
    _qid, qtext, options, topic, year, school = row
    opts = json.loads(options)
    letters = [chr(65 + i) for i in range(len(opts))]
    origin = f"{year} 學年中央資管所" if school == "NCU" else "範本題"
    user = f"【{origin} {SUBJECT.get(topic, topic)}】\n{qtext}\n\n選項：\n" + "\n".join(
        f"({l}) {o}" for l, o in zip(letters, opts)
    )
    return user, letters


def answer_label(picked: list[str], multi: bool) -> str:
    return "".join(f"({p})" for p in picked) + ("（複選）" if multi else "")


def dry_run(args, conn, env_web) -> None:
    rows = conn.execute(
        """SELECT id, question_text, options, topic, exam_year, school FROM questions
           WHERE question_type = 'multiple_choice' AND options IS NOT NULL ORDER BY id"""
    ).fetchall()
    ids = {int(x) for x in args.ids.split(",")} if args.ids else None
    rows = [r for r in rows if (r[0] in ids if ids else MULTI_SIGNAL.search(r[1] or ""))]
    print(f"{len(rows)} candidate questions", flush=True)

    plan = []
    for row in rows:
        qid = row[0]
        user, letters = prompt_for(row)
        if args.hint:
            user += f"\n\n（{args.hint}）"
        current = conn.execute("SELECT correct_option FROM questions WHERE id = ?", (qid,)).fetchone()[0]
        try:
            g = llm(env_web["GEMINI_API_KEY"], MC_SYSTEM, user, model=GEMINI_MODEL)
            q = groq(env_web["GROQ_API_KEY"], MC_SYSTEM, user)
        except Exception as e:  # one flaky question must not lose the rest of the plan
            print(f"  q{qid} ERROR {e}", flush=True)
            plan.append({"id": qid, "question": (row[1] or "")[:160], "current_key": current, "agree": False, "error": str(e)})
            continue
        gp, qp = parse_mc_answer(g, letters), parse_mc_answer(q, letters)
        agree = bool(gp and qp and gp[0] == qp[0])
        multi = bool(gp and qp and (gp[1] or qp[1]))
        plan.append({
            "id": qid,
            "question": (row[1] or "")[:160],
            "current_key": current,
            "gemini": {"options": gp[0] if gp else None, "multi": gp[1] if gp else None, "confidence": g.get("confidence")},
            "groq": {"options": qp[0] if qp else None, "multi": qp[1] if qp else None, "confidence": q.get("confidence")},
            "agree": agree,
            "proposed_key": ",".join(gp[0]) if agree else None,
            "proposed_multi": multi if agree else None,
            "solution_text": f"正確答案：{answer_label(gp[0], multi)}\n{g.get('solution_text', '').strip()}" if agree else None,
            "explanation": "AI 判斷（Gemini 與 Groq 兩個模型答案一致）" if agree else None,
        })
        tag = "AGREE " if agree else "DIFFER"
        print(f"  q{qid} {tag} current={current} gemini={gp} groq={qp}", flush=True)
        Path(args.plan).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(1)

    Path(args.plan).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nplan saved to {args.plan}: {sum(p['agree'] for p in plan)} agree, "
          f"{sum(not p['agree'] for p in plan)} need a human decision")


def supabase_patch(env_root: dict, table: str, query: str, body: dict) -> int:
    req = urllib.request.Request(
        f"{env_root['SUPABASE_URL']}/rest/v1/{table}?{query}",
        data=json.dumps(body).encode(),
        method="PATCH",
        headers={
            "apikey": env_root["SUPABASE_SECRET_KEY"],
            "Authorization": f"Bearer {env_root['SUPABASE_SECRET_KEY']}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return len(json.load(r))


def supabase_insert(env_root: dict, table: str, body: dict) -> int:
    req = urllib.request.Request(
        f"{env_root['SUPABASE_URL']}/rest/v1/{table}",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "apikey": env_root["SUPABASE_SECRET_KEY"],
            "Authorization": f"Bearer {env_root['SUPABASE_SECRET_KEY']}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return len(json.load(r))


def apply(args, conn, env_web, env_root) -> None:
    plan = {p["id"]: p for p in json.loads(Path(args.plan).read_text(encoding="utf-8"))}

    # human decisions for disagreements: --set 386=A,C  (solution regenerated with that answer)
    for item in args.set or []:
        qid_s, keys = item.split("=", 1)
        qid = int(qid_s)
        row = conn.execute(
            "SELECT id, question_text, options, topic, exam_year, school FROM questions WHERE id = ?", (qid,)
        ).fetchone()
        user, letters = prompt_for(row)
        picked = sorted({k.strip().upper() for k in keys.split(",") if k.strip()})
        assert picked and all(p in letters for p in picked), f"bad --set for q{qid}: {keys}"
        multi = bool(args.multi_for_set) or len(picked) > 1
        out = free_llm(
            env_web, env_root, MC_SYSTEM,
            user + f"\n\n（已確認正確答案為 {answer_label(picked, multi)}，請依此撰寫詳解，使用繁體中文。）",
        )
        plan[qid] = {
            **plan.get(qid, {"id": qid}),
            "agree": True,
            "proposed_key": ",".join(picked),
            "proposed_multi": multi,
            "solution_text": f"正確答案：{answer_label(picked, multi)}\n{out.get('solution_text', '').strip()}",
            "explanation": "答案經人工確認，詳解由 AI 撰寫",
        }

    todo = [p for p in plan.values() if p.get("agree")]
    print(f"applying {len(todo)} questions", flush=True)
    for p in todo:
        qid, key, multi = p["id"], p["proposed_key"], bool(p["proposed_multi"])
        conn.execute("UPDATE questions SET correct_option = ?, is_multi_select = ? WHERE id = ?", (key, int(multi), qid))
        cur = conn.execute("UPDATE solutions SET solution_text = ?, explanation = ? WHERE question_id = ?",
                           (p["solution_text"], p["explanation"], qid))
        if cur.rowcount == 0:  # some questions never had a solution (e.g. no answer key at all)
            conn.execute(
                """INSERT INTO solutions (question_id, solution_text, explanation, source_type, verified_status)
                   VALUES (?, ?, ?, 'ai_draft', 'ai_draft')""",
                (qid, p["solution_text"], p["explanation"]),
            )
        nq = supabase_patch(env_root, "questions", f"id=eq.{qid}", {"correct_option": key, "is_multi_select": multi})
        sol = {"solution_text": p["solution_text"], "explanation": p["explanation"]}
        ns = supabase_patch(env_root, "solutions", f"question_id=eq.{qid}", sol)
        if ns == 0:
            ns = supabase_insert(env_root, "solutions",
                                 {"question_id": qid, **sol, "source_type": "ai_draft", "verified_status": "ai_draft"})
        if nq != 1 or ns < 1:
            raise RuntimeError(f"q{qid}: unexpected supabase row counts questions={nq} solutions={ns}")
        conn.commit()
        print(f"  q{qid} -> {key} multi={multi} (supabase rows: questions={nq}, solutions={ns})", flush=True)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--ids", default="", help="comma-separated ids instead of auto-detect")
    ap.add_argument("--hint", default="", help="extra context from the original paper, e.g. 本題為複選題")
    ap.add_argument("--set", action="append", help="human answer for a question, e.g. 386=A,C")
    ap.add_argument("--multi-for-set", action="store_true", help="treat --set answers as multi-select even if one letter")
    args = ap.parse_args()

    env_web = read_env(ROOT / "apps" / "web" / ".env.local")
    env_root = read_env(ROOT / ".env")
    conn = sqlite3.connect(DB)
    if args.apply:
        ensure_question_flag_columns(conn)
        apply(args, conn, env_web, env_root)
    else:
        dry_run(args, conn, env_web)
    conn.close()


if __name__ == "__main__":
    main()
