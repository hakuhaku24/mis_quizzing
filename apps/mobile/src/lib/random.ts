import { supabase } from "./supabase";
import { loadExcludedSources } from "./sources";

/** A uniformly random question from the whole bank, avoiding `excludeId`
 *  (so "再抽一題" never hands back the question you just did) and any source
 *  turned off in 我的 › 首頁的題目來源. */
export async function randomQuestionId(excludeId?: number): Promise<number | null> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  const off = userId ? [...(await loadExcludedSources(userId))] : [];
  // questions without a school are never filtered out, same as daily.ts
  const onlyOn = off.length > 0 ? `school.is.null,school.not.in.(${off.join(",")})` : null;

  let counting = supabase.from("questions").select("id", { count: "exact", head: true });
  if (onlyOn) counting = counting.or(onlyOn);
  const { count } = await counting;
  if (!count) return null;
  for (let i = 0; i < 4; i++) {
    const offset = Math.floor(Math.random() * count);
    let picking = supabase.from("questions").select("id");
    if (onlyOn) picking = picking.or(onlyOn);
    const { data } = await picking.order("id").range(offset, offset);
    const id = data?.[0]?.id as number | undefined;
    if (id && id !== excludeId) return id;
  }
  return null;
}
