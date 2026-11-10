using System.Security.Cryptography;
using Backend.Data;
using Backend.Models;
using Backend.Security;
using Backend.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Backend.Endpoints;

public static class PasswordResetEndpoints
{
    public sealed record ForgotInput(string? Email, string? CaptchaToken);
    public sealed record ResetInput(Guid UserId, string? Token, string? Password, string? ConfirmPassword);
    private static IResult Accepted() => Results.Ok(new { message = "If an account has this verified email address, we'll send a password reset link. Check your inbox and spam folder. Allow a minute before requesting another link." });
    private static IResult InvalidLink() => Results.BadRequest(new { message = "This reset link is invalid, expired, or already used. Request a new password reset link." });

    public static void MapPasswordResetEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/forgot-password", async (ForgotInput input, CaptchaVerifier captcha, VerificationEmail sender, PasswordResetDelivery delivery, AppDbContext db, CancellationToken ct) => {
            if (!await captcha.Verify(input.CaptchaToken, "authentication", ct))
                return Results.Json(new { message = "Security check failed or expired. Please complete it again." }, statusCode: 403);
            var email = VerificationEmail.Normalize(input.Email);
            if (email is null) return Results.BadRequest(new { message = "Enter a valid email address." });
            if (!sender.Enabled) return Results.Json(new { message = "Password reset emails are unavailable right now. Please try again later." }, statusCode: 503);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            // Only confirmed Email is searched. PendingEmail cannot recover an account.
            var user = await db.Users.FromSqlInterpolated($"SELECT * FROM users WHERE \"Email\" = {email} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (user is null || user.PasswordResetSentAt > DateTimeOffset.UtcNow.AddMinutes(-1)) return Accepted();
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            user.PasswordResetHash = VerificationEmail.Hash(token);
            user.PasswordResetExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30);
            user.PasswordResetSentAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            delivery.Enqueue(new(user.Id, email, token));
            return Accepted();
        }).RequireRateLimiting("recovery");

        endpoints.MapPost("/api/auth/reset-password", async (ResetInput input, HttpContext context, AppDbContext db, IPasswordHasher<AppUser> hasher, PasswordResetDelivery delivery, CancellationToken ct) => {
            if (input.Password is null || input.Password.Length is < 8 or > 128)
                return Results.BadRequest(new { message = "Choose a password with 8–128 characters." });
            if (input.Password != input.ConfirmPassword) return Results.BadRequest(new { message = "The passwords don't match. Enter the same password in both fields." });
            if (input.Token is null || input.Token.Length != 64 || !input.Token.All(Uri.IsHexDigit)) return InvalidLink();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var user = await db.Users.FromSqlInterpolated($"SELECT * FROM users WHERE \"Id\" = {input.UserId} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (user?.Email is null || user.PasswordResetExpiresAt is null || user.PasswordResetExpiresAt <= DateTimeOffset.UtcNow || user.PasswordResetHash != VerificationEmail.Hash(input.Token)) return InvalidLink();
            user.PasswordHash = hasher.HashPassword(user, input.Password);
            user.SessionVersion++;
            user.PasswordResetHash = null;
            user.PasswordResetExpiresAt = null;
            // Invalidate any outstanding email change as well as the recovery link.
            user.PendingEmail = null;
            user.EmailTokenHash = null;
            user.EmailTokenExpiresAt = null;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            await context.SignOutAsync();
            delivery.Enqueue(new(user.Id, user.Email, Guid.NewGuid().ToString("N"), Changed: true));
            return Results.Ok(new { message = "Your password has been reset. Log in with your username and new password." });
        }).RequireRateLimiting("auth");
    }
}
