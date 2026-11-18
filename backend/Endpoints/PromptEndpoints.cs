using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class PromptEndpoints
{
    internal const string IdeaOfTheWeekTags = "#Idea of the week #IOTW";
    internal const string IdeaOfTheWeekPattern = @"(^|[^[:alnum:]_#])#(idea of the week|iotw)([^[:alnum:]_]|$)";
    private const int PageSize = 20;
    private static readonly TimeZoneInfo CommunityTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Chicago");

    public sealed record IdeaInput(string? Text);

    public static void MapPromptEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/weekly-prompt", async (AppDbContext db, HttpContext context, TimeProvider clock, CancellationToken ct) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var weekOf = CurrentWeek(clock);
            var prompt = await db.WeeklyPrompts.Where(p => p.WeekOf == weekOf)
                .Select(p => new { p.WeekOf, p.IdeaId, p.Idea.Text }).SingleOrDefaultAsync(ct);
            return Results.Ok(new { prompt });
        });

        endpoints.MapPost("/api/prompt-ideas", SubmitIdea)
            .RequireAuthorization().RequireRateLimiting("social");
    }

    public static void MapPromptModeration(this RouteGroupBuilder moderation)
    {
        moderation.MapGet("/prompt-ideas", async (int? page, AppDbContext db, CancellationToken ct) =>
        {
            var offset = Math.Clamp(page ?? 0, 0, 100000) * PageSize;
            var ideas = await db.PromptIdeas.OrderByDescending(i => i.CreatedAt).ThenBy(i => i.Id)
                .Skip(offset).Take(PageSize + 1)
                .Select(i => new
                {
                    i.Id,
                    i.Text,
                    Username = db.Users.Where(u => u.Id == i.SubmittedById).Select(u => u.Username).FirstOrDefault()
                }).ToListAsync(ct);
            return Results.Ok(new { ideas = ideas.Take(PageSize), hasMore = ideas.Count > PageSize });
        });

        moderation.MapPut("/weekly-prompt/{id:guid}", async (Guid id, AppDbContext db, HttpContext context, TimeProvider clock, CancellationToken ct) =>
        {
            var userId = UserId(context);
            if (!await db.Users.AnyAsync(u => u.Id == userId && u.IsAdmin, ct))
                return Results.Json(new { message = "Only admins can choose the weekly prompt." }, statusCode: 403);
            var weekOf = CurrentWeek(clock);
            var changed = await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO weekly_prompts ("WeekOf", "IdeaId")
                SELECT {weekOf}, "Id" FROM prompt_ideas WHERE "Id" = {id}
                ON CONFLICT ("WeekOf") DO UPDATE SET "IdeaId" = EXCLUDED."IdeaId"
                """, ct);
            return changed == 0
                ? Results.NotFound(new { message = "This prompt idea is no longer available." })
                : Results.NoContent();
        }).RequireRateLimiting("social");
    }

    private static async Task<IResult> SubmitIdea(IdeaInput input, AppDbContext db, HttpContext context, TimeProvider clock, CancellationToken ct)
    {
        var text = input.Text?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > 240)
            return Results.BadRequest(new { message = "Enter a prompt idea of up to 240 characters." });

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = await ModerationEndpoints.LockPostingAccount(db, UserId(context), ct);
        if (user == null) return Results.Unauthorized();
        if (user.PostingRestrictedAt != null)
            return Results.Json(new { message = "Your account is currently restricted from submitting prompt ideas." }, statusCode: 403);

        db.PromptIdeas.Add(new PromptIdea
        {
            Id = Guid.NewGuid(),
            SubmittedById = user.Id,
            Text = text,
            CreatedAt = clock.GetUtcNow()
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }

    private static Guid UserId(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static DateOnly CurrentWeek(TimeProvider clock)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), CommunityTimeZone).DateTime);
        var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
        return today.AddDays(-daysSinceMonday);
    }
}
