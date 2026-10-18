import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 我的 › 首頁的題目來源: the sources a user turned off for 每日練習 and 隨機一題
 * (a school code, or "template" for 範本題). What is kept is the ones turned
 * OFF, so a school added later (中山) starts on. Stored on this phone only
 * (developer's choice, 2026-10-19): a new phone starts with everything on.
 * The 題庫 tab ignores it — it has its own school filter.
 */
const key = (userId: string) => `excluded-sources:${userId}`;

export async function loadExcludedSources(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    const codes: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(codes) ? codes.filter((c): c is string => typeof c === "string") : []);
  } catch {
    return new Set();
  }
}

export async function saveExcludedSources(userId: string, codes: Set<string>): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify([...codes].sort()));
}

/** Questions without a school are never filtered out. */
export function sourceAllowed(excluded: Set<string>, school: string | null): boolean {
  return !school || !excluded.has(school);
}
