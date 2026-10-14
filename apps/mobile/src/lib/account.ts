import { supabase } from "./supabase";
import { clearAllDrafts } from "./drafts";

export async function logout(): Promise<void> {
  await clearAllDrafts();
  await supabase.auth.signOut();
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) {
    const context = (error as { context?: Response }).context;
    const body = context ? await context.json().catch(() => null) : null;
    throw new Error(body?.error ?? "刪除帳號失敗，請稍後再試");
  }
  await clearAllDrafts();
  // local scope: the user no longer exists server-side, so skip the logout call
  await supabase.auth.signOut({ scope: "local" });
}
