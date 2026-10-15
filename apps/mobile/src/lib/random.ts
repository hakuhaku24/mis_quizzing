import { supabase } from "./supabase";

/** A uniformly random question from the whole bank, avoiding `excludeId`
 *  (so "再抽一題" never hands back the question you just did). */
export async function randomQuestionId(excludeId?: number): Promise<number | null> {
  const { count } = await supabase.from("questions").select("id", { count: "exact", head: true });
  if (!count) return null;
  for (let i = 0; i < 4; i++) {
    const offset = Math.floor(Math.random() * count);
    const { data } = await supabase.from("questions").select("id").order("id").range(offset, offset);
    const id = data?.[0]?.id as number | undefined;
    if (id && id !== excludeId) return id;
  }
  return null;
}
