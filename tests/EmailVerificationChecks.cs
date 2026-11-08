using System.Net;
using System.Text.Json;
using Backend.Services;
using Microsoft.Extensions.Configuration;

internal static class EmailVerificationChecks
{
    public static async Task Run()
    {
        void Check(bool value, string name) { if (!value) throw new Exception(name); Console.WriteLine($"PASS {name}"); }
        Check(VerificationEmail.Normalize(" Test@Example.com ") == "test@example.com", "email normalization");
        foreach (var invalid in new[] { "", "not-email", "Someone <user@example.com>", "a@localhost", "a@example.com\r\nBcc: victim@example.com" })
            Check(VerificationEmail.Normalize(invalid) is null, "invalid email rejected");
        Check(VerificationEmail.Hash("a") != VerificationEmail.Hash("b") && VerificationEmail.Hash("a").Length == 64, "token hashes are deterministic SHA-256");
        var settings = new Dictionary<string, string?> { ["Resend:ApiKey"] = "test-key", ["EmailVerification:AppUrl"] = "http://localhost:3000" };
        var handler = new FakeHandler();
        using var client = new HttpClient(handler);
        var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var sender = new VerificationEmail(client, config);
        var id = Guid.NewGuid(); var token = new string('A', 64);
        await sender.Send(id, "test@example.com", token, default);
        var body = JsonDocument.Parse(handler.Body!);
        Check(handler.Uri == "https://api.resend.com/emails" && handler.Auth == "Bearer test-key", "Resend endpoint and backend authorization");
        Check(body.RootElement.GetProperty("text").GetString()!.Contains($"http://localhost:3000/verify-email#userId={id}&token={token}"), "verification link uses configured origin and fragment");
        Check(body.RootElement.GetProperty("to")[0].GetString() == "test@example.com", "verification recipient");
        Check(body.RootElement.GetProperty("from").GetString() == "mySchlawgs <noreply@myschlawgs.lol>", "verified domain sender");
        handler.Status = HttpStatusCode.TooManyRequests;
        try { await sender.Send(id, "test@example.com", token, default); throw new Exception("Provider failure ignored"); }
        catch (HttpRequestException) { Console.WriteLine("PASS provider failures propagate"); }
        foreach (var invalidOrigin in new[] { "https://example.com/redirect", "http://example.com", "https://example.com?x=1", "https://example.com#fragment" }) {
            config["EmailVerification:AppUrl"] = invalidOrigin;
            try { await sender.Send(id, "test@example.com", token, default); throw new Exception("Invalid origin accepted"); }
            catch (InvalidOperationException) { Console.WriteLine("PASS invalid frontend origin rejected"); }
        }
        config["Resend:ApiKey"] = "";
        Check(!sender.Enabled, "unconfigured sending disabled");
    }

    private sealed class FakeHandler : HttpMessageHandler
    {
        public string? Body, Uri, Auth;
        public HttpStatusCode Status = HttpStatusCode.OK;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
            Body = await request.Content!.ReadAsStringAsync(ct); Uri = request.RequestUri!.ToString(); Auth = request.Headers.Authorization!.ToString();
            return new HttpResponseMessage(Status) { Content = new StringContent("{}") };
        }
    }
}
