import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter, type ErrorBoundaryProps } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import RichText from "../../components/RichText";
import { formatMath } from "../../lib/math";
import { loadDraft, saveDraft, clearDraft } from "../../lib/drafts";
import { choiceLabel, isMultiSelect, parseChoice, sameChoice, toggleChoice } from "../../lib/choices";
import { sourceLabel } from "../../lib/labels";
import { randomQuestionId } from "../../lib/random";
import { REPORT_REASONS, submitReport, type ReportReason } from "../../lib/reports";
import { CONSENT_MESSAGE, CONSENT_TITLE, grantAIConsent, hasAIConsent } from "../../lib/consent";
import { getQuestion, getAttempt, submitAttempt, setSelfAssessment, setErrorType, gradeAttempt } from "../../lib/attempts";
import { colors, radius, spacing, typography } from "../../lib/theme";
import type { AiGrade, AiGradePoint, Confidence, ErrorType, Question, SelfAssessment, Solution } from "../../lib/types";

const TOPIC_LABELS: Record<string, string> = { MIS: "管理資訊系統", DS: "資料結構", CS: "計算機概論", STAT: "統計學" };
const CONFIDENCE_META: Record<Confidence, string> = { low: "沒把握", medium: "普通", high: "很有把握" };
const ERROR_TYPE_META: Record<ErrorType, string> = { concept: "觀念不懂", memory: "記憶模糊", careless: "粗心", unseen: "沒看過" };
const SELF_ASSESS_META: Record<SelfAssessment, string> = { correct: "完全懂了 ✓", partial: "部分懂 △", wrong: "答錯了 ✗" };

function parseOptions(q: Question): string[] {
  if (q.question_type !== "multiple_choice" || !q.options) return [];
  return q.options;
}

/** A grade is model output and can lack a list or the summary (attempt 70,
 *  2026-10-19, crashed this screen): show what is there instead. */
function normalizeGrade(raw: AiGrade | null | undefined): AiGrade | null {
  if (!raw || typeof raw !== "object") return null;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.length > 0) : []);
  const points = Array.isArray(raw.got_points)
    ? raw.got_points.filter((p): p is AiGradePoint | string =>
        typeof p === "string" ? p.length > 0 : typeof p === "object" && p !== null && typeof p.point === "string")
    : [];
  const score = Number(raw.score);
  return {
    score: Number.isFinite(score) ? score : 0,
    verdict: raw.verdict === "correct" || raw.verdict === "wrong" ? raw.verdict : "partial",
    got_points: points,
    missing_points: strings(raw.missing_points),
    wrong_points: strings(raw.wrong_points),
    feedback: typeof raw.feedback === "string" ? raw.feedback : "",
  };
}

/** The AI score's band: the same lines as the score badges in the history list
 *  (lib/labels.ts) and the review schedule (lib/srs.ts) — 7+ is done, 4–6 comes
 *  back in 3 days, 0–3 tomorrow. The model's own correct/partial/wrong label
 *  was inconsistent (the same 2/10 called either) and is no longer shown. */
const scoreBand = (score: number) => (score >= 7 ? "done" : score >= 4 ? "partial" : "low");
// the darker text shades keep 4.5:1 contrast on the AI card
const BAND_COLOR = { done: colors.successText, partial: colors.warningText, low: colors.dangerText };

