using System.Security.Claims;
using System.Text.RegularExpressions;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Backend.Security;

namespace Backend.Endpoints;

public static class AccountEndpoints
{
    public sealed record Credentials(string? Username, string? Password, string? CaptchaToken);
    public static object UserResponse(AppUser user) => new { user.Id, user.Username, user.IsAdmin, user.IsModerator, profilePhotoUrl = user.ProfilePhotoId is Guid id ? $"/api/photos/{id}" : null };

    public static void MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth");
        group.MapGet("/captcha", (CaptchaSettings settings) => Results.Ok(new { enabled = settings.Enabled, siteKey = settings.Enabled ? settings.SiteKey : null }));
        group.AddEndpointFilter(async (context, next) => {
            if (context.Arguments.OfType<Credentials>().FirstOrDefault() is { } credentials) {
                var verifier = context.HttpContext.RequestServices.GetRequiredService<CaptchaVerifier>();
                if (!await verifier.Verify(credentials.CaptchaToken, "authentication", context.HttpContext.RequestAborted))
                    return Results.Json(new { message = "Security check failed or expired. Please complete it again." }, statusCode: 403);
            }
            return await next(context);
        });
        group.MapPost("/register", async (Credentials input, AppDbContext db, IPasswordHasher<AppUser> hasher, HttpContext context) =>
        {
            var username = input.Username?.Trim() ?? "";
            if (!Regex.IsMatch(username, "^[a-zA-Z0-9_]{3,30}$") || input.Password is null || input.Password.Length is < 8 or > 128)
                return Results.BadRequest(new { message = "Use a 3–30 character username (letters, numbers, underscores) and an 8–128 character password." });
            var user = new AppUser { Id = Guid.NewGuid(), Username = username, NormalizedUsername = username.ToUpperInvariant(), PasswordHash = "" };
            user.PasswordHash = hasher.HashPassword(user, input.Password);
            db.Users.Add(user);
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
            { return Results.Conflict(new { message = "That username is already taken." }); }
            await SignIn(context, user);
            return Results.Ok(UserResponse(user));
        }).RequireRateLimiting("registration");
        group.MapPost("/login", async (Credentials input, AppDbContext db, IPasswordHasher<AppUser> hasher, HttpContext context) =>
        {
            if (input.Password is null || input.Password.Length > 128 || input.Username is null || input.Username.Length > 30)
                return Results.BadRequest(new { message = "Enter your username and password." });
            var user = await db.Users.SingleOrDefaultAsync(x => x.NormalizedUsername == input.Username.Trim().ToUpperInvariant());
            if (user is null) return Results.Json(new { message = "Incorrect username or password." }, statusCode: 401);
            var result = hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password);
            if (result == PasswordVerificationResult.Failed) return Results.Json(new { message = "Incorrect username or password." }, statusCode: 401);
            if (result == PasswordVerificationResult.SuccessRehashNeeded) { user.PasswordHash = hasher.HashPassword(user, input.Password); await db.SaveChangesAsync(); }
            await SignIn(context, user);
            return Results.Ok(UserResponse(user));
        }).RequireRateLimiting("auth");
        group.MapGet("/me", async (HttpContext context, AppDbContext db) =>
        {
            var user = await db.Users.FindAsync(Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!));
            return user is null ? Results.Unauthorized() : Results.Ok(UserResponse(user));
        }).RequireAuthorization();
        group.MapPost("/logout", async (HttpContext context) => { await context.SignOutAsync(); return Results.NoContent(); });
    }

    private static Task SignIn(HttpContext context, AppUser user) => context.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Name, user.Username)], CookieAuthenticationDefaults.AuthenticationScheme)),
        new AuthenticationProperties { IsPersistent = true });
}
