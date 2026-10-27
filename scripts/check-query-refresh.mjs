import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const requireFrontend = createRequire(new URL("../frontend/package.json", import.meta.url));
const ts = requireFrontend("typescript");
const { QueryClient, QueryObserver } = requireFrontend("@tanstack/react-query");
const source = await readFile(new URL("../frontend/app/lib/query-invalidation.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { invalidateApiQueries } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
const paths = ["/api/photos?feed=latest", "/api/photos?feed=interacted", "/api/posts/post-b", "/api/notifications?page=0", "/api/moderation/reports?page=0"];
const calls = new Map(paths.map(path => [path, 0]));
const subscriptions = [];
try {
  for (const path of paths) {
    const options = { queryKey: ["api", "test-account", path], queryFn: async () => { calls.set(path, calls.get(path) + 1); return []; } };
    await client.fetchQuery(options);
    subscriptions.push(new QueryObserver(client, options).subscribe(() => {}));
  }
  for (const mutation of ["/api/posts/post-a/reaction", "/api/posts/post-a/comments/comment-a/reaction", "/api/posts/post-a/comments/comment-a/like"]) {
    const before = new Map(calls);
    await invalidateApiQueries(client, mutation);
    for (const path of paths) {
      assert.equal(calls.get(path), before.get(path) + (path.startsWith("/api/notifications") ? 1 : 0), `Unnecessary refresh after ${mutation}: ${path}`);
    }
    assert.equal(client.getQueryState(["api", "test-account", paths[0]]).isInvalidated, true);
  }
  console.log("PASS post and comment reactions do not refetch visible feeds or other posts; notifications update");

  const feedCalls = calls.get(paths[0]);
  await client.fetchQuery({ queryKey: ["api", "test-account", paths[0]] });
  assert.equal(calls.get(paths[0]), feedCalls + 1);
  console.log("PASS stale feeds refresh on the next request");

  const beforeRead = new Map(calls);
  await invalidateApiQueries(client, "/api/notifications/notification-a/read");
  for (const path of paths) assert.equal(calls.get(path), beforeRead.get(path) + (path.startsWith("/api/notifications") ? 1 : 0));
  console.log("PASS marking notifications read does not refetch feeds");

  const beforeReport = new Map(calls);
  await invalidateApiQueries(client, "/api/posts/post-a/reports");
  for (const path of paths) assert.equal(calls.get(path), beforeReport.get(path) + 1);
  console.log("PASS reports still refresh feeds immediately for visibility changes");
} finally {
  subscriptions.forEach(unsubscribe => unsubscribe());
  client.clear();
}
