"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { stripMarkup } from "@/lib/text";

// 筆試約在 2027 年 2 月（各校 12 月–2 月），要改考期改這裡
const EXAM_DATE = new Date("2027-02-01T00:00:00+08:00");

const TOPIC_LABELS: Record<string, string> = {
  MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論",
};

const SLOT_META: Record<string, { label: string; cls: string }> = {
  weak:   { label: "弱點",  cls: "bg-red-50 text-red-600 border-red-200" },
  review: { label: "複習",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  unseen: { label: "新題",  cls: "bg-blue-50 text-blue-600 border-blue-200" },
  extra:  { label: "加練",  cls: "bg-gray-50 text-gray-500 border-gray-200" },
};

interface DailyItem {
  id: number;
  question_text: string;
  question_type: string | null;
  topic: string;
  subtopic: string | null;
  difficulty: number | null;
  slot: string;
  done_today: boolean;
}

interface TopicStat { topic: string; total: number; mastery: number | null; avg_ai_score: number | null; ai_graded: number }
interface RecentAttempt { ai_score: number | null; created_at: string }
interface Analytics {
  totalAttempts: number;
  aiGraded: number;
  avgAiScore: number | null;
  topicStats: TopicStat[];
  recentAttempts: RecentAttempt[];
}

function MasteryBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-9 text-right">{pct}%</span>
    </div>
  );
}

export default function HomePage() {
  const [daily, setDaily] = useState<DailyItem[] | null>(null);
  const [stats, setStats] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/daily").then((r) => r.json()).then((d) => setDaily(d.items ?? []));
    fetch("/api/analytics").then((r) => r.json()).then(setStats);
  }, []);

  const daysLeft = Math.max(0, Math.ceil((EXAM_DATE.getTime() - Date.now()) / 86_400_000));
  const doneCount = daily?.filter((d) => d.done_today).length ?? 0;
  const firstUndone = daily?.find((d) => !d.done_today);

  // last 6 AI scores, oldest → newest
  const recentScores = (stats?.recentAttempts ?? [])
    .filter((a) => a.ai_score != null)
    .slice(0, 6)
    .reverse();

  const examTopics = (stats?.topicStats ?? []).filter((t) => t.topic === "CS" || t.topic === "DS");

  return (
    <div className="space-y-8">
      {/* Countdown hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-blue-200 text-sm">距離研究所筆試（約 2027/2）</p>
            <p className="text-5xl font-bold mt-1">
              {daysLeft}<span className="text-2xl font-normal text-blue-200 ml-2">天</span>
            </p>
            <p className="text-blue-200 text-xs mt-2">目標：資管所科技組 · 計概＋資料結構</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-blue-200 text-xs">總作答</p>
              <p className="text-2xl font-semibold">{stats?.totalAttempts ?? "—"}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">AI 批改</p>
              <p className="text-2xl font-semibold">{stats?.aiGraded ?? "—"}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">AI 平均</p>
              <p className="text-2xl font-semibold">
                {stats?.avgAiScore != null ? stats.avgAiScore.toFixed(1) : "—"}
                <span className="text-sm font-normal text-blue-200">/10</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily tasks */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">今日任務</h2>
              <p className="text-xs text-gray-400 mt-0.5">60% 弱點 · 20% 複習 · 20% 新題（計概＋資結）</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-700">{doneCount}<span className="text-sm text-gray-400 font-normal">/{daily?.length ?? 10}</span></p>
              <p className="text-xs text-gray-400">今日完成</p>
            </div>
          </div>

          {daily === null ? (
            <p className="py-8 text-center text-gray-400 text-sm">載入中…</p>
          ) : daily.length === 0 ? (
            <p className="py-8 text-center text-gray-400 text-sm">題庫是空的。</p>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {daily.map((d, i) => (
                  <Link
                    key={d.id}
                    href={`/questions/${d.id}`}
                    className={`flex items-center gap-3 py-2.5 group ${d.done_today ? "opacity-50" : ""}`}
                  >
                    <span className="text-xs text-gray-300 w-5 text-right">{i + 1}</span>
                    <span className={`text-xs border px-1.5 py-0.5 rounded-full shrink-0 ${SLOT_META[d.slot]?.cls ?? SLOT_META.extra.cls}`}>
                      {SLOT_META[d.slot]?.label ?? "加練"}
                    </span>
                    <span className={`flex-1 text-sm truncate group-hover:text-blue-600 ${d.done_today ? "line-through" : ""}`}>
                      {stripMarkup(d.question_text)}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
                      {d.subtopic ? `#${d.subtopic}` : TOPIC_LABELS[d.topic] ?? d.topic}
                    </span>
                    {d.done_today && <span className="text-green-500 text-sm shrink-0">✓</span>}
                  </Link>
                ))}
              </div>
              {firstUndone ? (
                <Link
                  href={`/questions/${firstUndone.id}`}
                  className="block w-full text-center px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {doneCount === 0 ? "開始今日練習 →" : `繼續練習（剩 ${daily.length - doneCount} 題）→`}
                </Link>
              ) : (
                <div className="text-center py-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium">
                  🎉 今日任務完成！
                </div>
              )}
            </>
          )}
        </section>

        {/* Right column: mastery + recent scores */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">考科掌握度</h2>
              <Link href="/analytics" className="text-xs text-blue-600 hover:underline">弱點分析 →</Link>
            </div>
            {examTopics.length === 0 ? (
              <p className="text-sm text-gray-400">開始作答後顯示</p>
            ) : (
              <div className="space-y-3">
                {examTopics.map((t) => (
                  <div key={t.topic} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{TOPIC_LABELS[t.topic] ?? t.topic}</span>
                      <span className="text-xs text-gray-400">{t.total} 次作答</span>
                    </div>
                    {t.mastery != null && <MasteryBar rate={t.mastery} />}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-semibold">最近 AI 批改</h2>
            {recentScores.length === 0 ? (
              <p className="text-sm text-gray-400">尚無批改紀錄</p>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {recentScores.map((a, i) => (
                  <span
                    key={i}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold ${
                      (a.ai_score ?? 0) >= 7 ? "bg-green-100 text-green-700"
                        : (a.ai_score ?? 0) >= 4 ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {a.ai_score}
                  </span>
                ))}
                <span className="text-xs text-gray-400 ml-1">← 新</span>
              </div>
            )}
            <p className="text-xs text-gray-400">累積 30 筆後解鎖趨勢線與信心校準曲線</p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-2">
            <h2 className="font-semibold">快速入口</h2>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Link href="/questions" className="py-2 border border-gray-200 rounded-lg hover:bg-gray-50">題庫</Link>
              <Link href="/analytics" className="py-2 border border-gray-200 rounded-lg hover:bg-gray-50">弱點</Link>
              <Link href="/history" className="py-2 border border-gray-200 rounded-lg hover:bg-gray-50">記錄</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
