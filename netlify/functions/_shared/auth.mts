import type { Context } from "@netlify/functions";
import { scopedStore } from "./stores.mjs";

declare const Netlify: { env: { get(name: string): string | undefined } };

const COOKIE_NAME = "bioaves_admin";
const SESSION_SECONDS = 4 * 60 * 60;

type Session = { expiresAt: number };

function env(name: string): string {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = String(a || "");
  const right = String(b || "");
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function cookieToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const raw = cookie.split(/;\s*/).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return raw && /^[a-f0-9-]{73}$/i.test(raw) ? raw : null;
}

export function validateAdminCredentials(pin: string, password: string): boolean {
  return constantTimeEqual(pin, env("ADMIN_PIN")) && constantTimeEqual(password, env("ADMIN_PASSWORD"));
}

export async function createAdminSession(context: Context): Promise<string> {
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const store = scopedStore(context, "bioaves-auth", true);
  await store.setJSON(`sessions/${token}`, { expiresAt: Date.now() + SESSION_SECONDS * 1000 } satisfies Session);
  return token;
}

export async function isAdminRequest(req: Request, context: Context): Promise<boolean> {
  const token = cookieToken(req);
  if (!token) return false;
  const store = scopedStore(context, "bioaves-auth", true);
  const session = await store.get(`sessions/${token}`, { type: "json" }) as Session | null;
  if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
    if (session) await store.delete(`sessions/${token}`);
    return false;
  }
  return true;
}

export async function destroyAdminSession(req: Request, context: Context): Promise<void> {
  const token = cookieToken(req);
  if (!token) return;
  const store = scopedStore(context, "bioaves-auth", true);
  await store.delete(`sessions/${token}`);
}

export function adminCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
