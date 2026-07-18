"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import RichText from "@/components/RichText";
import { gotPointText } from "@/lib/types";
import type { AiGrade, Confidence, ErrorType, Question, Solution } from "@/lib/types";

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

const CONFIDENCE_META: Record<Confidence, { label: string; sel: string; idle: string }> = {
  low:    { label: "沒把握",   sel: "bg-gray-600 text-white border-gray-600",   idle: "border-gray-300 text-gray-600 hover:bg-gray-50" },
  medium: { label: "普通",     sel: "bg-blue-500 text-white border-blue-500",   idle: "border-blue-300 text-blue-600 hover:bg-blue-50" },
  high:   { label: "很有把握", sel: "bg-blue-700 text-white border-blue-700",   idle: "border-blue-400 text-blue-700 hover:bg-blue-50" },
};

const ERROR_TYPE_META: Record<ErrorType, { label: string; hint: string }> = {
  concept:  { label: "觀念不懂", hint: "概念本身沒搞懂" },
  memory:   { label: "記憶模糊", hint: "學過但想不起來" },
  careless: { label: "粗心",     hint: "會但看錯／算錯" },
  unseen:   { label: "沒看過",   hint: "完全沒學過這個" },
};

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
  const [confidence, setConfidence]         = useState<Confidence | null>(null);
  const [errorType, setErrorType]           = useState<ErrorType | null>(null);
  const [aiGrade, setAiGrade]               = useState<AiGrade | null>(null);
  const [grading, setGrading]               = useState(false);
  const [gradeError, setGradeError]         = useState<string | null>(null);
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

  const answered = isMC ? !!selectedOption : !!answer.trim();
  const canSubmit = answered && !!confidence;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    let correct: boolean | null = null;
    if (isMC && question?.correct_option) {
      correct = selectedOption === question.correct_option;
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
        confidence,
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

  const handleErrorType = async (type: ErrorType) => {
    setErrorType(type);
    if (attemptId) {
      await fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error_type: type }),
      });
    }
  };

  const handleGrade = async () => {
    if (!attemptId || grading) return;
    setGrading(true);
    setGradeError(null);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/grade`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setGradeError(data.error ?? "批改失敗");
      } else {
        setAiGrade(data.grade as AiGrade);
      }
    } catch {
      setGradeError("批改失敗，請稍後再試");
    }
    setGrading(false);
  };

  // Wrong MC answer, or essay judged partial/wrong (by AI or self) → ask why it went wrong
  const needsErrorType =
    submitted &&
    (isMC
      ? isCorrect === false
      : selfAssessment === "wrong" || selfAssessment === "partial" ||
        aiGrade?.verdict === "wrong" || aiGrade?.verdict === "partial");

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
          {(() => {
            let tags: string[] = [];
            try { tags = question.concepts ? JSON.parse(question.concepts) : []; } catch { /* ignore */ }
            if (!tags.length && question.subtopic) tags = [question.subtopic];
            return tags.map((t) => (
              <span key={t} className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border">
                #{t}
              </span>
            ));
          })()}
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
        <RichText className="text-base leading-relaxed space-y-2">{question.question_text}</RichText>
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
              if (submitted && question.correct_option) {
                if (isRight) cls += "bg-green-50 border-green-400 text-green-800";
                else if (isSelected) cls += "bg-red-50 border-red-400 text-red-700 line-through";
                else cls += "border-gray-100 text-gray-400";
              } else if (submitted) {
                cls += isSelected ? "border-blue-400 bg-blue-50 text-blue-800" : "border-gray-100 text-gray-400";
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
                  <RichText className="text-sm leading-relaxed flex-1">{opt}</RichText>
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
          <div className="space-y-3">
            {answered && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">送出前先誠實評估：這題你多有把握？</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(CONFIDENCE_META) as Confidence[]).map((v) => {
                    const meta = CONFIDENCE_META[v];
                    return (
                      <button
                        key={v}
                        onClick={() => setConfidence(v)}
                        className={`px-4 py-1.5 text-sm border rounded-lg transition-colors ${
                          confidence === v ? meta.sel : meta.idle
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-blue-700 transition-colors"
              >
                {submitting ? "送出中…" : answered && !confidence ? "先選把握程度 ↑" : "送出並看詳解"}
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
          <div className="space-y-3">
            {/* MC result banner */}
            {isMC && isCorrect !== null && (
              <div className="space-y-1">
                <div className={`text-sm font-semibold px-4 py-2 rounded-lg inline-block ${
                  isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {isCorrect ? "✓ 答對了！" : `✗ 答錯了，正確答案是 ${question.correct_option}`}
                </div>
                {solution?.verified_status === "ai_draft" && (
                  <p className="text-xs text-orange-500">
                    ⚠ 對照的是 AI 草稿答案（未人工驗證），若有疑義請自行查證
                  </p>
                )}
              </div>
            )}

            {/* AI grading for essay / short answer */}
            {!isMC && (
              <div className="space-y-3">
                {!aiGrade ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleGrade}
                      disabled={grading || !attemptId}
                      className="px-5 py-2 bg-violet-600 text-white text-sm rounded-lg disabled:opacity-40 hover:bg-violet-700 transition-colors"
                    >
                      {grading ? "AI 批改中…" : "🤖 AI 批改"}
                    </button>
                    {gradeError && <span className="text-xs text-red-500">{gradeError}</span>}
                  </div>
                ) : (
                  <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-violet-700">{aiGrade.score}<span className="text-sm font-normal text-violet-400"> / 10</span></span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        aiGrade.verdict === "correct" ? "bg-green-100 text-green-700" :
                        aiGrade.verdict === "partial" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {aiGrade.verdict === "correct" ? "答對" : aiGrade.verdict === "partial" ? "部分正確" : "答錯"}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">AI 批改</span>
                    </div>
                    {aiGrade.got_points.length > 0 && (
                      <div className="text-sm space-y-1">
                        <p className="font-medium text-green-700">✓ 有答到</p>
                        <ul className="list-disc pl-5 text-gray-600 space-y-0.5">
                          {aiGrade.got_points.map((p, i) => <li key={i}>{gotPointText(p)}</li>)}
                        </ul>
                      </div>
                    )}
                    {aiGrade.missing_points.length > 0 && (
                      <div className="text-sm space-y-1">
                        <p className="font-medium text-yellow-700">△ 漏掉的得分點</p>
                        <ul className="list-disc pl-5 text-gray-600 space-y-0.5">
                          {aiGrade.missing_points.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {aiGrade.wrong_points.length > 0 && (
                      <div className="text-sm space-y-1">
                        <p className="font-medium text-red-700">✗ 寫錯的地方</p>
                        <ul className="list-disc pl-5 text-gray-600 space-y-0.5">
                          {aiGrade.wrong_points.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 border-t border-violet-100 pt-2">{aiGrade.feedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* Real MC without an official key: no auto-judgement possible */}
            {isMC && submitted && !question.correct_option && (
              <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                此真題暫無官方答案，請對照詳解或自行查證後自評。
              </p>
            )}

            {/* Essay self-assessment */}
            {(!isMC || (submitted && !question.correct_option)) && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">{aiGrade ? "（也可以手動自評）" : "或對照詳解後自評："}</p>
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

            {/* Error-type diagnosis for wrong / partially-wrong answers */}
            {needsErrorType && (
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <p className="text-sm text-gray-500">為什麼沒答好？（幫助之後對症下藥）</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(ERROR_TYPE_META) as ErrorType[]).map((v) => {
                    const meta = ERROR_TYPE_META[v];
                    return (
                      <button
                        key={v}
                        onClick={() => handleErrorType(v)}
                        disabled={errorType !== null}
                        title={meta.hint}
                        className={`px-4 py-1.5 text-sm border rounded-lg transition-colors disabled:cursor-default ${
                          errorType === v
                            ? "bg-orange-500 text-white border-orange-500"
                            : errorType !== null
                            ? "border-gray-200 text-gray-300"
                            : "border-orange-300 text-orange-700 hover:bg-orange-50"
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                {errorType && (
                  <p className="text-xs text-gray-400">已記錄錯因：{ERROR_TYPE_META[errorType].label}</p>
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
              <RichText className="text-sm leading-relaxed space-y-2">{solution.solution_text}</RichText>
              {solution.explanation && (
                <div className="border-t border-gray-100 pt-3">
                  <RichText className="text-sm text-gray-500 leading-relaxed space-y-2">{solution.explanation}</RichText>
                </div>
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
