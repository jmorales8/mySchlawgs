using System.Net.Http.Headers;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;

namespace Backend.Services;

public sealed class VerificationEmail(HttpClient client, IConfiguration config)
{
    public bool Enabled => !string.IsNullOrWhiteSpace(config["Resend:ApiKey"]);

    public static string? Normalize(string? value)
    {
        var email = value?.Trim();
        if (email is null || email.Length > 254 || !MailAddress.TryCreate(email, out var parsed) || parsed.Address != email || !parsed.Host.Contains('.')) return null;
        return email.ToLowerInvariant();
    }

    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public async Task Send(Guid userId, string email, string token, CancellationToken ct)
    {
        var origin = config["EmailVerification:AppUrl"];
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback)) ||
            !string.IsNullOrEmpty(uri.UserInfo) || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment))
            throw new InvalidOperationException("Set EmailVerification:AppUrl to the frontend origin (HTTPS, or localhost for development).");
        // A fragment keeps the secret out of web server request URLs and referrer headers.
        var link = $"{uri.GetLeftPart(UriPartial.Authority)}/verify-email#userId={userId}&token={token}";
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config["Resend:ApiKey"]);
        request.Headers.Add("Idempotency-Key", $"verify-{userId}-{Hash(token)}");
        request.Content = JsonContent.Create(new {
            from = config["Resend:From"] ?? "mySchlawgs <noreply@myschlawgs.lol>",
            to = new[] { email }, subject = "Verify your mySchlawgs email",
            text = $"Confirm your email address for mySchlawgs:\n\n{link}\n\nThis link expires in 1 hour and can be used once. If you didn't request this, you can ignore this email."
        });
        using var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }
}
