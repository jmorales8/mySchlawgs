import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const action = process.argv[2];
if (!["up", "setup", "dev", "stop"].includes(action)) {
  throw new Error("Usage: node scripts/docker-dev.mjs up|setup|dev|stop");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
}

if (!existsSync(".env")) {
  writeFileSync(".env", `POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}\n`, { flag: "wx", mode: 0o600 });
  console.log("Created private Docker database credentials in .env.");
}
if (action === "stop") {
  run("docker", ["compose", "stop", "db"]);
  process.exit(0);
}
run("docker", ["compose", "up", "-d", "--wait", "db"]);
if (action === "up") process.exit(0);

// Read the resolved settings without printing the password or changing user secrets.
const config = JSON.parse(run("docker", ["compose", "config", "--format", "json"], {
  stdio: ["ignore", "pipe", "inherit"], encoding: "utf8",
}).stdout);
const password = config.services.db.environment.POSTGRES_PASSWORD.replaceAll('"', '""');
process.env.ConnectionStrings__Postgres = `Host=localhost;Port=8080;Database=myschlawgs;Username=myschlawgs;Password="${password}"`;
process.env.ASPNETCORE_ENVIRONMENT = "Development";
run("dotnet", ["tool", "restore"]);
// Build separately so compiler errors and Windows file locks are visible.
run("dotnet", ["build", "backend/backend.csproj"]);
run("dotnet", ["tool", "run", "dotnet-ef", "database", "update", "--project", "backend/backend.csproj", "--no-build"]);
if (action === "dev") {
  // npm.cmd requires a shell on Windows; this command contains no user input.
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    shell: process.platform === "win32",
  });
}
