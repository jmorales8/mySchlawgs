# mySchlawgs

## Start the whole app

From this project root:

```powershell
npm run dev
```

This starts the ASP.NET backend at http://localhost:5005, waits for its API to respond, then starts the Next.js frontend at http://localhost:3000. This avoids connection-refused errors while the backend compiles. Frontend changes refresh automatically; `dotnet watch` reloads backend changes. Logs are labeled `frontend` and `backend`. Press **Ctrl+C** to stop both. If either command exits, concurrently stops the other too.

The startup wait times out after two minutes with a message directing you to the backend logs. Set `BACKEND_START_TIMEOUT_MS` if you need longer. The readiness check respects `PHOTO_API_URL` when supplied in the terminal environment.

Stop any copies you previously started in separate terminals before running this command, so ports 3000 and 5005 are available.

### First-time setup

#### Docker database (recommended for local development)

Install Docker Desktop, Node.js (with npm), and the .NET 10 SDK. Start Docker
Desktop, then run these commands from the project root:

```powershell
npm run setup
npm run dev:docker
```

`dev:docker` starts PostgreSQL 18, waits for it to be ready, applies Entity
Framework migrations, then starts the frontend and backend. The first run
downloads the database image and generates a private password in `.env`.
The apps still run locally with hot reload; only PostgreSQL runs in Docker.
The backend connection is set for this command only, so existing .NET user
secrets remain intact. CAPTCHA setup is documented in [SECURITY-SETUP.md](SECURITY-SETUP.md).

The Docker database is accessible at `localhost:5433`; the existing native
PostgreSQL database on port 5432 remains separate. Use `npm run dev:docker`
each time you want the Docker database. Plain `npm run dev` continues using
your usual database configuration.

Other database commands:

```powershell
npm run db:up       # Start only PostgreSQL; generate .env if needed
npm run db:setup    # Start PostgreSQL and apply migrations without starting the app
npm run db:stop     # Stop PostgreSQL while preserving data
docker compose ps  # Show database status
```

Data lives in a Docker volume and survives container replacement and
`docker compose down`. **Do not use `docker compose down -v` unless you want
to delete the Docker database.** Keep `.env` with the volume: changing the
password in `.env` does not change the password of an existing database.

Each developer gets a separate database. Migrations create the same tables,
but do not copy anyone else's users, photos, or posts. For an identical data
snapshot, privately share a database backup; it contains account records and
uploaded images and must not be committed to Git. Future edits do not sync.

To export the Docker database without corrupting binary data through shell
redirection:

```powershell
docker compose exec -T db pg_dump -U myschlawgs -d myschlawgs -Fc --no-owner --no-acl -f /tmp/snapshot.dump
New-Item -ItemType Directory -Path backups -Force
docker compose cp db:/tmp/snapshot.dump backups/snapshot.dump
docker compose exec -T db rm /tmp/snapshot.dump
```

On a new developer's **empty** Docker database, run `npm run db:up`, then
restore the privately supplied snapshot before running `npm run dev:docker`:

```powershell
docker compose cp backups/snapshot.dump db:/tmp/snapshot.dump
docker compose exec -T db pg_restore -U myschlawgs -d myschlawgs --no-owner --no-acl --single-transaction /tmp/snapshot.dump
docker compose exec -T db rm /tmp/snapshot.dump
```

This restore intentionally fails on conflicting existing tables rather than
overwriting data. `.env` and `backups/` are ignored by Git. This Compose setup
is for local development, with the database port bound to this computer only.

#### Existing PostgreSQL installation

Install Node.js (with npm), the .NET 10 SDK, and PostgreSQL, then run:

```powershell
npm run setup
```

Configure the local database and apply migrations using [backend/README.md](backend/README.md). PostgreSQL must already be running; this command starts the two app servers, not the database. CAPTCHA setup is documented in [SECURITY-SETUP.md](SECURITY-SETUP.md).

### Start only one server

Start the backend first; the frontend command waits until it is available.

```powershell
npm run dev:frontend
npm run dev:backend
```
