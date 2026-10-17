import type { AuthError, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { clearAllDrafts } from "./drafts";

/**
 * Guests (直接開始刷題) are Supabase anonymous users: a real user id without an
 * email, so attempts, RLS and the AI grading limit work exactly as for a
 * registered account. Adding an email later keeps the same id and every row.
 */
export function isGuest(session: Session | null | undefined): boolean {
  return session?.user.is_anonymous === true;
}

const AUTH_MESSAGES: Record<string, string> = {
  email_exists: "這個 email 已經有帳號了",
  user_already_exists: "這個 email 已經有帳號了",
  weak_password: "密碼至少要 6 個字",
  email_address_invalid: "email 格式不對",
  validation_failed: "email 格式不對",
  invalid_credentials: "email 或密碼不對",
  over_request_rate_limit: "嘗試太多次了，請稍後再試",
  anonymous_provider_disabled: "現在無法直接開始，請先登入或建立帳號",
};

export function authMessage(error: AuthError): string {
  return (error.code && AUTH_MESSAGES[error.code]) || error.message;
}

/** Carries Supabase's error code so a screen can react to e.g. email_exists. */
export class AccountError extends Error {
  code: string | undefined;
  constructor(error: AuthError) {
    super(authMessage(error));
    this.code = error.code;
  }
}

export const isEmailTaken = (e: unknown) =>
  e instanceof AccountError && (e.code === "email_exists" || e.code === "user_already_exists");

export async function startAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new AccountError(error);
}

/**
 * Guest → registered, same user id. Email and password go in one call so a
 * rejected password leaves the guest untouched; email confirmation is off in
 * the project, so the email applies at once.
 */
export async function linkAccount(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: email.trim(), password });
  if (error) throw new AccountError(error);
}

/** Attempts the current user would leave behind by switching accounts. */
export async function countOwnAttempts(): Promise<number> {
  const { count } = await supabase.from("user_attempts").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Guest → an existing account. Guest rows are not merged (decided
 * 2026-10-17: warn instead), so once the sign-in succeeds the guest account
 * is deleted with its own token rather than left orphaned on the server.
 */
export async function switchToAccount(email: string, password: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const guest = isGuest(data.session) ? data.session : null;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new AccountError(error);
  await clearAllDrafts();
  if (guest) {
    // best effort: a guest left behind is unreachable rows, not something the user sees
    await supabase.functions
      .invoke("delete-account", { method: "POST", headers: { Authorization: `Bearer ${guest.access_token}` } })
      .catch(() => undefined);
  }
}

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
