using System.Security.Claims;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class BugReportEndpoints
{
    public sealed record SubmitInput(string? Title, string? Encounter, string? Steps);
    public sealed record StatusInput(string? Status, string? PreviousStatus);

    public static void MapBugReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/bug-reports", Submit).RequireAuthorization().RequireRateLimiting("bug-reports");

        var queue = endpoints.MapGroup("/api/admin/bug-reports").RequireAuthorization();
        queue.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            http.Response.Headers.CacheControl = "no-store";
            var db = http.RequestServices.GetRequiredService<AppDbContext>();
            if (!await db.Users.AnyAsync(u => u.Id == Viewer(http) && u.IsAdmin, http.RequestAborted))
                return Results.Json(new { message = "Only administrators can access bug reports." }, statusCode: 403);
            return await next(context);
        });
        queue.MapGet("/", List);
        queue.MapPatch("/{id:guid}", UpdateStatus);
    }

    private static async Task<IResult> Submit(SubmitInput input, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var title = input.Title?.Trim();
        var encounter = input.Encounter?.Trim();
        var steps = input.Steps?.Trim();
        if (string.IsNullOrEmpty(title) || title.Length > 120)
            return Results.BadRequest(new { message = "Enter a summary of 1–120 characters." });
        if (string.IsNullOrEmpty(encounter) || encounter.Length > 2000)
            return Results.BadRequest(new { message = "Describe how you encountered the bug in 1–2,000 characters." });
        if (string.IsNullOrEmpty(steps) || steps.Length > 4000)
            return Results.BadRequest(new { message = "Describe the steps you tried in 1–4,000 characters." });

        db.BugReports.Add(new BugReport
        {
            Id = Guid.NewGuid(),
            ReporterId = Viewer(http),
            Title = title,
            Encounter = encounter,
            Steps = steps,
            CreatedAt = DateTimeOffset.UtcNow,
            Status = BugReportStatus.Open,
        });
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> List(string? status, int? page, AppDbContext db, CancellationToken ct)
    {
        const int pageSize = 20;
        var pageIndex = page ?? 0;
        if (!TryStatus(status ?? nameof(BugReportStatus.Open), out var filter) ||
            pageIndex < 0 || pageIndex > int.MaxValue / pageSize)
            return Results.BadRequest(new { message = "Choose a valid status and page." });

        var reports = await db.BugReports.AsNoTracking()
            .Where(r => r.Status == filter)
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .Skip(pageIndex * pageSize).Take(pageSize + 1)
            .Select(r => new
            {
                r.Id, r.Title, r.Encounter, r.Steps, r.CreatedAt,
                reporter = r.Reporter == null ? null : r.Reporter.Username,
            }).ToListAsync(ct);
        return Results.Ok(new { reports = reports.Take(pageSize), hasNext = reports.Count > pageSize });
    }

    private static async Task<IResult> UpdateStatus(Guid id, StatusInput input, AppDbContext db, CancellationToken ct)
    {
        if (!TryStatus(input.Status, out var status) || !TryStatus(input.PreviousStatus, out var previousStatus))
            return Results.BadRequest(new { message = "Choose a valid status." });

        var changed = await db.BugReports.Where(r => r.Id == id && r.Status == previousStatus)
            .ExecuteUpdateAsync(update => update.SetProperty(r => r.Status, status), ct);
        if (changed == 0)
            return Results.Conflict(new { message = "This report changed. Refresh the queue and try again." });
        return Results.NoContent();
    }

    private static Guid Viewer(HttpContext http) => Guid.Parse(http.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static bool TryStatus(string? value, out BugReportStatus status) =>
        Enum.TryParse(value, out status) && value == Enum.GetName(status);
}
