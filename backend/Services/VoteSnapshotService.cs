using System.Text.Json;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public sealed record AnimalVoteTotal(Guid AnimalId, int Votes);

public sealed class VoteSnapshotService(AppDbContext db, TimeProvider clock)
{
    public async Task<bool> RefreshIfDueAsync(CancellationToken ct, bool force = false)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Transaction-scoped lock coordinates all app instances without blocking readers.
        var locked = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock(741928301) AS \"Value\"").SingleAsync(ct);
        if (!locked) return false;
        var now = clock.GetUtcNow();
        var updated = await db.VoteSnapshots.AsNoTracking().Where(x => x.Id == 1).Select(x => (DateTimeOffset?)x.UpdatedAt).SingleOrDefaultAsync(ct);
        if (!force && updated is not null && now - updated.Value < TimeSpan.FromHours(1)) return false;
        var counts = await db.Users.AsNoTracking().Where(x => x.VotingForAnimalId != null)
            .GroupBy(x => x.VotingForAnimalId!.Value)
            .Select(group => new { AnimalId = group.Key, Votes = group.Count() })
            .OrderByDescending(x => x.Votes).ThenBy(x => x.AnimalId).ToListAsync(ct);
        var json = JsonSerializer.Serialize(counts.Select(x => new AnimalVoteTotal(x.AnimalId, x.Votes)));
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO vote_snapshots ("Id", "UpdatedAt", "TotalsJson") VALUES (1, {now}, CAST({json} AS jsonb))
            ON CONFLICT ("Id") DO UPDATE SET "UpdatedAt" = EXCLUDED."UpdatedAt", "TotalsJson" = EXCLUDED."TotalsJson"
            """, ct);
        await transaction.CommitAsync(ct);
        return true;
    }
}

public sealed class VoteSnapshotWorker(IServiceScopeFactory scopes, ILogger<VoteSnapshotWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do {
            try {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<VoteSnapshotService>().RefreshIfDueAsync(stoppingToken);
            } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Vote snapshot refresh failed; retaining the last totals and retrying in one minute."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
