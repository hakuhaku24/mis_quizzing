"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { stripMarkup } from "@/lib/text";
import type { Question } from "@/lib/types";

const SCHOOLS = ["NCU", "NCKU", "NCCU", "template"];
const SCHOOL_LABELS: Record<string, string> = {
  NCU: "中央（真題）", NCKU: "成大", NCCU: "政大", template: "範本題",
};
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
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-400">載入中…</div>}>
      <QuestionsPageInner />
    </Suspense>
  );
}

function QuestionsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData]         = useState<PageData | null>(null);
  const [loading, setLoading]   = useState(false);
  // filters live in the URL so back-navigation restores them
  const school     = searchParams.get("school") ?? "";
  const topic      = searchParams.get("topic") ?? "";
  const concept    = searchParams.get("concept") ?? "";
  const year       = searchParams.get("year") ?? "";
  const difficulty = searchParams.get("difficulty") ?? "";
  const minScore   = Number(searchParams.get("min_value_score") ?? 0);
  const page       = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;

  const setFilter = (patch: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    if (!("page" in patch)) p.delete("page"); // filter change resets pagination
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (school)     p.set("school", school);
    if (topic)      p.set("topic", topic);
    if (concept)    p.set("concept", concept);
    if (year)       p.set("year", year);
    if (difficulty) p.set("difficulty", difficulty);
    if (minScore)   p.set("min_value_score", String(minScore));
    const res = await fetch(`/api/questions?${p}`);
    setData(await res.json());
    setLoading(false);
  }, [school, topic, concept, year, difficulty, minScore, page]);

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
          onChange={(e) => setFilter({ school: e.target.value })}
        >
          <option value="">所有來源</option>
          {SCHOOLS.map(s => <option key={s} value={s}>{SCHOOL_LABELS[s] ?? s}</option>)}
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={topic}
          onChange={(e) => setFilter({ topic: e.target.value })}
        >
          <option value="">所有科目</option>
          {TOPICS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={year}
          onChange={(e) => setFilter({ year: e.target.value })}
        >
          <option value="">所有年份</option>
          {Array.from({ length: 11 }, (_, i) => 115 - i).map(y => (
            <option key={y} value={y}>{y} 學年</option>
          ))}
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={difficulty}
          onChange={(e) => setFilter({ difficulty: e.target.value })}
        >
          <option value="">所有難度</option>
          {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>難度 {d}</option>)}
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={minScore}
          onChange={(e) => setFilter({ min_value_score: e.target.value === "0" ? "" : e.target.value })}
        >
          {GRADES.map(g => <option key={g.label} value={g.min}>{g.label}</option>)}
        </select>

        {concept && (
          <span className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5">
            #{concept}
            <button
              onClick={() => setFilter({ concept: "" })}
              className="text-blue-400 hover:text-blue-700"
              aria-label="清除知識點篩選"
            >
              ✕
            </button>
          </span>
        )}
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          q.school === "NCU" ? "bg-amber-100 text-amber-800 font-semibold" : "bg-gray-100 text-gray-600"
                        }`}>
                          {SCHOOL_LABELS[q.school] ?? q.school}
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
                      {stripMarkup(q.question_text)}
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
            onClick={() => setFilter({ page: String(Math.max(1, page - 1)) })}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
          >
            上一頁
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setFilter({ page: String(Math.min(totalPages, page + 1)) })}
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
