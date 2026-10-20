using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Security;

public sealed class CaptchaSettings
{
    public bool Enabled { get; set; }
    public string SiteKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string[] AllowedHostnames { get; set; } = [];

    public void Validate(bool development)
    {
        Enabled = Enabled || !development;
        if (Enabled && (string.IsNullOrWhiteSpace(SiteKey) || string.IsNullOrWhiteSpace(SecretKey) || AllowedHostnames.Length == 0))
            throw new InvalidOperationException("Configure Captcha:SiteKey, Captcha:SecretKey and Captcha:AllowedHostnames before enabling CAPTCHA or running in production.");
    }
}

public sealed class CaptchaVerifier(HttpClient client, CaptchaSettings settings)
{
    public async Task<bool> Verify(string? token, string action, CancellationToken ct)
    {
        if (!settings.Enabled) return true;
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2048) return false;
        try {
            using var content = new FormUrlEncodedContent(new Dictionary<string, string> {
                ["secret"] = settings.SecretKey, ["response"] = token
            });
            using var response = await client.PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", content, ct);
            if (!response.IsSuccessStatusCode) return false;
            var result = await response.Content.ReadFromJsonAsync<Verification>(ct);
            return result is { Success: true } && result.Action == action
                && settings.AllowedHostnames.Contains(result.Hostname, StringComparer.OrdinalIgnoreCase);
        } catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException) {
            // Provider failures never grant access; do not log tokens or secrets.
            return false;
        }
    }

    public sealed record Verification(bool Success, string? Action, string? Hostname);
}
