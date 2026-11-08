using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.EntityFrameworkCore;

internal static class EmailApiChecks
{
    public static async Task Run(AppDbContext db, string origin)
    {
        using var client = new HttpClient { BaseAddress = new Uri(origin) };
        client.DefaultRequestHeaders.Add("X-Schlawgs-Request", "1");
        async Task Check(HttpResponseMessage result, HttpStatusCode expected, string label) {
            using (result) {
                if (result.StatusCode != expected) throw new Exception($"{label}: expected {expected}, got {result.StatusCode}: {await result.Content.ReadAsStringAsync()}");
                Console.WriteLine($"PASS {label}");
            }
        }
        var suffix = Guid.NewGuid().ToString("N");
        var id = Guid.NewGuid(); var otherId = Guid.NewGuid();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var email = $"verify-{suffix}@example.com";
        AppUser User(Guid userId, string name) => new() { Id = userId, Username = name, NormalizedUsername = name.ToUpperInvariant(), PasswordHash = "test-only", PendingEmail = email, EmailTokenHash = VerificationEmail.Hash(token), EmailTokenExpiresAt = DateTimeOffset.UtcNow.AddHours(1) };
        db.Users.AddRange(User(id, "email_" + suffix[..12]), User(otherId, "other_" + suffix[..12]));
        await db.SaveChangesAsync();
        try {
            await Check(await client.GetAsync("/api/account/email"), HttpStatusCode.Unauthorized, "email settings require login");
            await Check(await client.PostAsJsonAsync("/api/account/email", new { email }), HttpStatusCode.Unauthorized, "email sending requires login");
            await Check(await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = id, token = "invalid" }), HttpStatusCode.BadRequest, "malformed token rejected");
            await Check(await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = id, token = new string('0', 64) }), HttpStatusCode.BadRequest, "tampered token rejected");
            await db.Users.Where(x => x.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.EmailTokenExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)));
            await Check(await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = id, token }), HttpStatusCode.BadRequest, "expired token rejected");
            await db.Users.Where(x => x.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.EmailTokenExpiresAt, DateTimeOffset.UtcNow.AddHours(1)));
            using (var noHeader = new HttpClient { BaseAddress = new Uri(origin) })
                await Check(await noHeader.PostAsJsonAsync("/api/auth/verify-email", new { userId = id, token }), HttpStatusCode.Forbidden, "verification requires same-origin request header");
            await Check(await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = id, token }), HttpStatusCode.OK, "valid token verifies email");
            var stored = await db.Users.AsNoTracking().SingleAsync(x => x.Id == id);
            if (stored.Email != email || stored.PendingEmail != null || stored.EmailTokenHash != null || stored.EmailTokenExpiresAt != null) throw new Exception("Verification did not consume token");
            Console.WriteLine("PASS verification saves email and consumes token");
            await Check(await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = id, token }), HttpStatusCode.BadRequest, "used token rejected");
            await Check(await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = otherId, token }), HttpStatusCode.Conflict, "verified email cannot be claimed by another account");
            var replacement = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            await db.Users.Where(x => x.Id == otherId).ExecuteUpdateAsync(s => s.SetProperty(x => x.EmailTokenHash, VerificationEmail.Hash(replacement)));
            await Check(await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = otherId, token }), HttpStatusCode.BadRequest, "replaced token rejected");
        } finally {
            await db.Users.Where(x => x.Id == id || x.Id == otherId).ExecuteDeleteAsync();
        }
    }
}
