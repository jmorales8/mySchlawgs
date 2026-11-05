export type FeedJoke = { setup: string; punchline: string; source: "local" | "jokesone" };

const fallbackJokes: FeedJoke[] = [
  { setup: "What do you call a dog magician?", punchline: "A labracadabrador!", source: "local" },
  { setup: "What do cats eat for breakfast?", punchline: "Mice Krispies!", source: "local" },
  { setup: "What do you call a rabbit with fleas?", punchline: "Bugs Bunny!", source: "local" },
];
export function fallbackJoke(): FeedJoke {
  return fallbackJokes[Math.floor(Math.random() * fallbackJokes.length)];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function dailyAnimalJoke(value: unknown): FeedJoke | null {
  const data = record(value);
  if (!data || data.error) return null;
  const contents = record(data.contents);
  if (!contents || !Array.isArray(contents.jokes)) return null;
  for (const entry of contents.jokes) {
    const item = record(entry);
    if (item?.category !== "animal") continue;
    const joke = record(item.joke);
    if (!joke || ![1, "1", true].includes(joke.clean as string | number | boolean) || ![0, "0", false].includes(joke.racial as string | number | boolean)) continue;
    if (typeof joke.text !== "string") continue;
    const text = joke.text.trim();
    if (!text || text.length > 1200) continue;
    const question = text.indexOf("?");
    const split = question >= 0 ? question + 1 : text.indexOf("\n");
    return { setup: split > 0 ? text.slice(0, split).trim() : text, punchline: split > 0 ? text.slice(split).trim() : "", source: "jokesone" };
  }
  return null;
}
