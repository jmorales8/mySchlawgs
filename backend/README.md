# mySchlawgs backend

ASP.NET Core 10 + PostgreSQL, with username/password accounts, cookie sessions, profile pictures, and animal photo sharing.

## Local setup

Configure the existing database connection using .NET user secrets from `backend`:

```powershell
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=myschlawgs;Username=postgres;Password=YOUR_PASSWORD"
```

From the workspace root, apply migrations and run the API:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet tool restore
dotnet build backend/backend.csproj -c Release
dotnet tool run dotnet-ef database update --project backend/backend.csproj --configuration Release --no-build
dotnet run --project backend/backend.csproj
```

The default HTTP address is http://localhost:5005. Existing photos are preserved by the account migration and appear without an owner. New uploads require a login.

## Accounts

- Usernames: 3–30 ASCII letters, numbers, or underscores; case-insensitive uniqueness and login.
- Passwords: 8–128 characters at registration, hashed with ASP.NET Core's salted PasswordHasher. Plaintext passwords are never stored.
- No email or confirmation step. Registration signs the user in immediately.
- HttpOnly, SameSite=Strict cookies last seven days; production cookies require HTTPS.
- Registration and login are rate limited. Persistent deployments must preserve ASP.NET Data Protection keys so sessions survive restarts.

## API

All POST/PATCH requests require `X-Schlawgs-Request: 1`. Browser traffic uses the frontend's same-origin `/api` proxy; cross-origin writes are not enabled.

| Method | Path | Body / behavior |
| --- | --- | --- |
| POST | /api/auth/register | JSON username, password; returns account and sets cookie |
| POST | /api/auth/login | JSON username, password; returns account and sets cookie |
| GET | /api/auth/me | Current account, or 401 |
| POST | /api/auth/logout | Clears cookie |
| GET | /api/photos | Public feed metadata with owner, avatar, and description |
| GET | /api/photos/{id} | Public image bytes |
| POST | /api/photos | Authenticated multipart upload; repeated files and descriptions fields, in matching order |
| PATCH | /api/photos/{id} | Owner only; JSON description |
| POST | /api/profile/photo | Authenticated multipart upload with one image; returns updated account |

Uploads support JPEG, PNG, GIF, and WebP, with signature checks. Up to 10 photos per batch, 10 MB per file, 50 MB combined. Each description is optional (send an empty field) and limited to 2,000 characters. Invalid batches save nothing. Profile images are excluded from the feed. Images are stored in PostgreSQL bytea columns. The initial feed returns all metadata; pagination and object storage are future scaling work.

## Integration checks

With the API running, from the workspace root:

```powershell
dotnet run --project tests/SmokeTests.csproj -c Release -- http://localhost:5005
```

The checks use the configured development database, create unique temporary users/photos, verify account and upload behavior, and delete only their own test data in a finally block. Pass http://localhost:3000 to also test the frontend proxy.

The PhotoUploadBatches migration adds nullable BatchId and BatchPosition to photos. New uploads share a batch ID and preserve selection order; the feed includes both fields so clients can reconstruct carousels. Legacy photos retain null batch IDs.
