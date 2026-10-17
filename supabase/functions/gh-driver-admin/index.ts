// Creates, updates and removes delivery-driver accounts for GH Shopper.
// Only the business owner (a user with a gh_settings row) may call it.
// Drivers sign in with their phone number, mapped to a private e-mail.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** 8-digit Omani numbers get the 968 prefix; anything else keeps its digits. */
function phoneDigits(raw: string): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length === 8 ? `968${d}` : d;
}

const driverEmail = (digits: string) => `d${digits}@drivers.ghshopper.com`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who } = await admin.auth.getUser(token);
  const caller = who?.user;
  if (!caller) return json({ error: "سجّل دخول أول" }, 401);

  const { data: owner } = await admin
    .from("gh_settings").select("owner").eq("owner", caller.id).maybeSingle();
  if (!owner) return json({ error: "غير مسموح" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const action = String(body.action ?? "");

  const ownDriver = async (id: unknown) => {
    const { data } = await admin.from("gh_drivers")
      .select("id, user_id, owner").eq("id", String(id)).maybeSingle();
    return data && data.owner === caller.id ? data : null;
  };

  if (action === "create") {
    const name = String(body.name ?? "").trim();
    const digits = phoneDigits(String(body.phone ?? ""));
    const password = String(body.password ?? "");
    if (!name || digits.length < 8) return json({ error: "اكتب الاسم والرقم" }, 400);
    if (password.length < 6) return json({ error: "كلمة المرور ٦ خانات على الأقل" }, 400);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: driverEmail(digits),
      password,
      email_confirm: true,
      user_metadata: { gh_driver: true, name },
    });
    if (error || !created.user) {
      const taken = /already|registered|exists/i.test(error?.message ?? "");
      return json({ error: taken ? "هذا الرقم مسجّل لمندوب ثاني" : (error?.message ?? "خطأ") }, 400);
    }
    const { data: row, error: insErr } = await admin.from("gh_drivers").insert({
      owner: caller.id,
      user_id: created.user.id,
      name,
      phone: digits,
    }).select().single();
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: insErr.message }, 400);
    }
    return json({ driver: row });
  }

  if (action === "password") {
    const d = await ownDriver(body.driver_id);
    if (!d?.user_id) return json({ error: "المندوب غير موجود" }, 404);
    const password = String(body.password ?? "");
    if (password.length < 6) return json({ error: "كلمة المرور ٦ خانات على الأقل" }, 400);
    const { error } = await admin.auth.admin.updateUserById(d.user_id, { password });
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  if (action === "delete") {
    const d = await ownDriver(body.driver_id);
    if (!d) return json({ error: "المندوب غير موجود" }, 404);
    await admin.from("gh_drivers").delete().eq("id", d.id);
    if (d.user_id) await admin.auth.admin.deleteUser(d.user_id);
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
