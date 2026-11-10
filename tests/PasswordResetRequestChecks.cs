using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Data;
using Backend.Endpoints;
using Backend.Models;
using Backend.Security;
using Backend.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

internal static class PasswordResetRequestChecks
{
    public static async Task Run(AppDbContext db)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://localhost:5020");
        builder.Logging.ClearProviders();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Resend:ApiKey"] = "test-only", ["EmailVerification:AppUrl"] = "http://localhost:3000" });
        builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(db.Database.GetConnectionString()));
        builder.Services.AddSingleton(new CaptchaSettings { Enabled = false });
        builder.Services.AddHttpClient<CaptchaVerifier>();
        var fake = new FakeMail();
        builder.Services.AddHttpClient<VerificationEmail>().ConfigurePrimaryHttpMessageHandler(() => fake);
        builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
        builder.Services.AddSingleton<PasswordResetDelivery>();
        builder.Services.AddHostedService(p => p.GetRequiredService<PasswordResetDelivery>());
        builder.Services.AddRateLimiter(o => { o.AddFixedWindowLimiter("recovery", x => { x.PermitLimit = 10; x.Window = TimeSpan.FromMinutes(1); }); o.AddFixedWindowLimiter("auth", x => { x.PermitLimit = 10; x.Window = TimeSpan.FromMinutes(1); }); });
        await using var app = builder.Build();
        app.UseRateLimiter(); app.MapPasswordResetEndpoints();
        var suffix = Guid.NewGuid().ToString("N")[..12];
        var verified = new AppUser { Id = Guid.NewGuid(), Username = "v_" + suffix, NormalizedUsername = "V_" + suffix, PasswordHash = "fixture", Email = $"v-{suffix}@example.com" };
        var pending = new AppUser { Id = Guid.NewGuid(), Username = "p_" + suffix, NormalizedUsername = "P_" + suffix, PasswordHash = "fixture", PendingEmail = $"p-{suffix}@example.com" };
        db.Users.AddRange(verified, pending); await db.SaveChangesAsync();
        try {
            await app.StartAsync();
            using var client = new HttpClient { BaseAddress = new Uri("http://localhost:5020") };
            async Task<string> Request(string email) {
                using var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
                if (response.StatusCode != HttpStatusCode.OK) throw new Exception("Recovery request failed: " + await response.Content.ReadAsStringAsync());
                return await response.Content.ReadAsStringAsync();
            }
            var unknownResponse = await Request($"missing-{suffix}@example.com");
            var pendingResponse = await Request(pending.PendingEmail!);
            var verifiedResponse = await Request(verified.Email!);
            var sentBody = await fake.Sent.Task.WaitAsync(TimeSpan.FromSeconds(10));
            var repeatedResponse = await Request(verified.Email!);
            if (unknownResponse != pendingResponse || unknownResponse != verifiedResponse || unknownResponse != repeatedResponse) throw new Exception("Recovery disclosed account status");
            Console.WriteLine("PASS recovery response identical for unknown, unverified, verified and cooldown addresses");
            var stored = await db.Users.AsNoTracking().SingleAsync(x => x.Id == verified.Id);
            using var body = JsonDocument.Parse(sentBody);
            var text = body.RootElement.GetProperty("text").GetString()!;
            var token = text.Split("&token=")[1].Split('\n')[0];
            if (stored.PasswordResetHash != VerificationEmail.Hash(token) || stored.PasswordResetExpiresAt <= DateTimeOffset.UtcNow || stored.PasswordResetExpiresAt > DateTimeOffset.UtcNow.AddMinutes(31) || stored.PasswordHash != "fixture") throw new Exception("Recovery token issuance failed");
            if (fake.Count != 1 || body.RootElement.GetProperty("to")[0].GetString() != verified.Email || await db.Users.Where(x => x.Id == pending.Id).AnyAsync(x => x.PasswordResetHash != null)) throw new Exception("Recovery sent to unverified email or bypassed cooldown");
            Console.WriteLine("PASS only verified email receives reset; cooldown prevents resend; password unchanged");
            Console.WriteLine("PASS issued reset secret is hashed, expiring, and matches delivered link");
        } finally {
            await app.StopAsync();
            await db.Users.Where(x => x.Id == verified.Id || x.Id == pending.Id).ExecuteDeleteAsync();
        }
    }

    private sealed class FakeMail : HttpMessageHandler
    {
        public readonly TaskCompletionSource<string> Sent = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int Count;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
            Interlocked.Increment(ref Count); Sent.TrySetResult(await request.Content!.ReadAsStringAsync(ct));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
        }
    }
}
