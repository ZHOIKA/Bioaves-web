import type { Config, Context } from "@netlify/functions";
import { scopedStore } from "./_shared/stores.mjs";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
export default async (req: Request, context: Context) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
  const filename = String(context.params.key || "");
  const match = filename.match(/^[a-f0-9-]{36}\.(jpg|jpeg|png|gif|webp)$/i);
  if (!match) return new Response("Not Found", { status: 404 });
  const store = scopedStore(context, "bioaves-images", true);
  const data = await store.get(filename, { type: "arrayBuffer" }) as ArrayBuffer | null;
  if (!data) return new Response("Not Found", { status: 404 });
  return new Response(req.method === "HEAD" ? null : data, { status: 200, headers: { "Content-Type": MIME[match[1].toLowerCase()] || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
};
export const config: Config = { path: "/uploads/:key" };
