import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Draft {
  answer: string;
  selectedOption: string;
}

const key = (questionId: number) => `draft:question:${questionId}`;

export async function loadDraft(questionId: number): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(questionId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(questionId: number, draft: Draft): Promise<void> {
  try {
    if (!draft.answer.trim() && !draft.selectedOption) await AsyncStorage.removeItem(key(questionId));
    else await AsyncStorage.setItem(key(questionId), JSON.stringify(draft));
  } catch {
    // best effort: losing a draft must never block answering
  }
}

export async function clearDraft(questionId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(questionId));
  } catch {
    // ignore
  }
}

/** Remove every draft, e.g. on logout / account deletion so the next user doesn't see them. */
export async function clearAllDrafts(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("draft:question:"));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // ignore
  }
}