/** If drawing this screen still fails, offer a way back instead of a blank screen. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.crashText}>這題暫時打不開</Text>
      <View style={styles.crashRow}>
        <Pressable style={styles.crashButton} onPress={() => router.back()}>
          <Text style={styles.crashButtonText}>返回</Text>
        </Pressable>
        <Pressable style={[styles.crashButton, styles.crashButtonPrimary]} onPress={retry}>
          <Text style={[styles.crashButtonText, styles.crashButtonTextPrimary]}>重試</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function QuestionScreen() {
  const { id, attempt, from } = useLocalSearchParams<{ id: string; attempt?: string; from?: string }>();
  // key forces a fresh screen state when switching from a saved attempt to "practice again"
  return (
    <QuestionView
      key={`${id}-${attempt ?? "new"}`}
      id={Number(id)}
      savedAttemptId={attempt ? Number(attempt) : null}
      randomMode={from === "random"}
    />
  );
}

function QuestionView({ id, savedAttemptId, randomMode }: { id: number; savedAttemptId: number | null; randomMode: boolean }) {
  const router = useRouter();
  const [drawingNext, setDrawingNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [selfAssessment, setSelfAssessmentState] = useState<SelfAssessment | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [errorType, setErrorTypeState] = useState<ErrorType | null>(null);
  const [aiGrade, setAiGrade] = useState<AiGrade | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [startTime] = useState(() => Date.now());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Leaving with typed but unsent text asks first (back button, Android back,
  // 再抽一題). Nothing typed yet, or already submitted: leave right away.
  const navigation = useNavigation();
  const hasUnsentText = !submitted && answer.trim().length > 0;
  useEffect(() => {
    if (!hasUnsentText) return;
    return navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
      Alert.alert("還沒送出，要離開嗎？", "你寫的內容會先存成草稿，下次打開這題會自動恢復。", [
        { text: "繼續作答", style: "cancel" },
        // re-dispatching the same action doesn't ask again (already marked as handled)
        { text: "離開", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation, hasUnsentText]);

  useEffect(() => {
    Promise.all([
      getQuestion(id),
      savedAttemptId ? getAttempt(savedAttemptId) : Promise.resolve(null),
      savedAttemptId ? Promise.resolve(null) : loadDraft(id),
    ])
      .then(([{ question, solution }, saved, draft]) => {
        if (draft) {
          setAnswer(draft.answer);
          setSelectedOption(draft.selectedOption);
          setDraftRestored(true);
        }
        setDraftReady(!savedAttemptId);
        setQuestion(question);
        setSolution(solution);
        if (saved) {
          setAttemptId(saved.id);
          setAnswer(saved.answer_text ?? "");
          setSelectedOption(saved.selected_option ?? "");
          setIsCorrect(saved.is_correct);
          setConfidence(saved.confidence);
          setSelfAssessmentState(saved.self_assessment);
          setErrorTypeState(saved.error_type);
          setAiGrade(normalizeGrade(saved.ai_feedback));
          setSavedAt(saved.created_at);
          setSubmitted(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id, savedAttemptId]);

  useEffect(() => {
    // saved on every change (no debounce) so backing out right after typing loses nothing
    if (draftReady && !submitted) saveDraft(id, { answer, selectedOption });
  }, [id, answer, selectedOption, draftReady, submitted]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (!question) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: colors.ink3 }}>找不到題目</Text>
      </SafeAreaView>
    );
  }

  const isMC = question.question_type === "multiple_choice";
  const multi = isMC && isMultiSelect(question);
  const options = parseOptions(question);
  const picked = parseChoice(selectedOption);
  const keyLetters = parseChoice(question.correct_option);
  const answered = isMC ? picked.length > 0 : !!answer.trim();
  const canSubmit = answered && !!confidence;

  const pickOption = (letter: string) =>
    setSelectedOption(multi ? toggleChoice(selectedOption, letter) : letter);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    let correct: boolean | null = null;
    if (isMC && keyLetters.length) {
      correct = sameChoice(selectedOption, question.correct_option);
      setIsCorrect(correct);
    }
    try {
      const newId = await submitAttempt({
        question_id: question.id,
        answer_text: isMC ? selectedOption : answer,
        selected_option: isMC ? selectedOption : undefined,
        is_correct: correct ?? undefined,
        time_spent_seconds: timeSpent,
        confidence: confidence!,
      });
      setAttemptId(newId);
      setSubmitted(true);
      clearDraft(question.id);
    } catch {
      setGradeError("送出失敗，請稍後再試");
    }
    setSubmitting(false);
  };

  const drawAnother = async () => {
    if (drawingNext) return;
    setDrawingNext(true);
    const next = await randomQuestionId(id);
    setDrawingNext(false);
    if (next) router.replace(`/question/${next}?from=random`);
  };

  const handleSelfAssess = async (v: SelfAssessment) => {
    setSelfAssessmentState(v);
    if (attemptId) await setSelfAssessment(attemptId, v);
  };

  const handleErrorType = async (v: ErrorType) => {
    setErrorTypeState(v);
    if (attemptId) await setErrorType(attemptId, v);
  };

  const handleGrade = async () => {
    if (!attemptId || grading) return;
    if (!(await hasAIConsent())) {
      Alert.alert(CONSENT_TITLE, CONSENT_MESSAGE, [
        { text: "先不要", style: "cancel" },
        {
          text: "同意並批改",
          onPress: async () => {
            await grantAIConsent();
            runGrade();
          },
        },
      ]);
      return;
    }
    runGrade();
  };

  const runGrade = async () => {
    if (!attemptId) return;
    setGrading(true);
    setGradeError(null);
    try {
      setAiGrade(normalizeGrade(await gradeAttempt(attemptId, question.id)));
    } catch (e) {
      setGradeError(e instanceof Error && e.message ? e.message : "批改失敗，請稍後再試");
    }
    setGrading(false);
  };

  const needsErrorType =
    submitted &&
    (isMC
      ? isCorrect === false
      : selfAssessment === "wrong" || selfAssessment === "partial" ||
        (aiGrade !== null && scoreBand(aiGrade.score) !== "done"));

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="close" size={18} color={colors.ink2} />
        </Pressable>
        <Text style={styles.topBarTitle}>{savedAt ? "作答紀錄" : submitted ? "作答結果" : "作答"}</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          {savedAt && (
            <Text style={styles.savedAt}>
              {new Date(savedAt).toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} 作答
              {confidence ? ` · 送出前：${CONFIDENCE_META[confidence]}` : ""}
            </Text>
          )}
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {sourceLabel(question) && <Tag text={sourceLabel(question)!} />}
              {question.topic && <Tag text={TOPIC_LABELS[question.topic] ?? question.topic} tone="info" />}
              {(question.concepts ?? []).slice(0, 2).map((c) => <Tag key={c} text={`#${c}`} />)}
            </View>
            <RichText>{question.question_text}</RichText>
          </View>

          <View style={styles.card}>
            {draftRestored && !submitted && (
              <Text style={styles.draftHint}>已恢復上次未送出的草稿</Text>
            )}
            {isMC ? (
              <View style={{ gap: spacing.sm }}>
                {multi && !submitted && <Text style={styles.multiHint}>複選題：選出所有正確的選項（全對才算對）</Text>}
                {options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isSelected = picked.includes(letter);
                  const isRight = keyLetters.includes(letter);
                  let tone: "idle" | "selected" | "right" | "wrong" | "faded" = "idle";
                  if (submitted && keyLetters.length) {
                    tone = isRight ? "right" : isSelected ? "wrong" : "faded";
                  } else if (submitted) {
                    tone = isSelected ? "selected" : "faded";
                  } else if (isSelected) {
                    tone = "selected";
                  }
                  return (
                    <Pressable
                      key={letter}
                      disabled={submitted}
                      onPress={() => pickOption(letter)}
                      style={[styles.option, optionToneStyle(tone)]}
                    >
                      <View
                        style={[
                          styles.optionBadge,
                          multi && styles.optionBadgeSquare,
                          tone === "selected" || tone === "right" ? styles.optionBadgeActive : null,
                        ]}
                      >
                        <Text style={[styles.optionBadgeText, (tone === "selected" || tone === "right") && { color: "#fff" }]}>{letter}</Text>
                      </View>
                      <Text style={styles.optionText}>{formatMath(opt)}</Text>
                      {submitted && isRight && (
                        <Text style={styles.rightMark}>{multi && !isSelected ? "✓ 正解（漏選）" : "✓ 正解"}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
              {question.needs_drawing && !submitted && (
                <Text style={styles.drawHint}>
                  這題需要畫圖：可以用文字表示，例如樹寫成「15(11(9, 14), 23)」、圖寫成邊的列表「a-b:3, b-c:5」、類別圖列出類別與屬性方法；也可以畫在紙上，再對照詳解自評。
                </Text>
              )}
              <TextInput
                style={styles.textArea}
                placeholder="在此輸入你的答案…"
                placeholderTextColor={colors.ink3}
                multiline
                editable={!submitted}
                value={answer}
                onChangeText={setAnswer}
              />
              </>
            )}

            {!submitted ? (
              <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                {answered && (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={styles.hint}>送出前先誠實評估：這題你多有把握？</Text>
                    <View style={styles.pillRow}>
                      {(Object.keys(CONFIDENCE_META) as Confidence[]).map((v) => (
                        <Pressable key={v} onPress={() => setConfidence(v)} style={[styles.pill, confidence === v && styles.pillActive]}>
                          <Text style={[styles.pillText, confidence === v && styles.pillTextActive]}>{CONFIDENCE_META[v]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} disabled={!canSubmit || submitting} onPress={handleSubmit}>
                  <Text style={styles.submitButtonText}>{submitting ? "送出中…" : "送出並看詳解"}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                {isMC && isCorrect !== null && (
                  <View style={[styles.resultBanner, { backgroundColor: isCorrect ? colors.successSoft : colors.dangerSoft }]}>
                    <Text style={{ color: isCorrect ? colors.success : colors.danger, fontWeight: "700", fontSize: 13 }}>
                      {isCorrect
                        ? "✓ 答對了！"
                        : `✗ 答錯了，正確答案是 ${choiceLabel(question.correct_option)}${multi ? "（複選，全對才算對）" : ""}`}
                    </Text>
                  </View>
                )}

                {!isMC && !aiGrade && (
                  <View>
                    <Pressable style={styles.gradeButton} disabled={grading} onPress={handleGrade}>
                      <Text style={styles.gradeButtonText}>{grading ? "AI 批改中…" : "AI 批改"}</Text>
                    </Pressable>
                    {gradeError && <Text style={styles.errorText}>{gradeError}</Text>}
                  </View>
                )}

                {aiGrade && (
                  <View style={styles.aiCard}>
                    <View style={styles.aiHeaderRow}>
                      <Text style={[styles.aiScore, { color: BAND_COLOR[scoreBand(aiGrade.score)] }]}>
                        {aiGrade.score}<Text style={styles.aiScoreMax}> / 10</Text>
                      </Text>
                    </View>
                    {aiGrade.got_points.length > 0 && (
                      <PointList title="✓ 有答到" color={colors.success} items={aiGrade.got_points.map((p) => (typeof p === "string" ? p : p.point))} />
                    )}
                    {aiGrade.missing_points.length > 0 && (
                      <PointList title="△ 漏掉的得分點" color={colors.warning} items={aiGrade.missing_points} />
                    )}
                    {aiGrade.wrong_points.length > 0 && (
                      <PointList title="✗ 寫錯的地方" color={colors.danger} items={aiGrade.wrong_points} />
                    )}
                    {aiGrade.feedback.length > 0 && <Text style={styles.feedback}>{formatMath(aiGrade.feedback)}</Text>}
                  </View>
                )}

                {(!isMC || (submitted && keyLetters.length === 0)) && (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={styles.hint}>{aiGrade ? "（也可以手動自評）" : "或對照詳解後自評："}</Text>
                    <View style={styles.pillRow}>
                      {(Object.keys(SELF_ASSESS_META) as SelfAssessment[]).map((v) => (
                        <Pressable key={v} disabled={selfAssessment !== null} onPress={() => handleSelfAssess(v)} style={[styles.pill, selfAssessment === v && styles.pillActive]}>
                          <Text style={[styles.pillText, selfAssessment === v && styles.pillTextActive]}>{SELF_ASSESS_META[v]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {needsErrorType && (
                  <View style={{ gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md }}>
                    <Text style={styles.hint}>為什麼沒答好？</Text>
                    <View style={styles.pillRow}>
                      {(Object.keys(ERROR_TYPE_META) as ErrorType[]).map((v) => (
                        <Pressable key={v} disabled={errorType !== null} onPress={() => handleErrorType(v)} style={[styles.pillWarn, errorType === v && styles.pillWarnActive]}>
                          <Text style={[styles.pillWarnText, errorType === v && { color: "#fff" }]}>{ERROR_TYPE_META[v]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {submitted && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>詳解</Text>
              {solution ? (
                <RichText>{solution.solution_text}</RichText>
              ) : (
                <Text style={{ color: colors.ink3, fontSize: 13 }}>此題尚無詳解。</Text>
              )}
            </View>
          )}

          {randomMode && submitted && !savedAt && (
            <Pressable style={styles.retryButton} onPress={drawAnother} disabled={drawingNext}>
              <Ionicons name="shuffle" size={16} color={colors.accent} />
              <Text style={styles.retryButtonText}>{drawingNext ? "抽題中…" : "再抽一題"}</Text>
            </Pressable>
          )}

          {savedAt && (
            <Pressable style={styles.retryButton} onPress={() => router.replace(`/question/${id}`)}>
              <Ionicons name="refresh" size={16} color={colors.accent} />
              <Text style={styles.retryButtonText}>再練一次</Text>
            </Pressable>
          )}

          <ReportLink questionId={question.id} attemptId={attemptId} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReportLink({ questionId, attemptId }: { questionId: number; attemptId: number | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitReport({ questionId, attemptId, reason, note });
      setSent(true);
      setOpen(false);
    } catch {
      setError("送出失敗，請稍後再試");
    }
    setSending(false);
  };

  if (sent) return <Text style={styles.reportDone}>已收到你的回報，謝謝！我們會盡快確認這題。</Text>;

  return (
    <>
      <Pressable style={styles.reportLink} onPress={() => setOpen(true)}>
        <Ionicons name="flag-outline" size={13} color={colors.ink3} />
        <Text style={styles.reportLinkText}>這題有問題？回報給我們</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>回報這題的問題</Text>
            <View style={styles.pillRow}>
              {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
                <Pressable key={r} onPress={() => setReason(r)} style={[styles.pill, reason === r && styles.pillActive]}>
                  <Text style={[styles.pillText, reason === r && styles.pillTextActive]}>{REPORT_REASONS[r]}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.reportNote}
              placeholder="補充說明（選填），例如：正確答案應該是 C，因為…"
              placeholderTextColor={colors.ink3}
              multiline
              maxLength={1000}
              value={note}
              onChangeText={setNote}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setOpen(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSend, (!reason || sending) && styles.submitButtonDisabled]}
                disabled={!reason || sending}
                onPress={send}
              >
                <Text style={styles.submitButtonText}>{sending ? "送出中…" : "送出"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Tag({ text, tone }: { text: string; tone?: "info" }) {
  return (
    <View style={[styles.tag, tone === "info" && { backgroundColor: colors.infoSoft }]}>
      <Text style={[styles.tagText, tone === "info" && { color: colors.info }]}>{text}</Text>
    </View>
  );
}

function PointList({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color, fontWeight: "700", fontSize: 12.5 }}>{title}</Text>
      {items.map((p, i) => (
        <Text key={i} style={{ fontSize: 13, color: colors.ink2, paddingLeft: 10 }}>・{formatMath(p)}</Text>
      ))}
    </View>
  );
}

function optionToneStyle(tone: string) {
  switch (tone) {
    case "right": return { backgroundColor: colors.successSoft, borderColor: colors.success };
    case "wrong": return { backgroundColor: colors.dangerSoft, borderColor: colors.danger };
    case "selected": return { backgroundColor: colors.accentSoft, borderColor: colors.accent };
    case "faded": return { borderColor: colors.line, opacity: 0.5 };
    default: return { borderColor: colors.line };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ground },
  crashText: { ...typography.h2, color: colors.ink },
  crashRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  crashButton: {
    minHeight: 44, minWidth: 96, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  crashButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  crashButtonText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  crashButtonTextPrimary: { color: "#fff" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, height: 56 },
  iconButton: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  content: { padding: spacing.xl, paddingTop: spacing.xs, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { ...typography.h2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#F4F4F5", paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  tagText: { fontSize: 10.5, fontWeight: "700", color: colors.ink2 },
  option: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, borderRadius: radius.md, borderWidth: 1.5 },
  optionBadge: { width: 22, height: 22, borderRadius: radius.full, borderWidth: 1.5, borderColor: "#D4D4D8", alignItems: "center", justifyContent: "center" },
  optionBadgeActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  optionBadgeSquare: { borderRadius: 6 },
  multiHint: { fontSize: 12, fontWeight: "700", color: colors.accent },
  optionBadgeText: { fontSize: 11, fontWeight: "800", color: colors.ink3 },
  optionText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  rightMark: { color: colors.success, fontSize: 11, fontWeight: "700" },
  textArea: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, minHeight: 140, fontSize: 13.5, color: colors.ink, textAlignVertical: "top" },
  hint: { fontSize: 12.5, color: colors.ink2 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { fontSize: 12.5, fontWeight: "600", color: colors.ink2 },
  pillTextActive: { color: "#fff", fontWeight: "700" },
  pillWarn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.warningLine, backgroundColor: colors.warningSoft },
  pillWarnActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  pillWarnText: { fontSize: 12.5, fontWeight: "600", color: "#B45309" },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: "center" },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  resultBanner: { borderRadius: radius.md, padding: spacing.md },
  gradeButton: { backgroundColor: colors.aiAccent, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  gradeButtonText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 4 },
  savedAt: { fontSize: 11.5, color: colors.ink3, paddingHorizontal: 2 },
  draftHint: { fontSize: 11.5, color: colors.info, fontWeight: "600" },
  drawHint: { fontSize: 12, lineHeight: 18, color: colors.ink2, backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  retryButton: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, backgroundColor: colors.surface },
  retryButtonText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  reportLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: spacing.sm },
  reportLinkText: { fontSize: 12, color: colors.ink3 },
  reportDone: { fontSize: 12, color: colors.success, textAlign: "center", paddingVertical: spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  reportNote: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, minHeight: 80, fontSize: 13, color: colors.ink, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  modalCancel: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.md },
  modalCancelText: { color: colors.ink2, fontWeight: "600", fontSize: 14 },
  modalSend: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: 10 },
  aiCard: { backgroundColor: colors.aiSoft, borderWidth: 1, borderColor: colors.aiLine, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  aiHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  aiScore: { fontSize: 22, fontWeight: "800" },
  // takes the score's color
  aiScoreMax: { fontSize: 13, fontWeight: "400" },
  feedback: { fontSize: 12.5, color: colors.ink2, borderTopWidth: 1, borderTopColor: colors.aiLine, paddingTop: spacing.sm },
});
