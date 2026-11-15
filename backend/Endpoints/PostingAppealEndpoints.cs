using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class PostingAppealEndpoints
{
    private static Guid Viewer(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static void MapPostingAppealEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/account/posting-appeal").RequireAuthorization();
        group.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });
        group.MapGet("/", async (HttpContext context, AppDbContext db, CancellationToken ct) =>
        {
            var id = Viewer(context);
            var result = await db.Users.Where(u => u.Id == id).Select(u => new {
                restrictedSince = u.PostingRestrictionStartedAt ?? u.PostingRestrictedAt,
                appeal = db.PostingAppeals.Where(a => a.UserId == id && (u.PostingRestrictedAt == null
                    || a.RestrictionStartedAt == (u.PostingRestrictionStartedAt ?? u.PostingRestrictedAt)))
                    .OrderByDescending(a => a.CreatedAt)
                    .Select(a => new { a.Explanation, a.Accepted, a.DecisionReason }).FirstOrDefault()
            }).SingleOrDefaultAsync(ct);
            return result == null ? Results.Unauthorized() : Results.Ok(result);
        });
        group.MapPost("/", async (DisputeEndpoints.DisputeInput input, HttpContext context, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.Explanation) || input.Explanation.Length > 2000)
                return Results.BadRequest(new { message = "Explain your appeal in 1–2,000 characters." });
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var user = await ModerationEndpoints.LockPostingAccount(db, Viewer(context), ct);
            if (user?.PostingRestrictedAt is not DateTimeOffset restrictedAt)
                return Results.Conflict(new { message = "There is no active posting restriction to appeal." });
            var startedAt = user.PostingRestrictionStartedAt ?? restrictedAt;
            if (await db.PostingAppeals.AnyAsync(a => a.UserId == user.Id && a.RestrictionStartedAt == startedAt, ct))
                return Results.Conflict(new { message = "You already appealed this posting restriction." });
            db.PostingAppeals.Add(new PostingAppeal {
                Id = Guid.NewGuid(), UserId = user.Id, RestrictionStartedAt = startedAt,
                CreatedAt = DateTimeOffset.UtcNow, Explanation = input.Explanation.Trim()
            });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("reports");
    }

    internal static async Task<IResult> Review(Guid userId, DateTimeOffset restrictedAt, Guid? appealId, bool accept, string reason, AppDbContext db, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = await ModerationEndpoints.LockPostingAccount(db, userId, ct);
        if (user == null || user.PostingRestrictedAt != restrictedAt)
            return Results.Conflict(new { message = "This restriction changed. Refresh the queue and review it again." });
        var startedAt = user.PostingRestrictionStartedAt ?? restrictedAt;
        var appeal = await db.PostingAppeals.SingleOrDefaultAsync(a => a.UserId == userId && a.RestrictionStartedAt == startedAt, ct);
        if (appealId != null && (appeal?.Id != appealId || appeal.Accepted != null))
            return Results.Conflict(new { message = "This appeal is no longer awaiting review." });
        if (appeal != null && appeal.Accepted == null)
        {
            appeal.Accepted = accept;
            appeal.DecisionReason = reason;
        }
        if (accept)
        {
            user.PostingRestrictedAt = null;
            user.PostingRestrictionStartedAt = null;
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }
}
