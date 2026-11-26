using System.Security.Claims;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class NotificationEndpoints
{
    public sealed record DigestPreference(bool Enabled);

    private static (Guid PhotoId, Guid AnimalId)? ReadTagKey(string key)
    {
        var parts = key.Split(':');
        return parts.Length == 3 && parts[0] == "schlawg-tag" &&
            Guid.TryParse(parts[1], out var photoId) && Guid.TryParse(parts[2], out var animalId)
            ? (photoId, animalId) : null;
    }

    internal static async Task NotifyModerators(AppDbContext db, Guid? authorId, Guid reporterId, Guid postId, string key, string message, CancellationToken ct)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO notifications ("Id", "UserId", "PostId", "EventKey", "Kind", "Message", "CreatedAt")
            SELECT gen_random_uuid(), "Id", {postId}, {key}, 'moderation-report', {message}, {DateTimeOffset.UtcNow}
            FROM users WHERE ("IsAdmin" OR "IsModerator") AND "Id" <> {reporterId} AND "Id" IS DISTINCT FROM {authorId}
            ON CONFLICT ("UserId", "EventKey") DO NOTHING
            """, ct);
    }
    // Stable event keys prevent duplicate notifications from retries or like/unlike toggles.
    public static async Task Notify(AppDbContext db, Guid? recipient, Guid? actor, Guid postId, string key, string kind, string message, CancellationToken ct)
    {
        if (recipient == null || recipient == actor) return;
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO notifications ("Id", "UserId", "PostId", "EventKey", "Kind", "Message", "CreatedAt")
            VALUES ({Guid.NewGuid()}, {recipient.Value}, {postId}, {key}, {kind}, {message}, {DateTimeOffset.UtcNow})
            ON CONFLICT ("UserId", "EventKey") DO NOTHING
            """, ct);
    }

    public static void MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/notifications").RequireAuthorization();
        group.AddEndpointFilter(async (context, next) => { context.HttpContext.Response.Headers.CacheControl = "no-store"; return await next(context); });
        group.MapGet("/", async (int? page, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var query = db.Notifications.AsNoTracking().Where(n => n.UserId == userId);
            var unreadCount = await query.CountAsync(n => n.ReadAt == null, ct);
            var items = await query.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id).Skip(Math.Clamp(page ?? 0, 0, 100000) * 30).Take(30)
                .Select(n => new { n.Id, n.PostId, n.Kind, n.Message, n.CreatedAt, n.ReadAt, n.EventKey,
                    removed = db.Posts.IgnoreQueryFilters().Any(p => p.Id == n.PostId && p.RemovedAt != null) }).ToListAsync(ct);
            var tagTargets = items.Where(n => n.Kind == "schlawg-tag").ToDictionary(n => n.Id, n => ReadTagKey(n.EventKey));
            var taggedPhotos = tagTargets.Values.Where(tag => tag.HasValue).Select(tag => tag!.Value.PhotoId).Distinct().ToArray();
            var activeTags = new HashSet<(Guid PhotoId, Guid AnimalId)>();
            if (taggedPhotos.Length > 0)
            {
                var tags = await db.PhotoAnimalProfiles.IgnoreQueryFilters().Where(tag => taggedPhotos.Contains(tag.PhotoId) &&
                    db.AnimalProfiles.Any(animal => animal.Id == tag.AnimalProfileId && animal.OwnerId == userId))
                    .Select(tag => new { tag.PhotoId, tag.AnimalProfileId }).ToListAsync(ct);
                activeTags = tags.Select(tag => (tag.PhotoId, tag.AnimalProfileId)).ToHashSet();
            }
            var posts = db.Posts.Where(p => p.OwnerId == userId).Select(p => p.Id);
            var reactionPeople = await db.Reactions.Where(r => posts.Contains(r.PostId) && r.UserId != userId).Select(r => r.UserId).Distinct().CountAsync(ct);
            var commentPeople = await db.Comments.Where(c => posts.Contains(c.PostId) && c.AuthorId != userId).Select(c => c.AuthorId).Distinct().CountAsync(ct);
            var digestEnabled = await db.Users.Where(u => u.Id == userId).Select(u => u.FollowedPosterDigestEnabled).SingleOrDefaultAsync(ct);
            var followedPostCount = 0;
            if (digestEnabled && (page ?? 0) == 0)
            {
                var cutoff = DateTimeOffset.UtcNow.AddHours(-24);
                var hidden = ReportVisibility.HiddenPosts(db, userId);
                followedPostCount = await db.Posts.CountAsync(p => p.CreatedAt >= cutoff
                    && db.PosterFollows.Any(f => f.FollowerId == userId && f.PosterId == p.OwnerId)
                    && !hidden.Contains(p.Id), ct);
            }
            return Results.Ok(new { unreadCount, reactionPeople, commentPeople, digestEnabled, followedPostCount, items = items.Select(n => {
                var tag = tagTargets.GetValueOrDefault(n.Id);
                return new {
                    n.Id, n.PostId, n.Kind, n.Message, n.CreatedAt, n.ReadAt, n.removed,
                    photoId = tag?.PhotoId,
                    canRemoveTag = tag is { } target && activeTags.Contains(target),
                    commentId = (n.Kind is "comment" or "reply") && n.EventKey.StartsWith(n.Kind + ":", StringComparison.Ordinal)
                        && Guid.TryParse(n.EventKey.AsSpan(n.Kind.Length + 1), out var commentId) ? (Guid?)commentId : null
                };
            }) });
        });
        group.MapDelete("/{id:guid}/schlawg-tag", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var notification = await db.Notifications.AsNoTracking()
                .SingleOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.Kind == "schlawg-tag", ct);
            if (notification is null || ReadTagKey(notification.EventKey) is not { } target)
                return Results.NotFound();
            await db.PhotoAnimalProfiles.IgnoreQueryFilters().Where(tag => tag.PhotoId == target.PhotoId && tag.AnimalProfileId == target.AnimalId &&
                db.Photos.IgnoreQueryFilters().Any(photo => photo.Id == tag.PhotoId && photo.PostId == notification.PostId) &&
                db.AnimalProfiles.Any(animal => animal.Id == tag.AnimalProfileId && animal.OwnerId == userId))
                .ExecuteDeleteAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("social");
        group.MapPut("/followed-poster-digest", async (DigestPreference input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var changed = await db.Users.Where(u => u.Id == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.FollowedPosterDigestEnabled, input.Enabled), ct);
            return changed == 0 ? Results.Unauthorized() : Results.NoContent();
        }).RequireRateLimiting("social");
        group.MapPut("/{id:guid}/read", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var count = await db.Notifications.Where(n => n.Id == id && n.UserId == userId).ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTimeOffset.UtcNow), ct);
            return count == 0 ? Results.NotFound() : Results.NoContent();
        });
    }
}
