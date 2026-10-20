# Reactions, comments, and shared posts

## Using the app

- **React** opens Like, Love, and Laugh. Select one to save it. Choosing a different reaction replaces yours; choosing your current reaction removes it.
- Click the reaction total to see usernames and the reactions they chose.
- **Comment** opens the conversation. Sign in to write a comment (up to 2,000 characters). Everyone can read it.
- The comment author, the owner of the post, and admins see **Remove comment**. Removal asks for confirmation, then permanently deletes the comment. The API independently checks permission; hiding the button is not the security control.
- **Share** opens the device's share sheet when supported. Otherwise it copies a link. A selectable link is also displayed if copying is unavailable.
- Links look like `https://your-site.example/posts/POST_UUID`. Opening one shows that entire post, including all carousel photos, captions, reactions, and comments. Login is only required to interact.

When running locally, links start with `http://localhost:3000`. They work on this computer; sharing with people elsewhere requires hosting the app at a reachable address. Links automatically use the current site's origin.

## Database relationships

| Table | What it stores |
| --- | --- |
| `posts` | One permanent UUID, owner ID, and creation time for each published post. |
| `photos` | `PostId` links each photo to its post; `BatchPosition` keeps carousel order. Descriptions remain attached to individual photos. |
| `post_reactions` | `PostId`, `UserId`, reaction `Kind`, and creation time. The combined primary key permits only one reaction per person per post. |
| `post_comments` | Comment UUID, `PostId`, `AuthorId`, text, and creation time. |
| `users` | Existing credentials/profile plus `IsAdmin`, which defaults to false. |

Example: Jaime shares two dog pictures. Both photos point to post **P**. Alex chooses Love: the database stores `(P, Alex, love)`. If Alex changes to Laugh, that same row becomes `(P, Alex, laugh)`; the total stays at one reaction. Alex's comment stores `(comment ID, P, Alex, text, time)`. A `/posts/P` link always opens this one two-photo post, even for a visitor without an account.

The migration creates post rows for existing photos. Existing carousel batch UUIDs become post UUIDs; older standalone photos use their photo UUID. Profile pictures do not become posts. Existing image bytes and descriptions are preserved.

## Admin setup

No existing account is automatically promoted, and registration ignores client-supplied admin fields. A database operator can promote a trusted account using a query such as:

```sql
UPDATE users
SET "IsAdmin" = TRUE
WHERE "NormalizedUsername" = UPPER('YOUR_USERNAME');
```

Replace `YOUR_USERNAME` with the exact trusted account. To revoke access, set `IsAdmin` to `FALSE`. Deletion permission is checked against the database on every request, so revocation takes effect immediately. Reload the page to update the visible buttons.

## API

Public reads:

- `GET /api/posts/{id}` — ordered photo metadata for a single post; 404 when missing.
- `GET /api/posts/{id}/activity` — reactions with usernames and comments with viewer-specific `canDelete` flags. Responses are not cached.

Authenticated writes (all also require `X-Schlawgs-Request: 1`):

- `PUT /api/posts/{id}/reaction` with `{ "kind": "like" }` (also `love` or `laugh`). Atomic upsert handles concurrent requests without duplicating reactions.
- `DELETE /api/posts/{id}/reaction` removes the signed-in person's reaction.
- `POST /api/posts/{id}/comments` with `{ "body": "What a good dog!", "photoId": "PHOTO_UUID" }`.
- `DELETE /api/posts/{id}/comments/{commentId}` checks comment author, post owner, or admin permission.

Writes derive identity from the authenticated session, never a supplied user ID. Social writes are limited to 60 requests per user per minute. This first version loads a post's complete activity; pagination and live updates are future scaling work.

## Development and validation

The database migration has been applied to the local development database. Restart an already-running backend to load the new code; `dotnet watch run` from `backend` watches subsequent changes. Run the frontend normally from `frontend`.

From the workspace root, with a fresh API running:

```powershell
dotnet run --project tests/SmokeTests.csproj -c Release -- http://localhost:5005
```

