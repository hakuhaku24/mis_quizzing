"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Question } from "@/lib/types";

const SCHOOLS = ["NCKU", "NCCU", "template"];
const TOPICS = [
  { code: "MIS",  label: "管理資訊系統" },
  { code: "DS",   label: "資料結構" },
  { code: "CS",   label: "計算機概論" },
  { code: "STAT", label: "統計學" },
];
const GRADES = [
  { label: "全部", min: 0 },
  { label: "S (0.85+)", min: 0.85 },
  { label: "A (0.75+)", min: 0.75 },
  { label: "B (0.65+)", min: 0.65 },
];

function gradeLabel(score: number | null) {
  if (score == null) return null;
  if (score >= 0.85) return { label: "S", cls: "bg-purple-100 text-purple-700" };
  if (score >= 0.75) return { label: "A", cls: "bg-blue-100 text-blue-700" };
  if (score >= 0.65) return { label: "B", cls: "bg-green-100 text-green-700" };
  return { label: "C", cls: "bg-yellow-100 text-yellow-700" };
}

const TOPIC_LABELS: Record<string, string> = {
  MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論", STAT: "統計學",
};

interface PageData { items: Question[]; total: number; page: number; limit: number }

export default function QuestionsPage() {
  const [data, setData]         = useState<PageData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [school, setSchool]     = useState("");
  const [topic, setTopic]       = useState("");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage]         = useState(1);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (school)   p.set("school", school);
    if (topic)    p.set("topic", topic);
    if (minScore) p.set("min_value_score", String(minScore));
    const res = await fetch(`/api/questions?${p}`);
    setData(await res.json());
    setLoading(false);
  }, [school, topic, minScore, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">題庫</h1>
        {data && <span className="text-sm text-gray-500">共 {data.total} 題</span>}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3">
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={school}
          onChange={(e) => { setSchool(e.target.value); setPage(1); }}
        >
          <option value="">所有來源</option>
          {SCHOOLS.map(s => <option key={s} value={s}>{s === "template" ? "範本題" : s}</option>)}
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={topic}
          onChange={(e) => { setTopic(e.target.value); setPage(1); }}
        >
          <option value="">所有科目</option>
          {TOPICS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={minScore}
          onChange={(e) => { setMinScore(Number(e.target.value)); setPage(1); }}
        >
          {GRADES.map(g => <option key={g.label} value={g.min}>{g.label}</option>)}
        </select>
      </div>

      {/* Question list */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">載入中…</div>
      ) : data?.items.length === 0 ? (
        <div className="py-16 text-center text-gray-400">目前尚無題目。</div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((q) => {
            const grade = gradeLabel(q.value_score);
            return (
              <Link
                key={q.id}
                href={`/questions/${q.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {q.school && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {q.school === "template" ? "範本題" : q.school}
                        </span>
                      )}
                      {q.topic && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {TOPIC_LABELS[q.topic] ?? q.topic}
                        </span>
                      )}
                      {q.year_label && q.year_label !== "範本題" && (
                        <span className="text-xs text-gray-400">{q.year_label}</span>
                      )}
                      {q.subtopic && (
                        <span className="text-xs text-gray-400">#{q.subtopic}</span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-2 text-gray-800">
                      {q.question_text}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {grade && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${grade.cls}`}>
                        {grade.label}
                      </span>
                    )}
                    {q.difficulty && (
                      <span className="text-xs text-gray-400">難度 {q.difficulty}/5</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
          >
            上一頁
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
