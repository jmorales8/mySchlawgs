using Backend.Data;
using Backend.Dtos;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Backend.Endpoints;

public static class PhotoEndpoints
{
    private const long MaxFileSize = 10 * 1024 * 1024;

    private static readonly Dictionary<string, byte[][]> AllowedSignatures = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = [[0xFF, 0xD8, 0xFF]],
        ["image/png"] = [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
        ["image/gif"] = [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
        ["image/webp"] = [[0x52, 0x49, 0x46, 0x46]]
    };

    public static IEndpointRouteBuilder MapPhotoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/photos").WithTags("Photos");
        group.AddEndpointFilter(async (context, next) => {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });

        group.MapPost("/", UploadPhotoAsync).RequireAuthorization().RequireRateLimiting("uploads")
            .DisableAntiforgery()
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<PhotoResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        group.MapGet("/", ListPhotosAsync);
        endpoints.MapPost("/api/profile/photo", UploadProfileAsync).RequireAuthorization().RequireRateLimiting("uploads").DisableAntiforgery();
        endpoints.MapPost("/api/account/animals/{id:guid}/photo", (Guid id, HttpContext context, AppDbContext db, CancellationToken ct) => SavePhotos(context, db, true, ct, id))
            .RequireAuthorization().RequireRateLimiting("uploads").DisableAntiforgery();
        group.MapPatch("/{id:guid}", async (Guid id, DescriptionInput input, HttpContext context, AppDbContext db) =>
        {
            if (input.Description is null || input.Description.Length > 2000) return Results.BadRequest(new { message = "Descriptions must be at most 2,000 characters." });
            var ownerId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var photo = await db.Photos.SingleOrDefaultAsync(x => x.Id == id && x.OwnerId == ownerId);
            if (photo is null) return Results.NotFound();
            photo.Description = input.Description.Trim();
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization();
        group.MapGet("/{id:guid}", DownloadPhotoAsync)
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return endpoints;
    }

    public sealed record DescriptionInput(string? Description);

    private static Task<IResult> UploadPhotoAsync(HttpContext context, AppDbContext db, CancellationToken cancellationToken)
        => SavePhotos(context, db, false, cancellationToken);

    private static Task<IResult> UploadProfileAsync(HttpContext context, AppDbContext db, CancellationToken cancellationToken)
        => SavePhotos(context, db, true, cancellationToken);

    private static async Task<IResult> SavePhotos(HttpContext context, AppDbContext db, bool profile, CancellationToken cancellationToken, Guid? animalId = null)
    {
        if (!context.Request.HasFormContentType) return Results.BadRequest(new { message = "Choose images to upload." });
        var form = await context.Request.ReadFormAsync(cancellationToken);
        var files = form.Files;
        if (files.Count < 1 || files.Count > (profile ? 1 : 10) || files.Sum(x => x.Length) > 50 * 1024 * 1024)
            return Results.BadRequest(new { message = profile ? "Choose one profile picture." : "Choose 1–10 images, up to 50 MB total." });
        var descriptions = form["descriptions"];
        if (!profile && descriptions.Count != files.Count) return Results.BadRequest(new { message = "Include a description field for each image (it may be empty)." });
        var ownerId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.FindAsync([ownerId], cancellationToken);
        if (user is null) return Results.Unauthorized();
        AnimalProfile? animal = null;
        if (animalId != null)
        {
            animal = await db.AnimalProfiles.SingleOrDefaultAsync(x => x.Id == animalId && x.OwnerId == ownerId, cancellationToken);
            if (animal == null) return Results.NotFound();
        }
        var photos = new List<Photo>();
        var batchId = Guid.NewGuid();
        var uploadedAt = DateTimeOffset.UtcNow;
        for (var index = 0; index < files.Count; index++)
        {
        var file = files[index];
        var description = profile ? "" : descriptions[index] ?? "";
        if (description.Length > 2000) return Results.BadRequest(new { message = "Descriptions must be at most 2,000 characters." });
        var validationError = Validate(file);
        if (validationError is not null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [validationError] });
        }

        await using var memory = new MemoryStream(capacity: checked((int)file.Length));
        await file.CopyToAsync(memory, cancellationToken);
        var data = memory.ToArray();

        if (!HasExpectedSignature(file.ContentType, data))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["file"] = ["The file contents do not match the declared image type."]
            });
        }

        var photo = new Photo
        {
            Id = Guid.NewGuid(),
            PostId = profile ? null : batchId,
            BatchId = profile ? null : batchId,
            BatchPosition = index,
            OwnerId = ownerId,
            Description = description.Trim(),
            IsProfilePhoto = profile,
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType.ToLowerInvariant(),
            Size = file.Length,
            Data = data,
            UploadedAt = uploadedAt
        };

        photos.Add(photo);
        }
        if (!profile) db.Posts.Add(new Post { Id = batchId, OwnerId = ownerId, CreatedAt = uploadedAt });
        db.Photos.AddRange(photos);
        if (animal != null) animal.ProfilePhotoId = photos[0].Id;
        else if (profile) user.ProfilePhotoId = photos[0].Id;
        await db.SaveChangesAsync(cancellationToken);
        if (animal != null) return Results.Ok(animal);
        return profile ? Results.Ok(AccountEndpoints.UserResponse(user)) : Results.Created("/api/photos", photos.Select(PhotoResponse.FromPhoto));
    }

    private static async Task<IResult> ListPhotosAsync(string? feed, HttpContext context, AppDbContext db, CancellationToken cancellationToken)
    {
        if (feed is not (null or "latest" or "interacted" or "mine")) return Results.BadRequest(new { message = "Choose a valid feed." });
        var query = db.Photos.AsNoTracking().Where(x => !x.IsProfilePhoto);
        if (feed is "interacted" or "mine") {
            if (!Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Results.Unauthorized();
            query = feed == "mine" ? query.Where(x => x.OwnerId == userId) : query.Where(x =>
                db.Reactions.Any(r => r.PostId == x.PostId && r.UserId == userId)
                || db.Comments.Any(c => c.PostId == x.PostId && c.AuthorId == userId)
                || db.Comments.Any(c => c.PostId == x.PostId && db.CommentLikes.Any(l => l.CommentId == c.Id && l.UserId == userId)));
        }
        var photos = await query
            .OrderByDescending(x => x.UploadedAt)
            .ThenBy(x => x.PostId).ThenBy(x => x.BatchPosition).ThenBy(x => x.Id)
            .Select(x => new PhotoResponse(
                x.Id, x.FileName, x.ContentType, x.Size, x.UploadedAt, $"/api/photos/{x.Id}", x.Description, x.OwnerId,
                x.Owner == null ? null : x.Owner.Username,
                x.Owner == null || x.Owner.ProfilePhotoId == null ? null : $"/api/photos/{x.Owner.ProfilePhotoId}", x.BatchId, x.BatchPosition, x.PostId))
            .ToListAsync(cancellationToken);

        return Results.Ok(photos);
    }

    private static async Task<IResult> DownloadPhotoAsync(
        Guid id,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var photo = await db.Photos.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return photo is null
            ? Results.NotFound()
            : Results.File(photo.Data, photo.ContentType);
    }

    private static string? Validate(IFormFile file)
    {
        if (file.Length == 0) return "Choose a non-empty file.";
        if (Path.GetFileName(file.FileName).Length > 255) return "The file name is too long.";
        if (file.Length > MaxFileSize) return "The maximum file size is 10 MB.";
        if (!AllowedSignatures.ContainsKey(file.ContentType))
            return "Only JPEG, PNG, GIF, and WebP images are allowed.";
        return null;
    }

    private static bool HasExpectedSignature(string contentType, byte[] data)
    {
        if (contentType.Equals("image/webp", StringComparison.OrdinalIgnoreCase))
        {
            return data.Length >= 12
                && data.AsSpan(0, 4).SequenceEqual("RIFF"u8)
                && data.AsSpan(8, 4).SequenceEqual("WEBP"u8);
        }

        return AllowedSignatures[contentType].Any(signature =>
            data.Length >= signature.Length && data.AsSpan(0, signature.Length).SequenceEqual(signature));
    }
}
