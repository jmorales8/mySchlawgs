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
