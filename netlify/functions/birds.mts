import type { Config, Context } from "@netlify/functions";
import { isAdminRequest } from "./_shared/auth.mjs";
import { INITIAL_BIRDS } from "./_shared/initial-birds.mjs";
import { scopedStore } from "./_shared/stores.mjs";

type Bird = { id: number; name: string; species: string; locationFound: string; photoUrl: string; description: string; region: string; createdAt: string };
function json(data: unknown, status = 200, extra: HeadersInit = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } }); }
function sameOrigin(req: Request) { const origin = req.headers.get("origin"); return !origin || origin === new URL(req.url).origin; }
function clean(value: FormDataEntryValue | null, max: number): string { if (typeof value !== "string") return ""; return value.replace(/\0/g, "").trim().slice(0, max); }
function detectImage(bytes: Uint8Array): { ext: string; contentType: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i])) return { ext: "png", contentType: "image/png" };
  const head6 = new TextDecoder().decode(bytes.slice(0, 6));
  if (head6 === "GIF87a" || head6 === "GIF89a") return { ext: "gif", contentType: "image/gif" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { ext: "webp", contentType: "image/webp" };
  return null;
}
async function readCatalog(context: Context): Promise<Bird[]> {
  const store = scopedStore(context, "bioaves-birds", true);
  const stored = await store.get("catalog.json", { type: "json" }) as Bird[] | null;
  return Array.isArray(stored) ? stored : (INITIAL_BIRDS.map((bird) => ({ ...bird })) as Bird[]);
}
function isRecentDuplicate(birds: Bird[], candidate: Omit<Bird, "id" | "photoUrl" | "createdAt">) {
  const cutoff = Date.now() - 30_000;
  return birds.find((bird) => {
    const created = Date.parse(bird.createdAt);
    return Number.isFinite(created) && created >= cutoff && bird.name === candidate.name && bird.species === candidate.species && bird.locationFound === candidate.locationFound && bird.region === candidate.region && bird.description === candidate.description;
  });
}

export default async (req: Request, context: Context) => {
  const idParam = context.params.id;
  if (req.method === "GET" && !idParam) {
    const birds = await readCatalog(context);
    birds.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json(birds);
  }
  if (!sameOrigin(req)) return json({ message: "Origem inválida." }, 403);
  let authenticated = false;
  try { authenticated = await isAdminRequest(req, context); } catch { authenticated = false; }
  if (!authenticated) return json({ message: "Sessão de administrador inválida ou expirada." }, 401);

  const catalogStore = scopedStore(context, "bioaves-birds", true);
  const imageStore = scopedStore(context, "bioaves-images", true);
  if (req.method === "POST" && !idParam) {
    let form: FormData;
    try { form = await req.formData(); } catch { return json({ message: "Formulário inválido." }, 400); }
    const name = clean(form.get("name"), 80);
    const species = clean(form.get("species"), 120);
    const locationFound = clean(form.get("locationFound"), 180);
    const region = clean(form.get("region"), 120);
    const description = clean(form.get("description"), 1200);
    const photo = form.get("photo");
    if (!name || !species || !locationFound || !region || !description || !(photo instanceof File) || photo.size === 0) return json({ message: "Todos os campos e a imagem são obrigatórios." }, 400);
    if (photo.size > 5 * 1024 * 1024) return json({ message: "A imagem deve ter no máximo 5 MB." }, 413);

    const buffer = await photo.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const image = detectImage(bytes);
    if (!image) return json({ message: "Formato de imagem inválido. Use JPG, PNG, GIF ou WebP." }, 415);

    const birds = await readCatalog(context);
    const duplicate = isRecentDuplicate(birds, { name, species, locationFound, region, description });
    if (duplicate) return json(duplicate, 200, { "X-BioAves-Duplicate": "true" });

    const nextId = birds.reduce((max, bird) => Math.max(max, Number(bird.id) || 0), 0) + 1;
    const filename = `${crypto.randomUUID()}.${image.ext}`;
    const bird: Bird = { id: nextId, name, species, locationFound, region, description, photoUrl: `/uploads/${filename}`, createdAt: new Date().toISOString() };
    await imageStore.set(filename, buffer);
    try { await catalogStore.setJSON("catalog.json", [bird, ...birds]); }
    catch (error) { await imageStore.delete(filename); throw error; }
    return json(bird, 201);
  }

  if (req.method === "DELETE" && idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) return json({ message: "ID inválido." }, 400);
    const birds = await readCatalog(context);
    const target = birds.find((bird) => bird.id === id);
    if (!target) return json({ message: "Registro não encontrado." }, 404);
    await catalogStore.setJSON("catalog.json", birds.filter((bird) => bird.id !== id));
    if (target.photoUrl.startsWith("/uploads/")) await imageStore.delete(target.photoUrl.slice("/uploads/".length));
    return json({ success: true });
  }
  return json({ message: "Método não permitido." }, 405, { "Allow": "GET, POST, DELETE" });
};

export const config: Config = { path: ["/api/birds", "/api/birds/:id"] };
