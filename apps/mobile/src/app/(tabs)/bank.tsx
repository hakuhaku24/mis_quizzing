import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getBankConcepts, getBankPage, getBankYears, getLatestAttempts, type BankFilters, type BankItem } from "../../lib/bank";
import { attemptBadge, sourceLabel, type AttemptOutcome } from "../../lib/labels";
import { stripMarkup } from "../../lib/text";
import { colors, radius, spacing, typography } from "../../lib/theme";

const TOPIC_LABELS: Record<string, string> = { all: "全部", CS: "計算機概論", DS: "資料結構", MIS: "管理資訊系統", STAT: "統計學" };
const SCHOOL_LABELS: Record<string, string> = { all: "全部", real: "真題", template: "範本題" };

export default function BankScreen() {
  const router = useRouter();
  const [school, setSchool] = useState<BankFilters["school"]>("all");
  const [topic, setTopic] = useState<BankFilters["topic"]>("all");
  const [examYear, setExamYear] = useState<BankFilters["examYear"]>("all");
  const [concept, setConcept] = useState<BankFilters["concept"]>("all");
  const [years, setYears] = useState<number[]>([]);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [items, setItems] = useState<BankItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBankYears().then(setYears);
  }, []);

  // The concept vocabulary depends on which subject is selected (DS's tags
  // — 樹/排序/圖/雜湊/搜尋… — are meaningless as filters for CS or MIS).
  useEffect(() => {
    let ignore = false;
    getBankConcepts(topic).then((c) => {
      if (!ignore) setConcepts(c);
    });
    return () => {
      ignore = true;
    };
  }, [topic]);

  const filters: BankFilters = { school, topic, examYear, concept };

  // Coming back from answering a question: refresh status badges in place
  // (keeps pagination and scroll position).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useFocusEffect(
    useCallback(() => {
      const ids = itemsRef.current.map((q) => q.id);
      if (!ids.length) return;
      let ignore = false;
      getLatestAttempts(ids).then((latest) => {
        if (ignore) return;
        setItems((prev) => prev.map((q) => ({ ...q, last_attempt: latest.get(q.id) ?? null })));
      });
      return () => {
        ignore = true;
      };
    }, [])
  );

  // "Load more" (pagination) — triggered from the list's onEndReached handler,
  // not from an effect, so setState here is a normal event-driven update.
  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const { items: newItems, hasMore: more } = await getBankPage(filters, page + 1);
      setItems((prev) => [...prev, ...newItems]);
      setHasMore(more);
      setPage((p) => p + 1);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school, topic, examYear, concept, page]);

  // Reset to page 0 whenever a filter changes — kept inline (not via a
  // shared callback) with an `ignore` guard, per the standard "fetch on
  // dependency change" effect pattern.
  useEffect(() => {
    let ignore = false;
    // React's compiler flags a setState call that's a direct statement in an
    // effect body, even one that only flips a loading flag — deferring it
    // into a microtask (same as the setItems/setHasMore calls below) keeps
    // the "show the spinner immediately" behavior without tripping that check.
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });
    getBankPage({ school, topic, examYear, concept }, 0)
      .then(({ items: newItems, hasMore: more }) => {
        if (ignore) return;
        setItems(newItems);
        setHasMore(more);
        setPage(0);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [school, topic, examYear, concept]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Text style={styles.title}>題庫</Text>

      <View style={styles.filterGroup}>
        <ChipRow
          options={["all", "real", "template"] as const}
          labels={SCHOOL_LABELS}
          active={school}
          onPick={(v) => { setSchool(v); if (v === "template") setExamYear("all"); }}
        />
        <ChipRow
          options={["all", "CS", "DS", "MIS"] as const}
          labels={TOPIC_LABELS}
          active={topic}
          onPick={(v) => { setTopic(v); setConcept("all"); }}
        />
        {concepts.length > 0 && (
          <ChipRow
            options={["all", ...concepts] as const}
            labels={{ all: "全部知識點" }}
            active={concept}
            onPick={setConcept}
          />
        )}
        {school !== "template" && years.length > 0 && (
          <ChipRow
            options={["all", ...years] as const}
            labels={{ all: "全部年份" }}
            formatLabel={(v) => (v === "all" ? "全部年份" : `${v} 學年`)}
            active={examYear}
            onPick={setExamYear}
          />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (hasMore && !loading) loadMore(); }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : <Text style={styles.empty}>沒有符合條件的題目</Text>
        }
        ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} /> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/question/${item.id}`)}>
            <View style={styles.tagRow}>
              {item.school && item.school !== "template" && (
                <Text style={styles.tagYear}>{sourceLabel(item)}</Text>
              )}
              <Text style={styles.tagTopic}>{TOPIC_LABELS[item.topic ?? ""] ?? item.topic}</Text>
              {item.concepts?.[0] && <Text style={styles.tagConcept}>#{item.concepts[0]}</Text>}
              <View style={{ flex: 1 }} />
              {item.last_attempt && <StatusBadge outcome={item.last_attempt} />}
            </View>
            <Text style={styles.rowText} numberOfLines={2}>{stripMarkup(item.question_text)}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function StatusBadge({ outcome }: { outcome: AttemptOutcome }) {
  const badge = attemptBadge(outcome);
  return (
    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
      <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text === "—" ? "已作答" : badge.text}</Text>
    </View>
  );
}

function ChipRow<T extends string | number>({
  options, labels, active, onPick, formatLabel,
}: {
  options: readonly T[];
  labels: Record<string, string>;
  active: T;
  onPick: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  return (
    <FlatList
      horizontal
      data={options as T[]}
      keyExtractor={(v) => String(v)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm }}
      renderItem={({ item }) => (
        <Pressable onPress={() => onPick(item)} style={[styles.chip, active === item && styles.chipActive]}>
          <Text style={[styles.chipText, active === item && styles.chipTextActive]}>
            {formatLabel ? formatLabel(item) : labels[String(item)] ?? String(item)}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  title: { ...typography.h1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  filterGroup: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { textAlign: "center", color: colors.ink3, paddingVertical: spacing.xxl },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  statusBadgeText: { fontSize: 10.5, fontWeight: "800" },
  tagYear: { fontSize: 10, fontWeight: "700", color: colors.ink2, backgroundColor: "#F4F4F5", paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  tagTopic: { fontSize: 10, fontWeight: "700", color: colors.info, backgroundColor: colors.infoSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  tagConcept: { fontSize: 10, fontWeight: "600", color: colors.ink3 },
  rowText: { fontSize: 13, color: colors.ink, lineHeight: 18 },
});