The integration suite creates unique temporary users and posts and removes them afterward. It checks public access, batch integrity, concurrent reaction uniqueness, validation, comment ownership, post-owner moderation, admin moderation, rejection of self-promotion, and immediate admin revocation.

## Per-photo comments and best quotes

New comments reference the photo being viewed when submitted. The numbered badge to the left identifies its slide (starting at 1). Older comments keep a “Post” label because their original slide was not recorded.

While viewing a photo, the post author can open Comments and choose **Use as best quote for photo N** on any comment in that post. The quote appears beneath that photo's description, with the commenter's username. Selecting another replaces it; **Remove best quote** leaves the photo without one. Each carousel photo has its own optional selection. Admins can moderate comments but cannot choose another author's quotes.

For example, Alex comments while viewing photo 4. The comment stores that photo's ID and displays badge **4**. Jaime selects it as photo 4's best quote. Moving to photo 3 shows photo 3's own quote (or none).

- `post_comments.PhotoId` is a nullable foreign key to `photos`; required by the API for new comments, null for legacy comments.
- `photos.BestQuoteCommentId` is one nullable foreign key to `post_comments`, so a photo cannot have multiple selected quotes. Deleting the source comment automatically clears every selection using it.
- `GET /api/posts/{id}/activity` includes comment `photoId` and `slideNumber`, `bestQuotes` photo/comment pairs, and the viewer's `canChooseQuote` permission.
- `PUT /api/posts/{id}/photos/{photoId}/quote` accepts `{ "commentId": "COMMENT_UUID" }`, or `{ "commentId": null }` to clear. The API verifies post ownership and that both photo and comment belong to the post.

Migration: `PhotoBestQuotes`. Integration coverage includes slide references, independent selections, replacement/removal, public access, permission checks, cross-post rejection, and automatic quote cleanup. The suite now passes 69 checks.

## Feeling bored? Random discovery

The panel beneath the profile lets visitors choose a category and press **Surprise me**:

- **Popular:** at least 5 total reactions plus comments. Like, Love, and Laugh each count once.
- **Niche:** fewer than 5 total reactions plus comments, including undiscovered posts with zero engagement.
- **Relevant:** at least one comment created in the past 7 days (UTC), regardless of upload date.

`GET /api/posts/random?category=popular&excludePostId=POST_UUID` returns `{ "postId": "..." }`. Category is required (`popular`, `niche`, or `relevant`); the exclusion is optional. The server picks randomly among qualifying posts, excluding the signed-in user's own posts, the specified current post, empty posts, and ownerless legacy posts. Guests can use it too. A 404 with a friendly message means no match; the category is never silently changed. Each selected URL opens the existing public carousel post page.

No schema change is required. Eligibility uses current database counts and comment timestamps. The integration suite now passes 80 checks, including discovery category rules and own/current-post exclusion.


## Reports and moderation

Anyone with an account can report a post once. The form offers spam/scam, harassment, hate speech, violence, animal abuse, sexual content, privacy, and other, with optional details (1,000 characters maximum). Reports are private to moderators/admins. Each account is limited to 10 report attempts per hour.

`post_reports` uses `(PostId, ReporterId)` as its primary key. Duplicate submissions cannot increase the count. Reporting locks the post row inside a transaction so simultaneous submissions cannot skip the threshold: **10 reports keeps it public; the 11th distinct account report automatically removes it**.

Removal is a soft takedown: `posts.RemovedAt`, `RemovedById`, and `RemovalReason` record when, who (null for automatic removal), and why. Removed posts disappear from public feeds, shared pages, random discovery, activity, and direct photo downloads. Database evidence remains available through authenticated moderator-only endpoints. A previously downloaded image cannot be recalled from someone's device.

Moderators and admins get a **Moderation queue** link in the avatar menu and a **Remove post · Moderator** control on posts. `/moderation` lists reported and removed posts, with private photo previews and report details. Removal requires a reason and confirmation. No account is automatically promoted, and signup cannot set roles. Assign a trusted moderator directly in the database:

```sql
UPDATE users SET "IsModerator" = TRUE
WHERE "NormalizedUsername" = UPPER('TRUSTED_USERNAME');
```

