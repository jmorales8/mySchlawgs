using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class AnimalProfileEndpoints
{
    public sealed record ProfileInput(string? Name, string? AnimalType, string? Breed, int? Age, string? AgeUnit, string? FunFact);

    public static void MapAnimalProfileEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/account/animals").RequireAuthorization().RequireRateLimiting("social");
        group.AddEndpointFilter(async (context, next) => { context.HttpContext.Response.Headers.CacheControl = "no-store"; return await next(context); });
        group.MapGet("/suggestions", async (string? kind, string? animalType, string? q, AppDbContext db, CancellationToken ct) => {
            if (kind is not ("type" or "breed")) return Results.BadRequest(new { message = "Choose type or breed suggestions." });
            var type = Normalize(animalType ?? "").ToUpperInvariant();
            var search = Normalize(q ?? "").ToUpperInvariant();
            var query = db.AnimalCatalog.AsNoTracking().Where(x => x.Kind == kind && x.AnimalType == (kind == "type" ? "" : type));
            return Results.Ok(await query.Where(x => x.NormalizedName.Contains(search)).OrderBy(x => x.Name).Select(x => x.Name).Take(50).ToListAsync(ct));
        });
        group.MapGet("/", async (AppDbContext db, HttpContext context, CancellationToken ct) =>
            Results.Ok(await db.AnimalProfiles.AsNoTracking().Where(x => x.OwnerId == Owner(context)).OrderBy(x => x.CreatedAt).ToListAsync(ct)));
        group.MapPost("/", async (ProfileInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var animal = new AnimalProfile { Id = Guid.NewGuid(), OwnerId = Owner(context), Name = "", AnimalType = "", Breed = "", AgeUnit = "", FunFact = "", CreatedAt = DateTimeOffset.UtcNow };
            var error = Apply(input, animal);
            if (error != null) return Results.BadRequest(new { message = error });
            db.AnimalProfiles.Add(animal);
            await SaveWithCatalog(db, animal, ct);
            return Results.Created($"/api/account/animals/{animal.Id}", animal);
        });
        group.MapPut("/{id:guid}", async (Guid id, ProfileInput input, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var animal = await db.AnimalProfiles.SingleOrDefaultAsync(x => x.Id == id && x.OwnerId == Owner(context), ct);
            if (animal == null) return Results.NotFound();
            var error = Apply(input, animal);
            if (error != null) return Results.BadRequest(new { message = error });
            await SaveWithCatalog(db, animal, ct);
            return Results.Ok(animal);
        });
        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) => {
            var count = await db.AnimalProfiles.Where(x => x.Id == id && x.OwnerId == Owner(context)).ExecuteDeleteAsync(ct);
            return count == 0 ? Results.NotFound() : Results.NoContent();
        });
    }

    private static Guid Owner(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static string Normalize(string value) => string.Join(" ", value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static async Task SaveWithCatalog(AppDbContext db, AnimalProfile animal, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        foreach (var entry in new[] { (Kind: "type", Type: "", Name: animal.AnimalType), (Kind: "breed", Type: animal.AnimalType.ToUpperInvariant(), Name: animal.Breed) })
        {
            if (entry.Name.Length == 0) continue;
            var normalized = entry.Name.ToUpperInvariant();
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO animal_catalog ("Kind", "AnimalType", "NormalizedName", "Name")
                VALUES ({entry.Kind}, {entry.Type}, {normalized}, {entry.Name})
                ON CONFLICT ("Kind", "AnimalType", "NormalizedName") DO NOTHING
                """, ct);
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private static string? Apply(ProfileInput input, AnimalProfile animal)
    {
        var name = input.Name?.Trim() ?? "";
        var type = Normalize(input.AnimalType ?? "");
        var breed = Normalize(input.Breed ?? "");
        var fact = input.FunFact?.Trim() ?? "";
        if (name.Length is < 1 or > 60) return "Enter a name up to 60 characters.";
        if (type.Length is < 1 or > 60) return "Enter an animal type up to 60 characters.";
        if (breed.Length > 100) return "Keep the breed or mix to 100 characters.";
        if (input.Age is null or < 0 or > 200 || input.AgeUnit is not ("years" or "months")) return "Enter an age from 0 to 200 and choose years or months.";
        if (fact.Length > 1000) return "Keep the fun fact to 1,000 characters.";
        animal.Name = name; animal.AnimalType = type; animal.Breed = breed;
        animal.Age = input.Age.Value; animal.AgeUnit = input.AgeUnit; animal.FunFact = fact;
        return null;
    }
}
