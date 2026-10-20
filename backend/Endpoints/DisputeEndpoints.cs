using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class DisputeEndpoints
{
    public sealed record DisputeInput(string? Explanation);
    public sealed record DecisionInput(bool Accept, string? Reason);
    private static Guid Viewer(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static void MapDisputeEndpoints(IEndpointRouteBuilder endpoints, RouteGroupBuilder moderation)
    {
        var own = endpoints.MapGroup("/api/account/reports").RequireAuthorization();
        own.AddEndpointFilter(async (context, next) => { context.HttpContext.Response.Headers.CacheControl = "no-store"; return await next(context); });
        own.MapGet("/", async (int? page, Guid? postId, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var userId = Viewer(context);
            return Results.Ok(await db.Posts.IgnoreQueryFilters().AsSplitQuery().Where(p => p.OwnerId == userId && (postId == null || p.Id == postId) && (p.RemovedAt != null || db.Reports.Any(r => r.PostId == p.Id) || db.Disputes.Any(d => d.PostId == p.Id)))
                .OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id).Skip(Math.Clamp(page ?? 0, 0, 100000) * 20).Take(20)
                .Select(p => new {
                    p.Id, p.RemovedAt, p.RemovalReason,
                    reportCount = db.Reports.Count(r => r.PostId == p.Id && r.DismissedAt == null),
                    reasons = db.Reports.Where(r => r.PostId == p.Id && r.DismissedAt == null).Select(r => r.Reason).Distinct().ToList(),
                    photos = db.Photos.IgnoreQueryFilters().Where(photo => photo.PostId == p.Id).OrderBy(photo => photo.BatchPosition).Select(photo => new { photo.Id, photo.Description }).ToList(),
                    canDispute = (p.RemovedAt != null || db.Reports.Any(r => r.PostId == p.Id && r.DismissedAt == null)) && !db.Disputes.Any(d => d.PostId == p.Id && (d.Status == "pending" || d.Version == p.ModerationVersion)),
                    disputes = db.Disputes.Where(d => d.PostId == p.Id).OrderByDescending(d => d.CreatedAt).Select(d => new { d.Id, d.Status, d.Explanation, d.DecisionReason, d.CreatedAt }).ToList()
                }).ToListAsync(ct));
        });
        own.MapGet("/photos/{id:guid}", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var userId = Viewer(context);
            var photo = await db.Photos.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.Id == id && p.OwnerId == userId && !p.IsProfilePhoto, ct);
            return photo == null ? Results.NotFound() : Results.File(photo.Data, photo.ContentType);
        });
        own.MapPost("/{id:guid}/dispute", async (Guid id, DisputeInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (string.IsNullOrWhiteSpace(input.Explanation) || input.Explanation.Length > 2000) return Results.BadRequest(new { message = "Explain your dispute in 1–2,000 characters." });
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var post = await db.Posts.FromSqlInterpolated($"SELECT * FROM posts WHERE \"Id\" = {id} FOR UPDATE").IgnoreQueryFilters().SingleOrDefaultAsync(ct);
            if (post == null || post.OwnerId != Viewer(context)) return Results.NotFound();
            if (post.RemovedAt == null && !await db.Reports.AnyAsync(r => r.PostId == id && r.DismissedAt == null, ct)) return Results.BadRequest(new { message = "This post has no active reports or takedown to dispute." });
            if (await db.Disputes.AnyAsync(d => d.PostId == id && (d.Status == "pending" || d.Version == post.ModerationVersion), ct)) return Results.Conflict(new { message = "A dispute already exists for these reports. You can submit another if new reports or a new takedown occur after review." });
            var dispute = new PostDispute { Id = Guid.NewGuid(), PostId = id, Version = post.ModerationVersion, Explanation = input.Explanation.Trim(), CreatedAt = DateTimeOffset.UtcNow };
            db.Disputes.Add(dispute); await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            return Results.Ok(new { dispute.Id });
        }).RequireRateLimiting("reports");

        moderation.MapPost("/disputes/{id:guid}/decision", async (Guid id, DecisionInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 1000) return Results.BadRequest(new { message = "Include a decision reason (up to 1,000 characters)." });
            var postId = await db.Disputes.Where(d => d.Id == id).Select(d => (Guid?)d.PostId).SingleOrDefaultAsync(ct);
            if (postId == null) return Results.NotFound();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var post = await db.Posts.FromSqlInterpolated($"SELECT * FROM posts WHERE \"Id\" = {postId.Value} FOR UPDATE").IgnoreQueryFilters().SingleAsync(ct);
            if (post.OwnerId == Viewer(context)) return Results.Json(new { message = "Another moderator must review your own dispute." }, statusCode: 403);
            var dispute = await db.Disputes.SingleAsync(d => d.Id == id, ct);
            if (dispute.Status != "pending") return Results.Conflict(new { message = "This dispute has already been reviewed." });
            dispute.Status = input.Accept ? "accepted" : "rejected";
            dispute.ReviewedById = Viewer(context); dispute.ReviewedAt = DateTimeOffset.UtcNow; dispute.DecisionReason = input.Reason.Trim();
            // The decision covers current reports while holding the same lock used by reporting/removal.
            dispute.Version = post.ModerationVersion;
            if (input.Accept) {
                await db.Reports.Where(r => r.PostId == post.Id && r.DismissedAt == null).ExecuteUpdateAsync(s => s.SetProperty(r => r.DismissedAt, DateTimeOffset.UtcNow), ct);
                post.RemovedAt = null; post.RemovedById = null; post.RemovalReason = null;
            }
            await db.SaveChangesAsync(ct);
            await NotificationEndpoints.Notify(db, post.OwnerId, null, post.Id, $"dispute:{id}", "dispute", input.Accept ? "Your dispute was accepted. The reports were dismissed and your post is available again." : "Your dispute was rejected. View the moderator’s explanation in your reports page.", ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("social");
    }
}
