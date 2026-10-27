# mySchlawgs backend

ASP.NET Core 10 + PostgreSQL, with username/password accounts, cookie sessions, profile pictures, and animal photo sharing.

## Local setup

For PostgreSQL through Docker, follow the [Docker setup in the root README](../README.md#docker-database-recommended-for-local-development).
`npm run dev:docker` supplies the Docker connection and applies migrations
without changing your saved connection string. The instructions below are
for an existing PostgreSQL installation.

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
| PATCH | /api/posts/{id}/comments/{commentId} | Comment author only; JSON body, 1–2,000 characters; works for comments and replies |
| PUT / DELETE | /api/posts/{id}/comments/{commentId}/reaction | Set JSON kind (`like`, `love`, or `laugh`), or remove your reaction |
| POST | /api/profile/photo | Authenticated multipart upload with one image; returns updated account |

Uploads support JPEG, PNG, GIF, and WebP, with signature checks. Up to 10 photos per batch, 10 MB per file, 50 MB combined. Each description is optional (send an empty field) and limited to 2,000 characters. Invalid batches save nothing. Profile images are excluded from the feed. Images are stored in PostgreSQL bytea columns. The initial feed returns all metadata; pagination and object storage are future scaling work.

All new post, profile, and animal-picture uploads are decoded and re-encoded
with Magick.NET before storage. This strips EXIF/GPS, XMP, IPTC, ICC profiles,
comments, and trailing data. EXIF orientation is applied first; embedded color
profiles are converted to sRGB before removal. GIF/WebP frame timing and loop
counts are preserved. Stored filenames are generated from photo IDs, and
stored sizes describe the cleaned files. JPEGs are re-encoded at quality 90.
Processing rejects malformed images and limits dimensions to 16,384 per side,
200 frames, and 50 million pixels across all frames. Cleaned files must still
fit the 10 MB/file and 50 MB/batch limits. The original bytes are not saved.
Existing database images are not rewritten by this change.

Run the focused metadata checks with:

```powershell
dotnet run --project tests/SmokeTests.csproj -c Release -- --images-only
```

## Comment reactions

Comment and reply reactions allow one choice per account, with atomic replacement.
Existing `comment_likes` records are preserved as `like` by the CommentReactions
migration. Activity responses include counts by kind, the viewer's choice, and
the post author's reaction. The older `/like` endpoints remain supported.

## Reported post visibility

The first active report hides a post from Latest, Liked / interacted, random
discovery, and public post/image/activity URLs. The author retains access in
My photos and sees an awaiting-review notice. Reports do not automatically
remove a post based on their count. A moderator removal hides it from My photos
as well; the private reports page retains evidence for review and disputes.
An accepted dispute dismisses active reports and restores public visibility.

## Integration checks

With the API running, from the workspace root:

```powershell
dotnet run --project tests/SmokeTests.csproj -c Release -- http://localhost:5005
```

The checks use the configured development database, create unique temporary users/photos, verify account and upload behavior, and delete only their own test data in a finally block. Pass http://localhost:3000 to also test the frontend proxy.

The PhotoUploadBatches migration adds nullable BatchId and BatchPosition to photos. New uploads share a batch ID and preserve selection order; the feed includes both fields so clients can reconstruct carousels. Legacy photos retain null batch IDs.
