"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import type { Question, Solution } from "@/lib/types";

interface QuestionDetail extends Question {
  solutions?: Solution[];
}

const TOPIC_LABELS: Record<string, string> = {
  MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論", STAT: "統計學",
};

const VERIFIED_LABELS: Record<string, { label: string; cls: string }> = {
  ai_draft:        { label: "AI 草稿",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  template:        { label: "範本解答", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  human_reviewed:  { label: "人工校對", cls: "bg-green-50 text-green-700 border-green-200" },
  human_verified:  { label: "人工驗證", cls: "bg-green-100 text-green-800 border-green-300" },
  teacher_verified:{ label: "教師驗證", cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

type SelfAssessment = "correct" | "partial" | "wrong";

export default function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [question, setQuestion]         = useState<QuestionDetail | null>(null);
  const [loading, setLoading]           = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [answer, setAnswer]             = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [isCorrect, setIsCorrect]       = useState<boolean | null>(null);
  const [attemptId, setAttemptId]       = useState<number | null>(null);
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment | null>(null);
  const startTime = useState(() => Date.now())[0];

  useEffect(() => {
    fetch(`/api/questions/${id}`)
      .then((r) => r.json())
      .then((d) => { setQuestion(d); setLoading(false); });
  }, [id]);

  const isMC = question?.question_type === "multiple_choice";
  const parsedOptions: string[] = (() => {
    if (!isMC || !question?.options) return [];
    try { return JSON.parse(question.options as string); } catch { return []; }
  })();

  const canSubmit = isMC ? !!selectedOption : !!answer.trim();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    let correct: boolean | null = null;
    if (isMC) {
      correct = selectedOption === question?.correct_option;
      setIsCorrect(correct);
    }
    const res = await fetch(`/api/questions/${id}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer_text: isMC ? selectedOption : answer,
        selected_option: isMC ? selectedOption : undefined,
        is_correct: correct !== null ? (correct ? 1 : 0) : undefined,
        time_spent_seconds: timeSpent,
      }),
    });
    const data = await res.json();
    setAttemptId(data.id as number);
    setSubmitted(true);
    setSubmitting(false);
    setShowSolution(true);
  };

  const handleSelfAssess = async (assessment: SelfAssessment) => {
    setSelfAssessment(assessment);
    if (attemptId) {
      await fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self_assessment: assessment }),
      });
    }
  };

  if (loading) return <div className="py-24 text-center text-gray-400">載入中…</div>;
  if (!question) return <div className="py-24 text-center text-gray-400">找不到題目</div>;

  const solution = question.solutions?.[0];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/questions" className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">
        ← 返回題庫
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {question.school && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {question.school === "template" ? "範本題" : question.school}
            </span>
          )}
          {question.topic && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {TOPIC_LABELS[question.topic] ?? question.topic}
            </span>
          )}
          {question.year_label && !question.year_label.startsWith("範本") && (
            <span className="text-xs text-gray-400">{question.year_label}</span>
          )}
          {question.subtopic && (
            <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border">
              #{question.subtopic}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {question.difficulty && (
              <span className="text-xs text-gray-400">難度 {question.difficulty}/5</span>
            )}
            <span className="text-xs font-semibold text-blue-700">
              {question.question_type === "essay" ? "申論" :
               question.question_type === "short_answer" ? "簡答" :
               question.question_type === "multiple_choice" ? "選擇題" :
               question.question_type ?? ""}
            </span>
          </div>
        </div>
        <p className="text-base leading-relaxed whitespace-pre-wrap">{question.question_text}</p>
      </div>

      {/* Answer area */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold">作答</h2>

        {isMC ? (
          <div className="space-y-2">
            {parsedOptions.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isSelected = selectedOption === letter;
              const isRight = letter === question.correct_option;
              let cls = "flex items-start gap-3 p-3 rounded-lg border transition-colors ";
              if (submitted) {
                if (isRight) cls += "bg-green-50 border-green-400 text-green-800";
                else if (isSelected) cls += "bg-red-50 border-red-400 text-red-700 line-through";
                else cls += "border-gray-100 text-gray-400";
              } else {
                cls += isSelected
                  ? "border-blue-400 bg-blue-50 text-blue-800 cursor-pointer"
                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer";
              }
              return (
                <label key={letter} className={cls}>
                  <input
                    type="radio"
                    name="mc-option"
                    value={letter}
                    checked={isSelected}
                    onChange={() => !submitted && setSelectedOption(letter)}
                    disabled={submitted}
                    className="mt-0.5 accent-blue-600 shrink-0"
                  />
                  <span className="text-sm leading-relaxed">{opt}</span>
                  {submitted && isRight && (
                    <span className="ml-auto text-green-600 text-xs font-semibold shrink-0">✓ 正確答案</span>
                  )}
                </label>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-700"
              rows={8}
              placeholder="在此輸入你的答案…"
              value={answer}
              onChange={(e) => !submitted && setAnswer(e.target.value)}
              disabled={submitted}
            />
            {submitted && (
              <p className="text-xs text-gray-400">↑ 你的作答（已記錄）</p>
            )}
          </div>
        )}

        {!submitted ? (
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {submitting ? "送出中…" : "送出並看詳解"}
            </button>
            <button
              onClick={() => setShowSolution(true)}
              className="px-5 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              直接看詳解
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* MC result banner */}
            {isMC && isCorrect !== null && (
              <div className={`text-sm font-semibold px-4 py-2 rounded-lg inline-block ${
                isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {isCorrect ? "✓ 答對了！" : `✗ 答錯了，正確答案是 ${question.correct_option}`}
              </div>
            )}

            {/* Essay self-assessment */}
            {!isMC && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">對照詳解後，你覺得自己：</p>
                <div className="flex gap-2 flex-wrap">
                  {(["correct", "partial", "wrong"] as SelfAssessment[]).map((v) => {
                    const meta = {
                      correct: { label: "完全懂了 ✓", sel: "bg-green-600 text-white border-green-600",   idle: "border-green-400 text-green-700 hover:bg-green-50" },
                      partial: { label: "部分懂 △",  sel: "bg-yellow-500 text-white border-yellow-500", idle: "border-yellow-400 text-yellow-700 hover:bg-yellow-50" },
                      wrong:   { label: "答錯了 ✗",  sel: "bg-red-600 text-white border-red-600",        idle: "border-red-400 text-red-700 hover:bg-red-50" },
                    }[v];
                    return (
                      <button
                        key={v}
                        onClick={() => handleSelfAssess(v)}
                        disabled={selfAssessment !== null}
                        className={`px-4 py-1.5 text-sm border rounded-lg transition-colors disabled:cursor-default ${
                          selfAssessment === v ? meta.sel : selfAssessment !== null ? "border-gray-200 text-gray-300" : meta.idle
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                {selfAssessment && (
                  <p className="text-xs text-gray-400">已記錄自評</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Solution */}
      {showSolution && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">詳解</h2>
            {solution && (
              <span className={`text-xs border px-2 py-0.5 rounded-full ${
                VERIFIED_LABELS[solution.verified_status ?? ""]?.cls ?? "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                {VERIFIED_LABELS[solution.verified_status ?? ""]?.label ?? solution.verified_status}
              </span>
            )}
          </div>
          {solution ? (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{solution.solution_text}</p>
              {solution.explanation && (
                <p className="text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                  {solution.explanation}
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
