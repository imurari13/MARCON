const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

let onUnauthorized: (() => void) | null = null;
let csrfToken: string | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

/* ---------- instant navigation: tiny GET cache ----------
 * Repeat/parallel GETs are answered from memory (30 s), identical in-flight GETs share one network call, and ANY
 * write (POST/PUT/PATCH/DELETE) wipes the cache so screens always refetch fresh data after a change. */
const TTL = 30_000;
const cache = new Map<string, { t: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0;
export function clearApiCache() { generation++; cache.clear(); inflight.clear(); }
const copy = <V,>(v: V): V => (typeof structuredClone === "function" ? structuredClone(v) : v);

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET" && !init.headers && !path.startsWith("/auth/")) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.t < TTL) return copy(hit.data as T);
    let pending = inflight.get(path) as Promise<T> | undefined;
    if (!pending) {
      const gen = generation;
      pending = request<T>(path, init).then((d) => { if (gen === generation) cache.set(path, { t: Date.now(), data: d }); return d; }).finally(() => { if (gen === generation) inflight.delete(path); });
      inflight.set(path, pending);
    }
    return copy(await pending);
  }
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !path.startsWith("/auth/")) {
    try { return await request<T>(path, init); } finally { clearApiCache(); }
  }
  return request<T>(path, init);
}

/** Fire-and-forget: fetch the screens people open first so they are already in memory when tapped. */
export function warmCache(admin: boolean) {
  const d = new Date(), month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const paths = ["/dashboard", "/attendance/today", "/attendance", "/attendance/regularizations/mine", "/leave/mine", "/leave/balances", "/holidays", `/dashboard/calendar?month=${month}`, "/communications/notifications"];
  if (admin) paths.push("/employees");
  for (const p of paths) void apiRequest(p).catch(() => undefined);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && path !== "/auth/csrf" && !csrfToken) {
    const response = await fetch(`${BASE}/auth/csrf`, { credentials: "include" });
    const data = await response.json().catch(() => ({})) as { token?: string };
    if (!response.ok || !data.token) throw new Error("Unable to establish a secure session. Refresh and try again.");
    csrfToken = data.token;
  }
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) ? { "X-CSRF-Token": csrfToken } : {}), ...init.headers },
    });
  } catch {
    throw new Error("Cannot reach the server. Please check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { error?: unknown; csrfToken?: string };
  if (data.csrfToken) csrfToken = data.csrfToken;

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) onUnauthorized?.();
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${response.status})`);
  }
  return data as T;
}

/** Downloads a file from an authenticated GET endpoint and hands it to the browser as a save. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  let response: Response;
  try { response = await fetch(`${BASE}${path}`, { credentials: "include" }); }
  catch { throw new Error("Cannot reach the server. Please check your connection and try again."); }
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const data = (await response.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof data.error === "string" ? data.error : `Download failed (${response.status})`);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
