using System.Security.Claims;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class NotificationEndpoints
{
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
                .Select(n => new { n.Id, n.PostId, n.Kind, n.Message, n.CreatedAt, n.ReadAt,
                    removed = db.Posts.IgnoreQueryFilters().Any(p => p.Id == n.PostId && p.RemovedAt != null) }).ToListAsync(ct);
            var posts = db.Posts.Where(p => p.OwnerId == userId).Select(p => p.Id);
            var reactionPeople = await db.Reactions.Where(r => posts.Contains(r.PostId) && r.UserId != userId).Select(r => r.UserId).Distinct().CountAsync(ct);
            var commentPeople = await db.Comments.Where(c => posts.Contains(c.PostId) && c.AuthorId != userId).Select(c => c.AuthorId).Distinct().CountAsync(ct);
            return Results.Ok(new { unreadCount, reactionPeople, commentPeople, items });
        });
        group.MapPut("/{id:guid}/read", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var count = await db.Notifications.Where(n => n.Id == id && n.UserId == userId).ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTimeOffset.UtcNow), ct);
            return count == 0 ? Results.NotFound() : Results.NoContent();
        });
    }
}
