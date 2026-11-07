using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

static class VoteChecks
{
    public static async Task Run(AppDbContext db, string url)
    {
        var suffix = Guid.NewGuid().ToString("N")[..10];
        var password = Guid.NewGuid().ToString("N");
        AppUser User(string prefix) {
            var user = new AppUser { Id = Guid.NewGuid(), Username = prefix + suffix, NormalizedUsername = (prefix + suffix).ToUpperInvariant(), PasswordHash = "" };
            user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, password);
            return user;
        }
        var first = User("vote_a_"); var second = User("vote_b_");
        AnimalProfile Animal(string name) => new() { Id = Guid.NewGuid(), OwnerId = first.Id, Name = name, AnimalType = "Dog", Breed = "", Age = 1, AgeUnit = "years", FunFact = "", CreatedAt = DateTimeOffset.UtcNow };
        var a = Animal("Vote test A"); var b = Animal("Vote test B");
        HttpClient Client(bool header = true) {
            var client = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = new Uri(url) };
            if (header) client.DefaultRequestHeaders.Add("X-Schlawgs-Request", "1");
            return client;
        }
        async Task Expect(HttpResponseMessage response, HttpStatusCode status) {
            using (response) if (response.StatusCode != status) throw new Exception($"Vote: expected {status}, got {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }
        async Task Selected(HttpClient client, Guid? expected) {
            var me = await client.GetFromJsonAsync<JsonElement>("/api/auth/me");
            var value = me.GetProperty("votingForAnimalId");
            if ((value.ValueKind == JsonValueKind.Null ? (Guid?)null : value.GetGuid()) != expected) throw new Exception("Vote selection was not persisted correctly.");
        }
        using var one = Client(); using var two = Client(); using var anonymous = Client(); using var noHeader = Client(false);
        try {
            db.Users.AddRange(first, second); await db.SaveChangesAsync();
            db.AnimalProfiles.AddRange(a, b); await db.SaveChangesAsync();
            await Expect(await anonymous.PutAsJsonAsync("/api/account/vote", new { animalId = a.Id }), HttpStatusCode.Unauthorized);
            await Expect(await noHeader.PutAsJsonAsync("/api/account/vote", new { animalId = a.Id }), HttpStatusCode.Forbidden);
            await Expect(await one.PostAsJsonAsync("/api/auth/login", new { username = first.Username, password }), HttpStatusCode.OK);
            await Expect(await two.PostAsJsonAsync("/api/auth/login", new { username = second.Username, password }), HttpStatusCode.OK);
            await Selected(one, null); await Selected(two, null);
            await Expect(await anonymous.PostAsync("/api/votes/refresh", null), HttpStatusCode.Unauthorized);
            await Expect(await noHeader.PostAsync("/api/votes/refresh", null), HttpStatusCode.Forbidden);
            await Expect(await one.PostAsync("/api/votes/refresh", null), HttpStatusCode.Forbidden);
            await Expect(await one.PutAsJsonAsync("/api/account/vote", new { animalId = a.Id }), HttpStatusCode.OK);
            await Expect(await two.PutAsJsonAsync("/api/account/vote", new { animalId = b.Id }), HttpStatusCode.OK);
            await Selected(one, a.Id); await Selected(two, b.Id);
            if (await db.Users.AsNoTracking().Where(x => x.Id == first.Id).Select(x => x.VotingForAnimalId).SingleAsync() != a.Id) throw new Exception("Vote missing from database.");
            await Expect(await one.PutAsJsonAsync("/api/account/vote", new { animalId = b.Id }), HttpStatusCode.OK);
            await Expect(await one.PutAsJsonAsync("/api/account/vote", new { animalId = b.Id }), HttpStatusCode.OK);
            await Selected(one, b.Id);
            await Expect(await one.PutAsJsonAsync("/api/account/vote", new { animalId = Guid.NewGuid() }), HttpStatusCode.NotFound);
            await Selected(one, b.Id);
            await Expect(await one.PutAsJsonAsync("/api/account/vote", new { animalId = (Guid?)null }), HttpStatusCode.OK);
            await Selected(one, null); await Selected(two, b.Id);
            await Expect(await two.PostAsync("/api/auth/logout", null), HttpStatusCode.NoContent);
            await Expect(await two.PostAsJsonAsync("/api/auth/login", new { username = second.Username, password }), HttpStatusCode.OK);
            await Selected(two, b.Id);
            await db.AnimalProfiles.Where(x => x.Id == b.Id).ExecuteDeleteAsync();
            await Selected(two, null);
            Console.WriteLine("PASS voting: authentication, CSRF protection, persistence, account isolation, replacement, idempotency, invalid IDs, clearing, re-login, and deleted-profile cleanup");
        } finally {
            await db.AnimalProfiles.Where(x => x.OwnerId == first.Id).ExecuteDeleteAsync();
            await db.Users.Where(x => x.Id == first.Id || x.Id == second.Id).ExecuteDeleteAsync();
        }
    }
}
