import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const ts = require("typescript");
const source = await readFile(new URL("../frontend/app/hooks/use-feed-caught-up.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const storage = new Map();
globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };

// Exercise the hook across visits, with effects flushed between renders.
function visit() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useRef(initial) { const slot = cursor++; return slots[slot] ??= { current: initial }; },
    useState(initial) { const slot = cursor++; slots[slot] ??= initial; return [slots[slot], value => { slots[slot] = value; }]; },
    useEffect(callback) { effects.push(callback); },
  };
  const exports = {};
  new Function("require", "exports", outputText)(name => name === "react" ? react : require(name), exports);
  return (ids, account = "guest", enabled = true) => {
    function render() { cursor = 0; effects = []; return exports.useFeedCaughtUp(account, ids, enabled); }
    render();
    effects.forEach(effect => effect());
    return render();
  };
}

assert.equal(visit()(["a", "b"]), false, "First visit shows fresh posts");
assert.equal(visit()(["a", "b"]), true, "Returning to unchanged feed shows caught up");
const newVisit = visit();
assert.equal(newVisit(["c", "a", "b"]), false, "A new post restores the fresh heading");
assert.equal(newVisit(["c", "a", "b"]), false, "Fresh heading lasts throughout the visit");
assert.equal(visit()(["c", "a", "b"]), true, "The next visit recognizes those posts as seen");
assert.equal(visit()(["c", "a"]), true, "Deleting a post does not count as a new post");
assert.equal(visit()(["c", "a"], "another-account"), false, "Accounts have separate history");
assert.equal(visit()(["unconfirmed"], "guest", false), false, "Loading and errors cannot claim caught up");
assert.equal(visit()(["c", "a"]), true, "Unconfirmed data does not update history");
console.log("PASS first visits, unchanged returns, new posts, repeat renders, deletions, account isolation, and loading/error gating");
