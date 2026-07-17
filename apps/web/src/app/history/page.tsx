"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const TOPIC_LABELS: Record<string, string> = {
  MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論", STAT: "統計學",
};

interface Attempt {
  id: number;
  question_id: number;
  question_text: string;
  question_type: string;
  topic: string;
  subtopic: string | null;
  answer_text: string | null;
  selected_option: string | null;
  correct_option: string | null;
  is_correct: number | null;
  self_assessment: string | null;
  time_spent_seconds: number | null;
  created_at: string;
  difficulty: number | null;
}

function formatDate(s: string) {
  const d = new Date(s.includes("T") ? s : s + "Z");
  return d.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ResultBadge({ attempt: a }: { attempt: Attempt }) {
  const isMC = a.question_type === "multiple_choice";
  if (isMC) {
    if (a.is_correct === 1) return <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">答對</span>;
    if (a.is_correct === 0) return <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full shrink-0">答錯</span>;
  } else {
    if (a.self_assessment === "correct") return <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">完全懂</span>;
    if (a.self_assessment === "partial")  return <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full shrink-0">部分懂</span>;
    if (a.self_assessment === "wrong")    return <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full shrink-0">答錯</span>;
  }
  return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">未評</span>;
}

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback((p: number, t: string) => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(p) });
    if (t) qs.set("topic", t);
    fetch(`/api/history?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setAttempts(d.items ?? []);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 0);
        setPage(d.page ?? p);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => { load(1, topic); }, [topic, load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">答題記錄</h1>
          {!loading && <p className="text-sm text-gray-400 mt-0.5">共 {total} 筆</p>}
        </div>
        <div className="flex gap-2">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">所有科目</option>
            {Object.entries(TOPIC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Link href="/analytics" className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            弱點分析
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">載入中…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">
          載入失敗：{error}
        </div>
      ) : attempts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>尚無答題記錄。</p>
          <Link href="/questions" className="text-blue-600 underline text-sm mt-2 inline-block">去答題</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {attempts.map((a) => {
            const open = expanded === a.id;
            return (
              <div key={a.id} className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setExpanded(open ? null : a.id)}
                      className="text-left text-sm text-gray-800 hover:text-blue-600 line-clamp-2 w-full"
                    >
                      {a.question_text}
                    </button>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">{TOPIC_LABELS[a.topic] ?? a.topic}</span>
                      {a.subtopic && <span className="text-xs text-gray-400">· {a.subtopic}</span>}
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatDate(a.created_at)}</span>
                      {a.time_spent_seconds != null && (
                        <span className="text-xs text-gray-400">· {a.time_spent_seconds}s</span>
                      )}
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">
                        {a.question_type === "multiple_choice" ? "選擇題" :
                         a.question_type === "essay" ? "申論" : "簡答"}
                      </span>
                    </div>
                  </div>
                  <ResultBadge attempt={a} />
                </div>

                {open && (
                  <div className="pl-0 space-y-2 pt-1">
                    {a.question_type === "multiple_choice" ? (
                      <div className="text-sm">
                        <span className="text-gray-500">你的答案：</span>
                        <span className={a.is_correct === 1 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                          {a.selected_option}
                        </span>
                        {a.is_correct === 0 && (
                          <span className="text-gray-500"> · 正確：<span className="text-green-700 font-semibold">{a.correct_option}</span></span>
                        )}
                      </div>
                    ) : (
                      a.answer_text && (
                        <div className="text-sm">
                          <p className="text-gray-400 text-xs mb-1">你的作答：</p>
                          <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 text-xs leading-relaxed">
                            {a.answer_text}
                          </p>
                        </div>
                      )
                    )}
                    <Link
                      href={`/questions/${a.question_id}`}
                      className="text-xs text-blue-600 hover:underline inline-block"
                    >
                      查看詳解 →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1, topic)}
            disabled={page <= 1}
            className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← 上一頁
          </button>
          <span className="text-sm text-gray-400">{page} / {pages}</span>
          <button
            onClick={() => load(page + 1, topic)}
            disabled={page >= pages}
            className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            下一頁 →
          </button>
        </div>
      )}
    </div>
  );
}
