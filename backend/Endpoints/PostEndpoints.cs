using System.Security.Claims;
using Backend.Data;
using Backend.Dtos;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class PostEndpoints
{
    public sealed record ReactionInput(string? Kind);
    public sealed record CommentInput(string? Body, Guid? PhotoId, Guid? ParentCommentId);
    public sealed record QuoteInput(Guid? CommentId);
    private static Guid? Viewer(HttpContext context) => Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static void MapPostEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/posts");
        group.AddEndpointFilter(async (context, next) => {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            // Reported posts and their activity are private to their author until reviewed.
            // Moderators use the separate moderation queue and photo endpoints.
            if (context.HttpContext.Request.RouteValues.TryGetValue("id", out var value)
                && Guid.TryParse(value?.ToString(), out var postId)) {
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var viewer = Viewer(context.HttpContext);
                if (!await db.Posts.AnyAsync(p => p.Id == postId && ((viewer != null && p.OwnerId == viewer)
                    || !db.Reports.Any(r => r.PostId == p.Id && r.DismissedAt == null)), context.HttpContext.RequestAborted))
                    return Results.NotFound(new { message = "This post is no longer publicly available." });
            }
            return await next(context);
        });
        group.MapGet("/random", async (string? category, Guid? excludePostId, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (category is not ("popular" or "niche" or "relevant"))
                return Results.BadRequest(new { message = "Choose Popular, Niche, or Relevant." });
            var viewerId = Viewer(context);
            var since = DateTimeOffset.UtcNow.AddDays(-7);
            var candidates = db.Posts.AsNoTracking().Where(p => p.OwnerId != null
                && !db.Reports.Any(r => r.PostId == p.Id && r.DismissedAt == null)
                && (viewerId == null || p.OwnerId != viewerId) && (excludePostId == null || p.Id != excludePostId)
                && db.Photos.Any(photo => photo.PostId == p.Id && !photo.IsProfilePhoto));
            candidates = category switch {
                "popular" => candidates.Where(p => db.Reactions.Count(r => r.PostId == p.Id) + db.Comments.Count(c => c.PostId == p.Id) >= 5),
                "niche" => candidates.Where(p => db.Reactions.Count(r => r.PostId == p.Id) + db.Comments.Count(c => c.PostId == p.Id) < 5),
                _ => candidates.Where(p => db.Comments.Any(c => c.PostId == p.Id && c.CreatedAt >= since))
            };
            var picked = await candidates.OrderBy(p => EF.Functions.Random()).Select(p => new { postId = p.Id }).FirstOrDefaultAsync(ct);
            return picked is null ? Results.NotFound(new { message = "No other posts match this choice yet. Try another category." }) : Results.Ok(picked);
        });
        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) => {
            if (!await db.Posts.AnyAsync(p => p.Id == id, ct)) return Results.NotFound(new { message = "This post could not be found." });
            var photos = await db.Photos.AsNoTracking().Where(p => p.PostId == id && !p.IsProfilePhoto)
                .OrderBy(p => p.BatchPosition).ThenBy(p => p.Id)
                .Select(p => new PhotoResponse(p.Id, p.FileName, p.ContentType, p.Size, p.UploadedAt, $"/api/photos/{p.Id}", p.Description, p.OwnerId,
                    p.Owner == null ? null : p.Owner.Username,
                    p.Owner == null || p.Owner.ProfilePhotoId == null ? null : $"/api/photos/{p.Owner.ProfilePhotoId}", p.BatchId, p.BatchPosition, p.PostId,
                    db.Reports.Any(r => r.PostId == p.PostId && r.DismissedAt == null)))
                .ToListAsync(ct);
            return Results.Ok(photos);
        });

        group.MapGet("/{id:guid}/activity", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct);
            if (post is null) return Results.NotFound();
            var viewerId = Viewer(context);
            var admin = viewerId != null && await db.Users.AnyAsync(u => u.Id == viewerId && (u.IsAdmin || u.IsModerator), ct);
            var reactions = await db.Reactions.AsNoTracking().Where(r => r.PostId == id).OrderBy(r => r.CreatedAt)
                .Select(r => new { r.UserId, r.User.Username, r.Kind }).ToListAsync(ct);
            var comments = await db.Comments.AsNoTracking().Where(c => c.PostId == id).OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
                .Select(c => new { c.Id, c.AuthorId, c.Author.Username, c.Body, c.CreatedAt, c.PhotoId, c.ParentCommentId, c.IsReply,
                    likeCount = db.CommentLikes.Count(l => l.CommentId == c.Id),
                    likedByMe = viewerId != null && db.CommentLikes.Any(l => l.CommentId == c.Id && l.UserId == viewerId),
                    likedByPostAuthor = post.OwnerId != null && db.CommentLikes.Any(l => l.CommentId == c.Id && l.UserId == post.OwnerId),
                    slideNumber = c.Photo == null ? (int?)null : c.Photo.BatchPosition + 1,
                    profilePhotoUrl = c.Author.ProfilePhotoId == null ? null : $"/api/photos/{c.Author.ProfilePhotoId}",
                    canDelete = viewerId != null && (c.AuthorId == viewerId || post.OwnerId == viewerId || admin) }).ToListAsync(ct);
            var bestQuotes = await db.Photos.AsNoTracking().Where(p => p.PostId == id && !p.IsProfilePhoto && p.BestQuoteCommentId != null)
                .Select(p => new { photoId = p.Id, commentId = p.BestQuoteCommentId }).ToListAsync(ct);
            var reportedByMe = viewerId != null && await db.Reports.AnyAsync(r => r.PostId == id && r.ReporterId == viewerId, ct);
            return Results.Ok(new { reactions, comments, bestQuotes, canChooseQuote = viewerId != null && post.OwnerId == viewerId, canModerate = admin, reportedByMe });
        });

        group.MapPut("/{id:guid}/reaction", async (Guid id, ReactionInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (input.Kind is not ("like" or "love" or "laugh")) return Results.BadRequest(new { message = "Choose Like, Love, or Laugh." });
            var userId = Viewer(context)!.Value;
            if (!await db.Users.AnyAsync(u => u.Id == userId, ct)) return Results.Unauthorized();
            if (!await db.Posts.AnyAsync(p => p.Id == id, ct)) return Results.NotFound();
            // The composite primary key and atomic upsert prevent duplicate reactions from concurrent requests.
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO post_reactions ("PostId", "UserId", "Kind", "CreatedAt")
                VALUES ({id}, {userId}, {input.Kind}, {DateTimeOffset.UtcNow})
                ON CONFLICT ("PostId", "UserId") DO UPDATE SET "Kind" = EXCLUDED."Kind"
                """, ct);
            var owner = await db.Posts.Where(p => p.Id == id).Select(p => p.OwnerId).SingleAsync(ct);
            await NotificationEndpoints.Notify(db, owner, userId, id, $"reaction:{id}:{userId}", "reaction", $"@{context.User.Identity!.Name} reacted to your post.", ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("social");

        group.MapDelete("/{id:guid}/reaction", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (!await db.Posts.AnyAsync(p => p.Id == id, ct)) return Results.NotFound();
            var userId = Viewer(context);
            await db.Reactions.Where(r => r.PostId == id && r.UserId == userId).ExecuteDeleteAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("social");

        group.MapPost("/{id:guid}/comments", async (Guid id, CommentInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (string.IsNullOrWhiteSpace(input.Body) || input.Body.Length > 2000) return Results.BadRequest(new { message = "Write a comment between 1 and 2,000 characters." });
            var userId = Viewer(context)!.Value;
            if (!await db.Users.AnyAsync(u => u.Id == userId, ct)) return Results.Unauthorized();
            if (!await db.Posts.AnyAsync(p => p.Id == id, ct)) return Results.NotFound();
            var photoId = input.PhotoId;
            if (input.ParentCommentId is Guid parentId) {
                var parent = await db.Comments.AsNoTracking().SingleOrDefaultAsync(c => c.Id == parentId && c.PostId == id, ct);
                if (parent == null) return Results.BadRequest(new { message = "The comment you are replying to is no longer available." });
                // Replies keep the original photo context even if the carousel has moved.
                photoId = parent.PhotoId;
            }
            if (input.ParentCommentId == null && (photoId == null || !await db.Photos.AnyAsync(p => p.Id == photoId && p.PostId == id && !p.IsProfilePhoto, ct)))
                return Results.BadRequest(new { message = "Choose a photo from this post for your comment." });
            var comment = new PostComment { Id = Guid.NewGuid(), PostId = id, PhotoId = photoId, ParentCommentId = input.ParentCommentId, IsReply = input.ParentCommentId != null, AuthorId = userId, Body = input.Body.Trim(), CreatedAt = DateTimeOffset.UtcNow };
            db.Comments.Add(comment);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23503" }) {
                return Results.Conflict(new { message = "That comment or photo was removed. Refresh and try again." });
            }
            var owner = await db.Posts.Where(p => p.Id == id).Select(p => p.OwnerId).SingleAsync(ct);
            await NotificationEndpoints.Notify(db, owner, userId, id, $"comment:{comment.Id}", "comment", $"@{context.User.Identity!.Name} commented on your post.", ct);
            if (comment.ParentCommentId is Guid repliedTo) {
                var parentAuthor = await db.Comments.Where(c => c.Id == repliedTo).Select(c => (Guid?)c.AuthorId).SingleOrDefaultAsync(ct);
                if (parentAuthor != owner) await NotificationEndpoints.Notify(db, parentAuthor, userId, id, $"reply:{comment.Id}", "reply", $"@{context.User.Identity!.Name} replied to your comment.", ct);
            }
            await transaction.CommitAsync(ct);
            return Results.Created($"/api/posts/{id}/activity", new { comment.Id });
        }).RequireAuthorization().RequireRateLimiting("social");

        group.MapPut("/{id:guid}/photos/{photoId:guid}/quote", async (Guid id, Guid photoId, QuoteInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var post = await db.Posts.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct);
            if (post is null) return Results.NotFound();
            if (post.OwnerId != Viewer(context)) return Results.Forbid();
            if (!await db.Photos.AnyAsync(p => p.Id == photoId && p.PostId == id && !p.IsProfilePhoto, ct)) return Results.NotFound();
            if (input.CommentId != null && !await db.Comments.AnyAsync(c => c.Id == input.CommentId && c.PostId == id, ct))
                return Results.BadRequest(new { message = "Choose a comment from this post." });
            // One nullable reference per photo makes replacement atomic and optional.
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            try {
                await db.Photos.Where(p => p.Id == photoId).ExecuteUpdateAsync(s => s.SetProperty(p => p.BestQuoteCommentId, input.CommentId), ct);
            } catch (Npgsql.PostgresException ex) when (ex.SqlState == "23503") {
                return Results.Conflict(new { message = "That comment was removed. Choose another quote." });
            }
            if (input.CommentId is Guid selectedId) {
                var author = await db.Comments.Where(c => c.Id == selectedId).Select(c => (Guid?)c.AuthorId).SingleOrDefaultAsync(ct);
                var slide = await db.Photos.Where(p => p.Id == photoId).Select(p => p.BatchPosition + 1).SingleAsync(ct);
                await NotificationEndpoints.Notify(db, author, Viewer(context), id, $"quote:{photoId}:{selectedId}", "best-quote", $"@{context.User.Identity!.Name} picked your comment as best quote for photo {slide}.", ct);
            }
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("social");

        group.MapDelete("/{id:guid}/comments/{commentId:guid}", async (Guid id, Guid commentId, AppDbContext db, HttpContext context, CancellationToken ct) => {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var comment = await db.Comments.FromSqlInterpolated($"SELECT * FROM post_comments WHERE \"Id\" = {commentId} AND \"PostId\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (comment is null) return Results.NotFound();
            var userId = Viewer(context);
            var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null) return Results.Unauthorized();
            var ownsPost = await db.Posts.AnyAsync(p => p.Id == id && p.OwnerId == userId, ct);
            if (comment.AuthorId != userId && !ownsPost && !user.IsAdmin && !user.IsModerator) return Results.Forbid();
            db.Comments.Remove(comment);
            await db.SaveChangesAsync(ct);
            var removedBy = user.IsAdmin ? "an administrator" : user.IsModerator ? "a moderator" : "the post author";
            await NotificationEndpoints.Notify(db, comment.AuthorId, userId, id, $"comment-removed:{commentId}", "comment-removed", $"Your comment was removed by {removedBy}.", ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("social");

        group.MapPut("/{id:guid}/comments/{commentId:guid}/like", async (Guid id, Guid commentId, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var viewerId = Viewer(context)!.Value;
            if (!await db.Users.AnyAsync(u => u.Id == viewerId, ct)) return Results.Unauthorized();
            if (!await db.Posts.AnyAsync(p => p.Id == id, ct) || !await db.Comments.AnyAsync(c => c.Id == commentId && c.PostId == id, ct)) return Results.NotFound();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            try {
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO comment_likes (\"CommentId\", \"UserId\") VALUES ({commentId}, {viewerId}) ON CONFLICT DO NOTHING", ct);
            } catch (Npgsql.PostgresException ex) when (ex.SqlState == "23503") { return Results.NotFound(); }
            var author = await db.Comments.Where(c => c.Id == commentId).Select(c => (Guid?)c.AuthorId).SingleOrDefaultAsync(ct);
            await NotificationEndpoints.Notify(db, author, viewerId, id, $"comment-like:{commentId}:{viewerId}", "comment-like", $"@{context.User.Identity!.Name} liked your comment.", ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("social");
        group.MapDelete("/{id:guid}/comments/{commentId:guid}/like", async (Guid id, Guid commentId, AppDbContext db, HttpContext context, CancellationToken ct) => {
            if (!await db.Posts.AnyAsync(p => p.Id == id, ct) || !await db.Comments.AnyAsync(c => c.Id == commentId && c.PostId == id, ct)) return Results.NotFound();
            var viewerId = Viewer(context);
            await db.CommentLikes.Where(l => l.CommentId == commentId && l.UserId == viewerId).ExecuteDeleteAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("social");
    }
}
