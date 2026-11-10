using System.Security.Claims;
using System.Security.Cryptography;
using Backend.Data;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Endpoints;

public static class EmailEndpoints
{
    public sealed record EmailInput(string? Email);
    public sealed record VerifyInput(Guid UserId, string? Token);

    public static void MapEmailEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/account/email", async (HttpContext context, AppDbContext db, VerificationEmail sender) => {
            var user = await db.Users.FindAsync(Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!));
            return user is null ? Results.Unauthorized() : Results.Ok(new { user.Email, user.PendingEmail, enabled = sender.Enabled, resendAfter = user.EmailSentAt?.AddMinutes(1) });
        }).RequireAuthorization();

        endpoints.MapPost("/api/account/email", async (EmailInput input, HttpContext context, AppDbContext db, VerificationEmail sender, ILogger<VerificationEmail> logger, CancellationToken ct) => {
            var email = VerificationEmail.Normalize(input.Email);
            if (email is null) return Results.BadRequest(new { message = "Enter a valid email address." });
            if (!sender.Enabled) return Results.Json(new { message = "Email sending isn't configured yet. Please try again later." }, statusCode: 503);
            var id = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            // Serialize sends for an account, including requests from multiple server instances.
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var user = await db.Users.FromSqlInterpolated($"SELECT * FROM users WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (user is null) return Results.Unauthorized();
            if (user.Email is not null) return Results.BadRequest(new { message = "Your email address is already verified." });
            var now = DateTimeOffset.UtcNow;
            if (user.EmailSentAt > now.AddMinutes(-1)) return Results.Json(new { message = "Wait a minute before requesting another email." }, statusCode: 429);
            if (user.Email == email) return Results.BadRequest(new { message = "This email address is already verified." });
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            user.PendingEmail = email;
            user.EmailTokenHash = VerificationEmail.Hash(token);
            user.EmailTokenExpiresAt = now.AddHours(1);
            user.EmailSentAt = now;
            await db.SaveChangesAsync(ct);
            try { await sender.Send(id, email, token, ct); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException) {
                // Never log the recipient, token, request content, or API key.
                logger.LogWarning("Verification email delivery failed ({ErrorType}).", ex.GetType().Name);
                return Results.Json(new { message = "We couldn't send the verification email. Please try again shortly." }, statusCode: 503);
            }
            await transaction.CommitAsync(ct);
            return Results.Ok(new { message = "Verification email sent. Check your inbox and spam folder. The link expires in 1 hour." });
        }).RequireAuthorization().RequireRateLimiting("email");

        endpoints.MapPost("/api/auth/verify-email", async (VerifyInput input, AppDbContext db, CancellationToken ct) => {
            if (input.Token is null || input.Token.Length != 64 || !input.Token.All(Uri.IsHexDigit)) return InvalidLink();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var user = await db.Users.FromSqlInterpolated($"SELECT * FROM users WHERE \"Id\" = {input.UserId} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (user?.Email is not null) return Results.BadRequest(new { message = "Your email address is already verified." });
            if (user?.PendingEmail is null || user.EmailTokenExpiresAt <= DateTimeOffset.UtcNow || user.EmailTokenExpiresAt is null || user.EmailTokenHash != VerificationEmail.Hash(input.Token)) return InvalidLink();
            user.Email = user.PendingEmail;
            user.PasswordResetHash = null;
            user.PasswordResetExpiresAt = null;
            user.PendingEmail = null;
            user.EmailTokenHash = null;
            user.EmailTokenExpiresAt = null;
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" }) {
                return Results.Conflict(new { message = "That email is already verified on another account. Log in and use a different address." });
            }
            await transaction.CommitAsync(ct);
            return Results.Ok(new { message = "Your email is verified. You can return to mySchlawgs." });
        }).RequireRateLimiting("auth");
    }

    private static IResult InvalidLink() => Results.BadRequest(new { message = "This verification link is invalid, expired, or already used. Log in and request a new email." });
}
