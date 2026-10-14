// Supabase Edge Function — permanently deletes the calling user's account and data.
// Identity comes from the caller's JWT; the service_role key (auto-injected by
// Supabase, never shipped to the app) is needed only for the deletes, since
// user_attempts / user_question_states have no FK cascade to auth.users.
//
// Deploy: npx supabase functions deploy delete-account

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "未登入" }, { status: 401 });

    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await asUser.auth.getUser();
    if (userErr || !user) return Response.json({ error: "未登入" }, { status: 401 });

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    for (const table of ["user_attempts", "user_question_states"]) {
      const { error } = await admin.from(table).delete().eq("user_id", user.id);
      if (error) return Response.json({ error: `刪除資料失敗（${table}）` }, { status: 500 });
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return Response.json({ error: "刪除帳號失敗" }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
