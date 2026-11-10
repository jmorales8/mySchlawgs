using Backend.Data;
using Backend.Endpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Backend.Models;
using Backend.Security;
using Backend.Services;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
if (builder.Environment.IsDevelopment())
    builder.Configuration.AddJsonFile("resend.local.json", optional: true, reloadOnChange: true).AddEnvironmentVariables();
// Local provisioning command; admin creation is never exposed through an HTTP endpoint.
var adminCommand = Array.IndexOf(args, "--create-admin");
if (adminCommand >= 0)
{
    if (adminCommand + 1 >= args.Length) throw new ArgumentException("Usage: --create-admin USERNAME");
    await AdminAccountProvisioner.CreateAsync(builder.Configuration, args[adminCommand + 1]);
    return;
}
var captcha = builder.Configuration.GetSection("Captcha").Get<CaptchaSettings>() ?? new CaptchaSettings();
captcha.Validate(builder.Environment.IsDevelopment());
builder.Services.AddSingleton(captcha);
builder.Services.AddHttpClient<CaptchaVerifier>(client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHttpClient<VerificationEmail>(client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddSingleton<PasswordResetDelivery>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<PasswordResetDelivery>());

builder.Services.AddOpenApi();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<VoteSnapshotService>();
builder.Services.AddHostedService<VoteSnapshotWorker>();
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 52 * 1024 * 1024);
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "myschlawgs.session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.Events.OnValidatePrincipal = async context => {
        var id = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var version = context.Principal?.FindFirst("session-version")?.Value ?? "0";
        if (!Guid.TryParse(id, out var userId)) { context.RejectPrincipal(); return; }
        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var current = await db.Users.Where(x => x.Id == userId).Select(x => (int?)x.SessionVersion).SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (current is null || version != current.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)) context.RejectPrincipal();
    };
    options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.OnRejected = async (context, ct) => {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(new { message = "Too many attempts. Please wait a few minutes before trying again." }, ct);
    };
    options.AddPolicy("registration", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(10) }));
    options.AddPolicy("email", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromHours(1) }));
    options.AddPolicy("recovery", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromHours(1) }));
    options.AddPolicy("reports", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromHours(1) }));
    options.AddPolicy("uploads", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(10) }));
    options.AddPolicy("social", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
});
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")
        ?? throw new InvalidOperationException("Connection string 'Postgres' is missing.")));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    // A custom header requires a CORS preflight from other origins; no cross-origin writes are allowed.
    if (context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE" && context.Request.Headers["X-Schlawgs-Request"] != "1")
    {
        context.Response.StatusCode = 403;
        return;
    }
    if (context.Request.Path.StartsWithSegments("/api/auth") || context.Request.Path.StartsWithSegments("/api/account/email")) context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapAccountEndpoints();
app.MapEmailEndpoints();
app.MapPasswordResetEndpoints();
app.MapVoteSnapshotEndpoints();
app.MapAnimalProfileEndpoints();
app.MapPhotoEndpoints();
app.MapPostEndpoints();
app.MapModerationEndpoints();
app.MapNotificationEndpoints();

app.Run();
