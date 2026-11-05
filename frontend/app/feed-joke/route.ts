import { fallbackJoke, dailyAnimalJoke, type FeedJoke } from "../lib/feed-jokes";

let saved: { day: string; joke: FeedJoke } | null = null;
let retryAfter = 0;
let pending: Promise<FeedJoke> | null = null;

async function loadDailyJoke(): Promise<FeedJoke> {
  const day = new Date().toISOString().slice(0, 10);
  if (saved?.day === day) return saved.joke;
  if (Date.now() < retryAfter) return fallbackJoke();
  // Limit retries during outages rather than spending the free quota on every refresh.
  retryAfter = Date.now() + 15 * 60 * 1000;
  const response = await fetch("https://api.jokes.one/jod?category=animal", {
    headers: { Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Jokes One returned HTTP ${response.status}`);
  const joke = dailyAnimalJoke(await response.json());
  if (!joke) throw new Error("Jokes One returned no valid clean animal joke");
  saved = { day, joke };
  return joke;
}

export async function GET() {
  let joke = fallbackJoke();
  try {
    // Concurrent visitors share a request; only successful daily jokes are retained.
    if (!pending) pending = loadDailyJoke().finally(() => { pending = null; });
    joke = await pending;
  } catch (error) {
    console.warn("Daily animal joke unavailable:", error instanceof Error ? error.message : "Unknown provider error");
  }
  return Response.json(joke, { headers: { "Cache-Control": "no-store" } });
}
