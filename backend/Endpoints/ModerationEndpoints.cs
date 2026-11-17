using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class ModerationEndpoints
{
    public sealed record ReportInput(string? Reason, string? Details);
    public sealed record RemovalInput(string? Reason);
    private static readonly string[] Reasons = ["spam", "harassment", "hate", "violence", "animal-abuse", "sexual-content", "privacy", "other"];
    private static Guid UserId(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    internal static Task<AppUser?> LockPostingAccount(AppDbContext db, Guid id, CancellationToken ct) =>
        db.Users.FromSqlInterpolated($"SELECT * FROM users WHERE \"Id\" = {id} FOR NO KEY UPDATE").SingleOrDefaultAsync(ct);

    public static void MapModerationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/posts/{id:guid}/reports", async (Guid id, ReportInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (input.Reason == null || !Reasons.Contains(input.Reason) || input.Details?.Length > 1000)
                return Results.BadRequest(new { message = "Choose a report reason and use at most 1,000 characters for details." });
            var userId = UserId(context);
            if (!await db.Users.AnyAsync(u => u.Id == userId, ct)) return Results.Unauthorized();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var post = await db.Posts.FromSqlInterpolated($"SELECT * FROM posts WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (post == null) return Results.NotFound(new { message = "This post is no longer available." });
            if (post.OwnerId == userId) return Results.Json(new { message = "You cannot report your own post." }, statusCode: 403);
            if (await db.Reports.AnyAsync(r => r.PostId == id && r.ReporterId == userId, ct))
                return Results.Conflict(new { message = "You have already reported this post." });
            db.Reports.Add(new PostReport { PostId = id, ReporterId = userId, Reason = input.Reason, Details = input.Details?.Trim() ?? "", CreatedAt = DateTimeOffset.UtcNow });
            post.ModerationVersion++;
            var count = await db.Reports.CountAsync(r => r.PostId == id && r.DismissedAt == null, ct) + 1;
            var newlyHidden = !post.HiddenByReports && count >= ReportVisibility.Threshold;
            if (newlyHidden) post.HiddenByReports = true;
            await db.SaveChangesAsync(ct);
            await NotificationEndpoints.Notify(db, post.OwnerId, null, id, $"report:{id}:{userId}", "report", newlyHidden
                ? "Your post received three reports and is hidden from the community while moderators review it. You can request a review."
                : $"Your post was reported for {input.Reason}. You can see the report and request a review.", ct);
            await NotificationEndpoints.NotifyModerators(db, post.OwnerId, userId, id, $"moderation-post:{id}", "A post was reported. Review it in the moderation queue.", ct);
            await transaction.CommitAsync(ct);
            return Results.Ok(new { removed = false, hidden = true });
        }).RequireAuthorization().RequireRateLimiting("reports");

        var moderation = endpoints.MapGroup("/api/moderation").RequireAuthorization();
        moderation.AddEndpointFilter(async (context, next) => {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            var id = UserId(context.HttpContext);
            if (!await db.Users.AnyAsync(u => u.Id == id && (u.IsAdmin || u.IsModerator), context.HttpContext.RequestAborted)) return Results.Json(new { message = "Only moderators and admins can access this page." }, statusCode: 403);
            return await next(context);
        });
        moderation.MapPromptModeration();
        moderation.MapGet("/reports", async (int? page, AppDbContext db, CancellationToken ct) => {
            var offset = Math.Clamp(page ?? 0, 0, 100000) * 20;
            return Results.Ok(await db.Posts.IgnoreQueryFilters().AsSplitQuery()
                .Where(p => p.RemovedAt != null || p.HiddenByReports || db.Reports.Any(r => r.PostId == p.Id && r.DismissedAt == null) || db.Disputes.Any(d => d.PostId == p.Id && d.Status == "pending"))
                .OrderBy(p => p.RemovedAt != null).ThenByDescending(p => p.HiddenByReports).ThenByDescending(p => db.Reports.Count(r => r.PostId == p.Id && r.DismissedAt == null)).ThenBy(p => p.Id)
                .Skip(offset).Take(20).Select(p => new {
                    p.Id, p.OwnerId, p.RemovedAt, p.RemovalReason, p.HiddenByReports,
                    username = db.Users.Where(u => u.Id == p.OwnerId).Select(u => u.Username).FirstOrDefault(),
                    reportCount = db.Reports.Count(r => r.PostId == p.Id && r.DismissedAt == null),
                    reports = db.Reports.Where(r => r.PostId == p.Id && r.DismissedAt == null).OrderByDescending(r => r.CreatedAt).Select(r => new { r.ReporterId, r.Reason, r.Details, r.CreatedAt }).ToList(),
                    disputes = db.Disputes.Where(d => d.PostId == p.Id).OrderByDescending(d => d.CreatedAt).Select(d => new { d.Id, d.Explanation, d.Status, d.DecisionReason, d.CreatedAt }).ToList(),
                    photos = db.Photos.IgnoreQueryFilters().Where(photo => photo.PostId == p.Id).OrderBy(photo => photo.BatchPosition).Select(photo => new { photo.Id, photo.Description }).ToList()
                }).ToListAsync(ct));
        });
        moderation.MapGet("/photos/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) => {
            var photo = await db.Photos.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.Id == id && !p.IsProfilePhoto, ct);
            return photo == null ? Results.NotFound() : Results.File(photo.Data, photo.ContentType);
        });
        moderation.MapGet("/comment-reports", async (int? page, AppDbContext db, CancellationToken ct) => {
            var offset = Math.Clamp(page ?? 0, 0, 100000) * 20;
            return Results.Ok(await db.RemovedCommentReports.AsNoTracking()
                .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id).Skip(offset).Take(20).ToListAsync(ct));
        });
        moderation.MapGet("/reported-comments", async (int? page, AppDbContext db, CancellationToken ct) => {
            var offset = Math.Clamp(page ?? 0, 0, 100000) * 20;
            return Results.Ok(await db.Comments.AsNoTracking()
                .Where(c => c.HiddenByReports || db.CommentReports.Any(r => r.CommentId == c.Id && r.DismissedAt == null))
                .OrderByDescending(c => c.HiddenByReports).ThenBy(c => c.CreatedAt).ThenBy(c => c.Id).Skip(offset).Take(20)
                .Select(c => new { c.Id, c.PostId, c.AuthorId, authorUsername = c.Author.Username, c.Body, c.HiddenByReports,
                    reportCount = db.CommentReports.Count(r => r.CommentId == c.Id && r.DismissedAt == null) }).ToListAsync(ct));
        });
        CommentReportEndpoints.MapReviewEndpoints(moderation);
        moderation.MapPost("/posts/{id:guid}/restore", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var post = await db.Posts.FromSqlInterpolated($"SELECT * FROM posts WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (post == null) return Results.NotFound();
            if (post.OwnerId == UserId(context)) return Results.Forbid();
            await db.Reports.Where(r => r.PostId == id && r.DismissedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.DismissedAt, DateTimeOffset.UtcNow), ct);
            post.HiddenByReports = false;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("social");
        moderation.MapPost("/posts/{id:guid}/reports/{reporterId:guid}/dismiss", async (Guid id, Guid reporterId, AppDbContext db, HttpContext context, CancellationToken ct) => {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var post = await db.Posts.FromSqlInterpolated($"SELECT * FROM posts WHERE \"Id\" = {id} FOR UPDATE").IgnoreQueryFilters().SingleOrDefaultAsync(ct);
            if (post == null) return Results.NotFound(new { message = "Post not found." });
            if (post.OwnerId == UserId(context)) return Results.Json(new { message = "Another moderator must review reports on your own post." }, statusCode: 403);

            var report = await db.Reports.FindAsync([id, reporterId], ct);
            if (report == null) return Results.NotFound(new { message = "Report not found." });
            if (report.DismissedAt == null)
            {
                report.DismissedAt = DateTimeOffset.UtcNow;
                if (post.HiddenByReports && await db.Reports.CountAsync(r => r.PostId == id && r.ReporterId != reporterId && r.DismissedAt == null, ct) < ReportVisibility.Threshold)
                    post.HiddenByReports = false;
                await db.SaveChangesAsync(ct);
            }
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("social");
        moderation.MapPost("/posts/{id:guid}/remove", async (Guid id, RemovalInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 1000) return Results.BadRequest(new { message = "Include a removal reason (up to 1,000 characters)." });
            var userId = UserId(context);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var post = await db.Posts.FromSqlInterpolated($"SELECT * FROM posts WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (post == null) return Results.NotFound(new { message = "Post not found or already removed." });
            if (post.OwnerId == userId) return Results.Json(new { message = "You cannot remove your own published post." }, statusCode: 403);
            post.RemovedAt = DateTimeOffset.UtcNow; post.RemovedById = userId; post.RemovalReason = input.Reason.Trim(); post.ModerationVersion++;
            await db.SaveChangesAsync(ct);
            await NotificationEndpoints.Notify(db, post.OwnerId, null, id, $"removed:{id}:{post.ModerationVersion}", "removed", "A moderator removed your post. View the reason and submit a dispute from your reports page.", ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("social");
        DisputeEndpoints.MapDisputeEndpoints(endpoints, moderation);
        AccountBanEndpoints.MapAccountBanEndpoints(moderation);
    }

}
