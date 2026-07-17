"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TOPIC_LABELS: Record<string, string> = {
  MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論", STAT: "統計學",
};

interface TopicStat {
  topic: string;
  total: number;
  mc_correct: number;
  mc_wrong: number;
  ai_graded: number;
  avg_ai_score: number | null;
  mastery: number | null;
  correct_rate?: number | null;
}

interface ConceptStat {
  concept: string;
  topic: string;
  total: number;
  ai_graded: number;
  avg_ai_score: number | null;
  mastery: number | null;
}

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
  ai_score: number | null;
  time_spent_seconds: number | null;
  created_at: string;
}

interface Analytics {
  totalAttempts: number;
  aiGraded: number;
  avgAiScore: number | null;
  topicStats: TopicStat[];
  conceptStats: ConceptStat[];
  recentAttempts: Attempt[];
  weakTopics: TopicStat[];
}

function RateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  if (loading) return <div className="py-24 text-center text-gray-400">載入中…</div>;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">
      載入失敗：{error}
    </div>
  );
  if (!data) return null;

  const noData = data.totalAttempts === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">弱點分析</h1>
        <Link href="/history" className="text-sm text-blue-600 hover:underline">
          查看答題記錄 →
        </Link>
      </div>

      {noData ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p className="text-lg">開始答題後，這裡會顯示你的科目答對率與弱點主題。</p>
          <p className="text-sm mt-2">
            前往 <Link href="/questions" className="text-blue-600 underline">題庫</Link> 開始練習。
          </p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="總答題數" value={data.totalAttempts} />
            <StatCard label="涵蓋科目" value={data.topicStats.length} />
            <StatCard
              label="MC 答對率"
              value={(() => {
                const c = data.topicStats.reduce((s, t) => s + t.mc_correct, 0);
                const t = data.topicStats.reduce((s, t) => s + t.mc_correct + t.mc_wrong, 0);
                return t > 0 ? `${Math.round((c / t) * 100)}%` : "—";
              })()}
            />
            <StatCard
              label="AI 批改平均"
              value={data.avgAiScore != null ? `${data.avgAiScore.toFixed(1)}/10` : "—"}
            />
          </div>

          {/* Per-topic */}
          {data.topicStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="font-semibold">各科掌握度</h2>
              <p className="text-xs text-gray-400">選擇題以對錯計、申論以 AI 分數（或自評）計的加權平均</p>
              <div className="space-y-4">
                {data.topicStats.map((t) => (
                  <div key={t.topic} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{TOPIC_LABELS[t.topic] ?? t.topic}</span>
                      <span className="text-gray-400 text-xs">
                        答 {t.total} 題
                        {t.ai_graded > 0 && ` · AI 批改 ${t.ai_graded} 題，平均 ${t.avg_ai_score?.toFixed(1)}/10`}
                      </span>
                    </div>
                    {t.mastery !== null ? <RateBar rate={t.mastery} /> : (
                      <p className="text-xs text-gray-400">尚無足夠已評分資料</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concept mastery (weakest first) */}
          {data.conceptStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="font-semibold">知識點掌握度（由弱到強）</h2>
              <div className="space-y-3">
                {data.conceptStats.map((c) => (
                  <div key={c.concept} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        <Link href={`/questions?concept=${encodeURIComponent(c.concept)}`} className="font-medium hover:text-blue-600">
                          #{c.concept}
                        </Link>
                        <span className="text-xs text-gray-400 ml-2">{TOPIC_LABELS[c.topic] ?? c.topic}</span>
                      </span>
                      <span className="text-gray-400 text-xs">
                        {c.total} 次作答{c.ai_graded > 0 && ` · AI 平均 ${c.avg_ai_score?.toFixed(1)}/10`}
                      </span>
                    </div>
                    <RateBar rate={c.mastery ?? 0} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak topics */}
          {data.weakTopics.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-2">
              <h2 className="font-semibold text-red-700">建議加強</h2>
              <ul className="space-y-1">
                {data.weakTopics.slice(0, 3).map((t) => (
                  <li key={t.topic} className="text-sm text-red-600 flex items-center gap-2">
                    <span>•</span>
                    <span>
                      {TOPIC_LABELS[t.topic] ?? t.topic} — 答對率{" "}
                      {Math.round((t.correct_rate ?? 0) * 100)}%
                    </span>
                    <Link
                      href={`/questions?topic=${t.topic}`}
                      className="ml-auto text-xs text-red-700 underline"
                    >
                      練習 →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent attempts */}
          {data.recentAttempts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">最近答題</h2>
                <Link href="/history" className="text-xs text-blue-600 hover:underline">全部記錄</Link>
              </div>
              <div className="space-y-3">
                {data.recentAttempts.slice(0, 5).map((a) => (
                  <AttemptRow key={a.id} attempt={a} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`font-bold text-gray-800 ${small ? "text-base" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function AttemptRow({ attempt: a }: { attempt: Attempt }) {
  const isMC = a.question_type === "multiple_choice";
  const resultTag = isMC
    ? a.is_correct === 1
      ? <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">答對</span>
      : a.is_correct === 0
        ? <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">答錯</span>
        : null
    : a.ai_score != null
      ? <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          a.ai_score >= 7 ? "text-green-700 bg-green-100" : a.ai_score >= 4 ? "text-yellow-700 bg-yellow-100" : "text-red-700 bg-red-100"
        }`}>AI {a.ai_score}/10</span>
    : a.self_assessment === "correct"
      ? <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">完全懂</span>
      : a.self_assessment === "partial"
        ? <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">部分懂</span>
        : a.self_assessment === "wrong"
          ? <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">答錯</span>
          : <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">未自評</span>;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <Link href={`/questions/${a.question_id}`} className="text-sm text-gray-800 hover:text-blue-600 line-clamp-2">
          {a.question_text}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">
          {TOPIC_LABELS[a.topic] ?? a.topic}
          {a.subtopic ? ` · ${a.subtopic}` : ""}
          {a.time_spent_seconds ? ` · ${a.time_spent_seconds}s` : ""}
        </p>
      </div>
      {resultTag}
    </div>
  );
}
