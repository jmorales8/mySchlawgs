const baseUrl = process.env.PHOTO_API_URL ?? "http://localhost:5005";
const timeoutMs = Number(process.env.BACKEND_START_TIMEOUT_MS ?? 120000);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error("BACKEND_START_TIMEOUT_MS must be a positive number.");
  process.exit(1);
}

const endpoint = new URL("api/auth/captcha", `${baseUrl.replace(/\/$/, "")}/`);
const deadline = Date.now() + timeoutMs;
console.log("Waiting for the backend to finish starting…");

let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(Math.max(1, Math.min(2000, deadline - Date.now()))),
      cache: "no-store",
    });
    // Check the public config endpoint, not an authenticated route or just an open port.
    const config = response.ok ? await response.json() : null;
    if (!response.ok) await response.body?.cancel();
    if (typeof config?.enabled === "boolean") { ready = true; break; }
  } catch {
    // A refused connection is expected while dotnet watch is compiling.
  }
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Math.min(500, deadline - Date.now()))));
}

if (!ready) {
  console.error(`Backend did not become ready within ${Math.round(timeoutMs / 1000)} seconds. Check the backend logs above. Frontend was not started.`);
  process.exit(1);
}
console.log("Backend is ready. Starting the frontend…");
