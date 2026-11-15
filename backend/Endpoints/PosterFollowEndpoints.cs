using System.Security.Claims;
using Backend.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Endpoints;

public static class PosterFollowEndpoints
{
    private static Guid Viewer(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static void MapPosterFollowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/account/following").RequireAuthorization();
        group.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });
        group.MapGet("/", async (AppDbContext db, HttpContext context, CancellationToken ct) =>
        {
            var viewer = Viewer(context);
            return Results.Ok(await db.PosterFollows.Where(f => f.FollowerId == viewer).Select(f => f.PosterId).ToListAsync(ct));
        });
        group.MapPut("/{posterId:guid}", async (Guid posterId, AppDbContext db, HttpContext context, CancellationToken ct) =>
        {
            var viewer = Viewer(context);
            if (posterId == viewer) return Results.BadRequest(new { message = "You can only follow other schlawg bill posters." });
            try
            {
                await db.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO poster_follows ("FollowerId", "PosterId") VALUES ({viewer}, {posterId})
                    ON CONFLICT ("FollowerId", "PosterId") DO NOTHING
                    """, ct);
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.ForeignKeyViolation)
            {
                return Results.NotFound(new { message = "This schlawg bill poster is no longer available." });
            }
            return Results.NoContent();
        }).RequireRateLimiting("social");
        group.MapDelete("/{posterId:guid}", async (Guid posterId, AppDbContext db, HttpContext context, CancellationToken ct) =>
        {
            var viewer = Viewer(context);
            await db.PosterFollows.Where(f => f.FollowerId == viewer && f.PosterId == posterId).ExecuteDeleteAsync(ct);
            return Results.NoContent();
        }).RequireRateLimiting("social");
    }
}
