using System.Text.Json;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

static class VoteSnapshotChecks
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    public static async Task Run(AppDbContext original)
    {
        // A disposable schema keeps test votes and snapshots out of the real feed.
        var schema = "vote_snapshot_test_" + Guid.NewGuid().ToString("N");
        // SQL identifiers cannot be parameters; this identifier contains only a fixed prefix and a generated hexadecimal GUID.
#pragma warning disable EF1002
        await original.Database.ExecuteSqlRawAsync($"CREATE SCHEMA \"{schema}\"");
#pragma warning restore EF1002
        var connection = new NpgsqlConnectionStringBuilder(original.Database.GetConnectionString()) { SearchPath = schema, Pooling = false };
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection.ConnectionString).Options;
        try {
            await using var db = new AppDbContext(options);
            await db.Database.MigrateAsync();
            var clock = new Clock();
            var service = new VoteSnapshotService(db, clock);
            async Task<List<AnimalVoteTotal>> Totals() => JsonSerializer.Deserialize<List<AnimalVoteTotal>>((await db.VoteSnapshots.AsNoTracking().SingleAsync()).TotalsJson)!;
            if (!await service.RefreshIfDueAsync(default) || (await Totals()).Count != 0) throw new Exception("Initial empty snapshot failed.");
            var users = Enumerable.Range(0, 3).Select(i => new AppUser { Id = Guid.NewGuid(), Username = $"voter{i}", NormalizedUsername = $"VOTER{i}", PasswordHash = "unused" }).ToArray();
            db.Users.AddRange(users); await db.SaveChangesAsync();
            AnimalProfile Animal(string name) => new() { Id = Guid.NewGuid(), OwnerId = users[0].Id, Name = name, AnimalType = "Dog", Breed = "", AgeUnit = "years", FunFact = "", CreatedAt = clock.Now };
            var a = Animal("A"); var b = Animal("B");
            db.AnimalProfiles.AddRange(a, b); await db.SaveChangesAsync();
            users[0].VotingForAnimalId = a.Id; users[1].VotingForAnimalId = a.Id; users[2].VotingForAnimalId = b.Id;
            await db.SaveChangesAsync();
            if (await service.RefreshIfDueAsync(default) || (await Totals()).Count != 0) throw new Exception("Totals changed before the hour elapsed.");
            clock.Now += TimeSpan.FromHours(1);
            if (!await service.RefreshIfDueAsync(default)) throw new Exception("Hourly refresh did not run.");
            var totals = await Totals();
            if (totals.Count != 2 || totals[0] != new AnimalVoteTotal(a.Id, 2) || totals[1] != new AnimalVoteTotal(b.Id, 1)) throw new Exception("Vote aggregation incorrect.");
            await using (var restarted = new AppDbContext(options)) {
                if (await new VoteSnapshotService(restarted, clock).RefreshIfDueAsync(default)) throw new Exception("Restart recalculated a fresh snapshot.");
                if (await restarted.VoteSnapshots.CountAsync() != 1) throw new Exception("Snapshot not persisted.");
            }
            users[0].VotingForAnimalId = b.Id; users[1].VotingForAnimalId = null; await db.SaveChangesAsync();
            clock.Now += TimeSpan.FromMinutes(59);
            if (await service.RefreshIfDueAsync(default) || !(await Totals()).SequenceEqual(totals)) throw new Exception("Stale totals were not retained.");
            if (!await service.RefreshIfDueAsync(default, force: true)) throw new Exception("Admin refresh did not override the hourly interval.");
            if (!(await Totals()).SequenceEqual([new AnimalVoteTotal(b.Id, 2)])) throw new Exception("Changed/removed votes were counted incorrectly.");
            clock.Now += TimeSpan.FromMinutes(1);
            if (await service.RefreshIfDueAsync(default)) throw new Exception("Manual refresh did not reset the hourly interval.");
            var saved = await db.VoteSnapshots.AsNoTracking().SingleAsync();
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE vote_snapshots ADD CONSTRAINT test_refresh_failure CHECK (false) NOT VALID");
            clock.Now += TimeSpan.FromHours(1);
            try { await service.RefreshIfDueAsync(default); throw new Exception("Expected simulated refresh failure."); }
            catch (PostgresException ex) when (ex.SqlState == "23514") { }
            var retained = await db.VoteSnapshots.AsNoTracking().SingleAsync();
            if (retained.TotalsJson != saved.TotalsJson || retained.UpdatedAt != saved.UpdatedAt) throw new Exception("Failed refresh damaged saved totals.");
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE vote_snapshots DROP CONSTRAINT test_refresh_failure");
            await db.AnimalProfiles.Where(x => x.Id == b.Id).ExecuteDeleteAsync();
            await service.RefreshIfDueAsync(default);
            if ((await Totals()).Count != 0) throw new Exception("Deleted animal votes were not cleared.");
            Console.WriteLine("PASS hourly snapshots: isolated migrations, empty state, grouping, hourly boundary, retained totals, replacements, removals, restart persistence, atomic failure recovery, and deleted profiles");
        } finally {
#pragma warning disable EF1002 // Same generated, non-user-supplied identifier as above.
            await original.Database.ExecuteSqlRawAsync($"DROP SCHEMA \"{schema}\" CASCADE");
#pragma warning restore EF1002
        }
    }
}
