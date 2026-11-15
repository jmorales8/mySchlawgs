using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class AccountBanEndpoints
{
    public sealed record BanInput(string? Username);

    public static void MapAccountBanEndpoints(RouteGroupBuilder moderation)
    {
        var accounts = moderation.MapGroup("/accounts");
        accounts.AddEndpointFilter(async (context, next) =>
        {
            var id = Guid.Parse(context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            if (!await db.Users.AnyAsync(u => u.Id == id && u.IsAdmin, context.HttpContext.RequestAborted))
                return Results.Json(new { message = "Only administrators can manage account restrictions." }, statusCode: 403);
            return await next(context);
        });

        accounts.MapGet("/restricted", async (int? page, AppDbContext db, CancellationToken ct) =>
        {
            var offset = Math.Clamp(page ?? 0, 0, 100000) * 20;
            return Results.Ok(await db.Users.AsNoTracking().Where(u => u.PostingRestrictedAt != null)
                .OrderBy(u => u.PostingRestrictionStartedAt ?? u.PostingRestrictedAt).ThenBy(u => u.Id).Skip(offset).Take(20)
                .Select(u => new {
                    u.Id, u.Username, u.PostingRestrictedAt,
                    restrictedSince = u.PostingRestrictionStartedAt ?? u.PostingRestrictedAt,
                    appeal = db.PostingAppeals.Where(a => a.UserId == u.Id && a.RestrictionStartedAt == (u.PostingRestrictionStartedAt ?? u.PostingRestrictedAt))
                        .Select(a => new { a.Id, a.Explanation, a.Accepted, a.DecisionReason }).FirstOrDefault()
                }).ToListAsync(ct));
        });

        accounts.MapDelete("/{id:guid}/posting-restriction", async (Guid id, DateTimeOffset restrictedAt, HttpContext context, AppDbContext db, CancellationToken ct) =>
        {
            var adminId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (id == adminId) return Results.Json(new { message = "Another admin must review your restriction." }, statusCode: 403);
            return await PostingAppealEndpoints.Review(id, restrictedAt, null, true, "An admin lifted your posting restriction.", db, ct);
        }).RequireRateLimiting("social");

        accounts.MapPost("/{id:guid}/posting-appeal/{appealId:guid}", async (Guid id, Guid appealId, DateTimeOffset restrictedAt, DisputeEndpoints.DecisionInput input, HttpContext context, AppDbContext db, CancellationToken ct) =>
        {
            var adminId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (id == adminId) return Results.Json(new { message = "Another admin must review your appeal." }, statusCode: 403);
            if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 1000)
                return Results.BadRequest(new { message = "Include a decision reason (up to 1,000 characters)." });
            return await PostingAppealEndpoints.Review(id, restrictedAt, appealId, input.Accept, input.Reason.Trim(), db, ct);
        }).RequireRateLimiting("social");

        accounts.MapGet("/lookup", async (string username, AppDbContext db, CancellationToken ct) =>
        {
            var normalized = username.Trim().ToUpperInvariant();
            var account = await db.Users.AsNoTracking().Where(u => u.NormalizedUsername == normalized)
                .Select(u => new {
                    u.Id, u.Username, u.IsAdmin,
                    schlawgs = db.AnimalProfiles.Count(a => a.OwnerId == u.Id),
                    posts = db.Posts.IgnoreQueryFilters().Count(p => p.OwnerId == u.Id),
                    photos = db.Photos.IgnoreQueryFilters().Count(p => p.OwnerId == u.Id),
                    comments = db.Comments.Count(c => c.AuthorId == u.Id),
                    reactions = db.Reactions.Count(r => r.UserId == u.Id) + db.CommentLikes.Count(l => l.UserId == u.Id)
                }).SingleOrDefaultAsync(ct);
            return account is null ? Results.NotFound(new { message = "No account found for that username." }) : Results.Ok(account);
        }).RequireRateLimiting("social");

        accounts.MapPost("/{id:guid}/ban", async (Guid id, BanInput input, AppDbContext db, CancellationToken ct) =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var account = await db.Users.FromSqlInterpolated($"SELECT * FROM users WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (account is null) return Results.NotFound(new { message = "This account no longer exists." });
            if (account.IsAdmin) return Results.Json(new { message = "Administrator accounts cannot be banned here." }, statusCode: 403);
            if (!string.Equals(account.Username, input.Username, StringComparison.Ordinal))
                return Results.BadRequest(new { message = "Type the exact username to confirm." });

            var ownedPosts = db.Posts.IgnoreQueryFilters().Where(p => p.OwnerId == id);
            var username = account.Username;
            await db.RemovedCommentReports.Where(r => r.AuthorUsername == username || r.ReporterUsername == username
                || ownedPosts.Any(p => p.Id == r.PostId)).ExecuteDeleteAsync(ct);
            var actorPrefix = $"@{username} ";
            await db.Notifications.Where(n => n.Message.StartsWith(actorPrefix)).ExecuteDeleteAsync(ct);

            // Both ownership foreign keys restrict account deletion, including hidden and legacy photos.
            await ownedPosts.ExecuteDeleteAsync(ct);
            await db.Photos.IgnoreQueryFilters().Where(p => p.OwnerId == id).ExecuteDeleteAsync(ct);
            db.UsernameBans.Add(new UsernameBan { NormalizedUsername = account.NormalizedUsername, CreatedAt = DateTimeOffset.UtcNow });
            db.Users.Remove(account);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("social");
    }
}
