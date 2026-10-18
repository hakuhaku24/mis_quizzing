import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/**
 * Consent to send answers to third-party AI for grading (Apple 5.1.2(i)).
 * Bump CONSENT_VERSION whenever the list of AI providers changes (e.g. when
 * the paid Gemini fallback is enabled) so everyone is asked again.
 */
const CONSENT_VERSION = 2;
// Same two providers as before (Gemini first since 2026-10-19), so no new consent is needed.
export const AI_PROVIDERS = "Google Gemini 付費服務；Gemini 暫時無法使用時可能改用 Groq";

export const CONSENT_TITLE = "AI 批改說明";
export const CONSENT_MESSAGE =
  `按下「同意並批改」後，你這一題的作答內容會傳送給第三方 AI 服務（${AI_PROVIDERS}）進行批改，` +
  "批改結果會存在你的帳號中。我們不會傳送你的 email 或其他帳號資料。\n\n" +
  "不想使用 AI 批改也沒關係，可以對照詳解手動自評。";

async function key(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  return userId ? `ai-consent-v${CONSENT_VERSION}:${userId}` : null;
}

export async function hasAIConsent(): Promise<boolean> {
  try {
    const k = await key();
    return !!k && (await AsyncStorage.getItem(k)) === "granted";
  } catch {
    return false;
  }
}

export async function grantAIConsent(): Promise<void> {
  try {
    const k = await key();
    if (k) await AsyncStorage.setItem(k, "granted");
  } catch {
    // if it can't be remembered, the user is simply asked again next time
  }
}
