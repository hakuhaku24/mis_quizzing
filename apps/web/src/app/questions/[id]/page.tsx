"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import type { Question, Solution } from "@/lib/types";

interface QuestionDetail extends Question {
  solutions?: Solution[];
}

const VERIFIED_LABELS: Record<string, { label: string; cls: string }> = {
  ai_draft:        { label: "AI 草稿", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  human_reviewed:  { label: "人工校對", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  human_verified:  { label: "人工驗證", cls: "bg-green-50 text-green-700 border-green-200" },
  teacher_verified:{ label: "教師驗證", cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

export default function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [answer, setAnswer]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/questions/${id}`)
      .then((r) => r.json())
      .then((d) => { setQuestion(d); setLoading(false); });
  }, [id]);

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    await fetch(`/api/questions/${id}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer_text: answer }),
    });
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return <div className="py-24 text-center text-gray-400">載入中…</div>;
  if (!question) return <div className="py-24 text-center text-gray-400">找不到題目</div>;

  const solution = question.solutions?.[0];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/questions" className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">
        ← 返回題庫
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {question.school && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {question.school.code} {question.school.name_zh}
            </span>
          )}
          {question.subject && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {question.subject.name_zh}
            </span>
          )}
          {question.year_label && (
            <span className="text-xs text-gray-400">{question.year_label}</span>
          )}
          {question.question_number && (
            <span className="text-xs text-gray-400">第 {question.question_number} 題</span>
          )}
          {question.topic && (
            <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border">
              #{question.topic}
            </span>
          )}
          {question.value_score != null && (
            <span className="text-xs font-semibold text-blue-700">
              價值分 {question.value_score}
            </span>
          )}
        </div>
        <p className="text-base leading-relaxed whitespace-pre-wrap">{question.question_text}</p>
      </div>

      {/* Answer area */}
      {!submitted ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold">作答</h2>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={8}
            placeholder="在此輸入你的答案…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {submitting ? "送出中…" : "送出"}
            </button>
            <button
              onClick={() => setShowSolution(true)}
              className="px-5 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              直接看詳解
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          ✓ 已記錄答題，繼續查看詳解。
          <button onClick={() => setShowSolution(true)} className="ml-2 underline">看詳解</button>
        </div>
      )}

      {/* Solution */}
      {showSolution && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">詳解</h2>
            {solution && (
              <span className={`text-xs border px-2 py-0.5 rounded-full ${VERIFIED_LABELS[solution.verified_status]?.cls ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                {VERIFIED_LABELS[solution.verified_status]?.label ?? solution.verified_status}
              </span>
            )}
          </div>

          {solution ? (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{solution.solution_text}</p>
              {solution.explanation && (
                <p className="text-sm text-gray-500 leading-relaxed">{solution.explanation}</p>
              )}
              {solution.verified_status === "ai_draft" && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  此詳解為 AI 草稿，尚未人工校對，請自行判斷正確性。
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">此題尚無詳解，請查閱原始 PDF。</p>
          )}
        </div>
      )}
    </div>
  );
}
