using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

internal static class PasswordResetChecks
{
    public static async Task Run(AppDbContext db, string origin)
    {
        using var client = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = new Uri(origin) };
        using var oldSession = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = new Uri(origin) };
        client.DefaultRequestHeaders.Add("X-Schlawgs-Request", "1");
        oldSession.DefaultRequestHeaders.Add("X-Schlawgs-Request", "1");
        async Task Check(HttpResponseMessage result, HttpStatusCode expected, string label) {
            using (result) {
                if (result.StatusCode != expected) throw new Exception($"{label}: expected {expected}, got {result.StatusCode}: {await result.Content.ReadAsStringAsync()}");
                Console.WriteLine($"PASS {label}");
            }
        }
        var suffix = Guid.NewGuid().ToString("N")[..12];
        var id = Guid.NewGuid(); var oldPassword = "Original_" + suffix; var newPassword = "Changed_" + suffix;
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var user = new AppUser { Id = id, Username = "reset_" + suffix, NormalizedUsername = "RESET_" + suffix.ToUpperInvariant(), PasswordHash = "", Email = $"reset-{suffix}@example.com", PasswordResetHash = VerificationEmail.Hash(token), PasswordResetExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30), PendingEmail = "pending@example.com", EmailTokenHash = VerificationEmail.Hash("pending"), EmailTokenExpiresAt = DateTimeOffset.UtcNow.AddHours(1) };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, oldPassword);
        db.Users.Add(user); await db.SaveChangesAsync();
        object Reset(string value, string password, string? confirmation = null) => new { userId = id, token = value, password, confirmPassword = confirmation ?? password };
        try {
            await Check(await oldSession.PostAsJsonAsync("/api/auth/login", new { username = user.Username, password = oldPassword }), HttpStatusCode.OK, "existing password signs in");
            await Check(await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = "invalid" }), HttpStatusCode.BadRequest, "invalid recovery email rejected");
            await Check(await client.PostAsJsonAsync("/api/auth/reset-password", Reset(token, "short")), HttpStatusCode.BadRequest, "weak replacement password rejected");
            await Check(await client.PostAsJsonAsync("/api/auth/reset-password", Reset(token, newPassword, "different")), HttpStatusCode.BadRequest, "password confirmation required");
            await Check(await client.PostAsJsonAsync("/api/auth/reset-password", Reset(new string('0', 64), newPassword)), HttpStatusCode.BadRequest, "tampered reset token rejected");
            // Email verification tokens are never accepted as password reset tokens.
            await Check(await client.PostAsJsonAsync("/api/auth/reset-password", Reset("pending", newPassword)), HttpStatusCode.BadRequest, "verification token cannot reset password");
            await db.Users.Where(x => x.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.PasswordResetExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)));
            await Check(await client.PostAsJsonAsync("/api/auth/reset-password", Reset(token, newPassword)), HttpStatusCode.BadRequest, "expired reset token rejected");
            await db.Users.Where(x => x.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.PasswordResetExpiresAt, DateTimeOffset.UtcNow.AddMinutes(30)));
            using (var noHeader = new HttpClient { BaseAddress = new Uri(origin) })
                await Check(await noHeader.PostAsJsonAsync("/api/auth/reset-password", Reset(token, newPassword)), HttpStatusCode.Forbidden, "reset requires same-origin request header");
            var responses = await Task.WhenAll(client.PostAsJsonAsync("/api/auth/reset-password", Reset(token, newPassword)), client.PostAsJsonAsync("/api/auth/reset-password", Reset(token, newPassword)));
            try {
                if (responses.Count(x => x.StatusCode == HttpStatusCode.OK) != 1 || responses.Count(x => x.StatusCode == HttpStatusCode.BadRequest) != 1) throw new Exception("Concurrent reset consumed a token twice");
                Console.WriteLine("PASS concurrent resets consume token once");
            } finally { foreach (var response in responses) response.Dispose(); }
            var stored = await db.Users.AsNoTracking().SingleAsync(x => x.Id == id);
            if (stored.SessionVersion != 1 || stored.PasswordResetHash != null || stored.PasswordResetExpiresAt != null || stored.PendingEmail != null || stored.EmailTokenHash != null || stored.EmailTokenExpiresAt != null || stored.PasswordHash == newPassword || new PasswordHasher<AppUser>().VerifyHashedPassword(stored, stored.PasswordHash, newPassword) == PasswordVerificationResult.Failed)
                throw new Exception("Reset failed to update password or revoke outstanding tokens");
            Console.WriteLine("PASS new password hashed and recovery/email-change tokens revoked");
            await Check(await oldSession.GetAsync("/api/auth/me"), HttpStatusCode.Unauthorized, "previous login session revoked");
            await Check(await client.GetAsync("/api/auth/me"), HttpStatusCode.Unauthorized, "reset does not automatically log in");
            await Check(await client.PostAsJsonAsync("/api/auth/reset-password", Reset(token, newPassword)), HttpStatusCode.BadRequest, "used reset link rejected");
            await Check(await client.PostAsJsonAsync("/api/auth/login", new { username = user.Username, password = oldPassword }), HttpStatusCode.Unauthorized, "previous password rejected");
            await Check(await client.PostAsJsonAsync("/api/auth/login", new { username = user.Username, password = newPassword }), HttpStatusCode.OK, "new password signs in");
            await Check(await client.GetAsync("/api/auth/me"), HttpStatusCode.OK, "new session remains valid");
        } finally { await db.Users.Where(x => x.Id == id).ExecuteDeleteAsync(); }
    }
}
