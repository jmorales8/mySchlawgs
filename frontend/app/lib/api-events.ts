// Successful writes notify the query provider, including writes in components
// that have not yet been migrated to mutation hooks.
export const API_CHANGED = "myschlawgs:api-changed";
export type ApiChange = { path: string; method: string };