Use `FALSE` to revoke the role. Permissions are checked against the database on every moderation request; refresh the UI to update visible controls. Moderators can also remove inappropriate comments; they cannot choose another author's best quotes. The queue also supports author disputes: accepting one dismisses active reports and restores the post; rejecting one preserves its status.

API: `POST /api/posts/{id}/reports` with `{ "reason": "spam", "details": "Optional explanation" }`; `GET /api/moderation/reports?page=0`; `GET /api/moderation/photos/{id}`; `POST /api/moderation/posts/{id}/remove` with `{ "reason": "Reason for removal" }`. Public activity exposes only the current viewer's `reportedByMe` and `canModerate`, not report identities or details.

## Comment likes and threaded replies

Every signed-in user can like/unlike a comment. `comment_likes` stores one row per comment/user. When the post author likes it, everyone sees **♥ Author liked this** beside that comment; unliking removes the badge. Like counts and the viewer's selection are persisted and included in public activity responses.

Use **Reply** beneath any comment or reply. Replies are displayed beneath their parent with indentation and a “Reply to @username” label. Deep threads remain readable on mobile because visual indentation is capped. Replies inherit their parent's photo reference, even if the viewer switches slides. Removing a parent preserves its replies and labels them “Original comment removed.” Best quotes can use replies too.

`post_comments.ParentCommentId` links replies, with `IsReply` retaining context after parent deletion. `POST /api/posts/{id}/comments` accepts optional `parentCommentId`; parent must belong to the same post. `PUT` / `DELETE /api/posts/{id}/comments/{commentId}/like` adds/removes the signed-in user's like. Existing social rate limits and moderation permissions apply.

Migration: `ModerationAndCommentThreads`.

## Notifications and disputes

Signed-in users have a compact **Notifications** link beside the avatar, with an unread badge. `/notifications` lists new post reactions, comments, replies to the user's comments, comment likes, best-quote selections, reports, takedowns, and dispute decisions. It refreshes every 30 seconds while visible. The inbox also shows how many distinct other people currently react/comment on the user's published posts. These totals describe current engagement, while notification items are historical activity.

Notifications are persisted with recipient, post, event key, type, message, timestamp, and read timestamp. Unique event keys prevent retries or toggling a like from generating repeated alerts. Users do not receive alerts for their own social actions. Mark one item or the visible page read; read state follows the account. New notifications start with this feature's deployment; old social activity is not retroactively notified.

**Your reports & disputes** (`/account/reports`) shows only the owner's posts, including removed posts, report counts/categories, takedown reasons, and dispute history. Reporter identities and their free-text report details remain private to moderators. Notification links open the affected post's report page. Owners can privately view their removed photos to prepare a dispute.

An owner can submit one pending dispute per post with an explanation (maximum 2,000 characters). Moderators/admins review disputes from the moderation queue and must provide a reason (maximum 1,000 characters). They cannot review their own posts. Accepting dismisses all currently active reports and restores public availability. Rejecting preserves the current post status. Both decisions notify the owner and retain an audit record with reviewer and decision time. A rejected dispute can be raised again only after a new report or takedown, rather than repeatedly contesting unchanged evidence.

Report submission, takedown, and dispute decisions lock the same post row to serialize concurrent changes. Dismissed reports stay in the database for history but no longer count toward the 11-report takedown. Each account still has only one report per post, including dismissed reports. A new reporter after restoration starts from the remaining active count.

API: authenticated `GET /api/notifications?page=0`, `PUT /api/notifications/{id}/read`, `GET /api/account/reports?page=0&postId=OPTIONAL_UUID`, `GET /api/account/reports/photos/{id}`, and `POST /api/account/reports/{postId}/dispute` with `{ "explanation": "..." }`. Moderator-only decision: `POST /api/moderation/disputes/{id}/decision` with `{ "accept": true, "reason": "..." }`. All writes require the existing CSRF header; dispute submissions share the report rate limit.

Migration: `NotificationsAndDisputes`. Verification: 151 integration checks plus the CAPTCHA verifier checks; frontend production build and lint pass. No test server is left running.
