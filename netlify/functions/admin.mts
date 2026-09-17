import type { Config, Context } from "@netlify/functions";
import { adminCookie, clearAdminCookie, createAdminSession, destroyAdminSession, isAdminRequest, validateAdminCredentials } from "./_shared/auth.mjs";
import { scopedStore } from "./_shared/stores.mjs";

type Attempt = { count: number; resetAt: number; blockedUntil?: number };

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}
function sameOrigin(req: Request) { const origin = req.headers.get("origin"); return !origin || origin === new URL(req.url).origin; }
function attemptKey(ip: string) { return `attempts/${encodeURIComponent(ip || "unknown")}.json`; }

export default async (req: Request, context: Context) => {
  const pathname = new URL(req.url).pathname;
  if (pathname.endsWith("/status") && req.method === "GET") {
    try { return json({ authenticated: await isAdminRequest(req, context) }); } catch { return json({ authenticated: false }); }
  }
  if (!sameOrigin(req)) return json({ message: "Origem inválida." }, 403);
  if (pathname.endsWith("/logout") && req.method === "POST") {
    try { await destroyAdminSession(req, context); } catch {}
    return json({ success: true }, 200, { "Set-Cookie": clearAdminCookie() });
  }
  if (!pathname.endsWith("/login") || req.method !== "POST") return json({ message: "Método não permitido." }, 405, { "Allow": "GET, POST" });

  const store = scopedStore(context, "bioaves-auth", true);
  const key = attemptKey(context.ip || "unknown");
  const now = Date.now();
  const current = await store.get(key, { type: "json" }) as Attempt | null;
  if (current?.blockedUntil && current.blockedUntil > now) return json({ message: "Muitas tentativas. Tente novamente em alguns minutos." }, 429);

  let body: { pin?: string; password?: string } = {};
  try { body = await req.json(); } catch { return json({ message: "JSON inválido." }, 400); }
  try {
    if (!validateAdminCredentials(String(body.pin || ""), String(body.password || ""))) {
      const resetAt = current && current.resetAt > now ? current.resetAt : now + 15 * 60 * 1000;
      const count = current && current.resetAt > now ? current.count + 1 : 1;
      const next: Attempt = { count, resetAt };
      if (count >= 5) next.blockedUntil = now + 15 * 60 * 1000;
      await store.setJSON(key, next);
      return json({ message: "PIN ou senha inválidos." }, 401);
    }
  } catch { return json({ message: "Credenciais administrativas ainda não foram configuradas no Netlify." }, 503); }

  await store.delete(key);
  const token = await createAdminSession(context);
  return json({ success: true }, 200, { "Set-Cookie": adminCookie(token) });
};

export const config: Config = { path: ["/api/admin/login", "/api/admin/logout", "/api/admin/status"] };
