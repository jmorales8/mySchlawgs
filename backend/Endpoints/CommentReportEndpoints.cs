using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

internal static class CommentReportEndpoints
{
    private static Guid Viewer(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static void MapSubmission(RouteGroupBuilder posts)
    {
        posts.MapPost("/{id:guid}/comments/{commentId:guid}/reports", async (Guid id, Guid commentId, AppDbContext db, HttpContext context, CancellationToken ct) =>
        {
            var viewer = Viewer(context);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var comment = await LockComment(db, commentId, ct);
            if (comment == null || comment.PostId != id) return Results.NotFound();
            if (comment.AuthorId == viewer) return Results.Json(new { message = "You cannot report your own comment." }, statusCode: 403);
            if (await db.CommentReports.AnyAsync(r => r.CommentId == commentId && r.ReporterId == viewer, ct))
                return Results.Conflict(new { message = "You have already reported this comment." });
            if (comment.HiddenByReports) return Results.NotFound(new { message = "This comment is awaiting review." });
            db.CommentReports.Add(new CommentReport { CommentId = commentId, ReporterId = viewer, CreatedAt = DateTimeOffset.UtcNow });
            if (await db.CommentReports.CountAsync(r => r.CommentId == commentId && r.DismissedAt == null, ct) + 1 >= ReportVisibility.Threshold)
                comment.HiddenByReports = true;
            await db.SaveChangesAsync(ct);
            await NotificationEndpoints.NotifyModerators(db, comment.AuthorId, viewer, id, $"moderation-comment:{commentId}", "A comment was reported. Review it in the moderation queue.", ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("reports");
    }

    public static void MapReviewEndpoints(RouteGroupBuilder moderation)
    {
        moderation.MapPost("/comments/{id:guid}/restore", (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) =>
            Review(id, false, db, context, ct)).RequireRateLimiting("social");
        moderation.MapPost("/comments/{id:guid}/remove", (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) =>
            Review(id, true, db, context, ct)).RequireRateLimiting("social");
    }

    private static Task<PostComment?> LockComment(AppDbContext db, Guid id, CancellationToken ct) =>
        db.Comments.FromSqlInterpolated($"SELECT * FROM post_comments WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);

    private static async Task<IResult> Review(Guid id, bool remove, AppDbContext db, HttpContext context, CancellationToken ct)
    {
        var viewer = Viewer(context);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var comment = await LockComment(db, id, ct);
        if (comment == null) return Results.NotFound();
        if (comment.AuthorId == viewer) return Results.Forbid();
        var reports = db.CommentReports.Where(r => r.CommentId == id && r.DismissedAt == null);
        if (!comment.HiddenByReports && !await reports.AnyAsync(ct))
            return Results.Conflict(new { message = "This comment is no longer awaiting review." });
        if (remove)
        {
            db.Comments.Remove(comment);
            await NotificationEndpoints.Notify(db, comment.AuthorId, viewer, comment.PostId, $"comment-removed:{id}", "comment-removed", "A moderator removed your reported comment.", ct);
        }
        else
        {
            await reports.ExecuteUpdateAsync(s => s.SetProperty(r => r.DismissedAt, DateTimeOffset.UtcNow), ct);
            comment.HiddenByReports = false;
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }
}
