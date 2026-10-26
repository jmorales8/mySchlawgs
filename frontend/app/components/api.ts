import { invalidateFeeds } from "./community/feed-cache";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "X-Schlawgs-Request": "1", ...options.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? (body.errors ? Object.values(body.errors).flat().join(" ") : response.status === 401 ? "Please log in to continue." : response.status === 429 ? "Too many attempts. Try again in a minute." : "Something went wrong. Please try again."));
  }
  if ((options.method ?? "GET").toUpperCase() !== "GET" && /^\/api\/(auth|photos|posts|profile|moderation|account)(\/|$)/.test(path)) invalidateFeeds();
  return response.status === 204 ? undefined as T : response.json();
}


