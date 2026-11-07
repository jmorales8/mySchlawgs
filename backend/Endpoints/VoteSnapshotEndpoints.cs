using System.Text.Json;
using System.Security.Claims;
using Backend.Data;
using Backend.Services;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class VoteSnapshotEndpoints
{
    public static void MapVoteSnapshotEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/votes/refresh", async (AppDbContext db, VoteSnapshotService snapshots, HttpContext context, CancellationToken ct) => {
            var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (!await db.Users.AnyAsync(x => x.Id == userId && x.IsAdmin, ct))
                return Results.Json(new { message = "Only admins can refresh vote totals." }, statusCode: 403);
            if (!await snapshots.RefreshIfDueAsync(ct, force: true))
                return Results.Conflict(new { message = "Vote totals are already being refreshed. Please try again shortly." });
            return Results.NoContent();
        }).RequireAuthorization().RequireRateLimiting("social");
        endpoints.MapGet("/api/votes/summary", async (AppDbContext db, HttpContext context, CancellationToken ct) => {
            context.Response.Headers.CacheControl = "no-store";
            var snapshot = await db.VoteSnapshots.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct);
            var totals = snapshot is null ? [] : JsonSerializer.Deserialize<List<AnimalVoteTotal>>(snapshot.TotalsJson) ?? [];
            var ids = totals.Select(x => x.AnimalId).ToArray();
            var animals = await db.AnimalProfiles.AsNoTracking().Where(x => ids.Contains(x.Id))
                .Select(x => new { x.Id, x.Name, x.AnimalType, x.Breed, x.ProfilePhotoId }).ToDictionaryAsync(x => x.Id, ct);
            var leaders = totals.Where(x => animals.ContainsKey(x.AnimalId)).OrderByDescending(x => x.Votes)
                .ThenBy(x => animals[x.AnimalId].Name).ThenBy(x => x.AnimalId).Take(5)
                .Select(x => new { id = x.AnimalId, animals[x.AnimalId].Name, animals[x.AnimalId].AnimalType, animals[x.AnimalId].Breed,
                    profilePhotoUrl = animals[x.AnimalId].ProfilePhotoId is Guid photoId ? $"/api/photos/{photoId}" : null, x.Votes }).ToArray();
            return Results.Ok(new { updatedAt = snapshot?.UpdatedAt, leaders });
        });
    }
}
