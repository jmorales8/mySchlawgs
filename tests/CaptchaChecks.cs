using System.Net;
using Backend.Security;

internal static class CaptchaChecks
{
    public static async Task Run()
    {
        var settings = new CaptchaSettings { Enabled = true, SiteKey = "site", SecretKey = "secret", AllowedHostnames = ["dogs.example"] };
        var handler = new ReplyHandler();
        using var client = new HttpClient(handler);
        var verifier = new CaptchaVerifier(client, settings);
        async Task Expect(string? token, bool expected, string name) {
            if (await verifier.Verify(token, "authentication", default) != expected) throw new Exception(name);
            Console.WriteLine($"PASS {name}");
        }
        await Expect(null, false, "missing CAPTCHA denied");
        await Expect(new string('a', 2049), false, "oversized CAPTCHA denied");
        if (handler.Calls != 0) throw new Exception("Invalid input contacted provider");
        handler.Json = """{"success":true,"action":"authentication","hostname":"dogs.example"}""";
        await Expect("valid-token", true, "valid token with matching hostname and action accepted");
        handler.Json = """{"success":true,"action":"login","hostname":"dogs.example"}""";
        await Expect("wrong-action", false, "wrong action denied");
        handler.Json = """{"success":true,"action":"authentication","hostname":"attacker.example"}""";
        await Expect("wrong-host", false, "wrong hostname denied");
        handler.Json = """{"success":false,"error-codes":["timeout-or-duplicate"]}""";
        await Expect("expired-or-replayed", false, "expired/replayed rejection respected");
        handler.Json = "invalid json";
        await Expect("token", false, "malformed provider response denied");
        handler.Fail = true;
        await Expect("token", false, "provider outage denied");
        settings.Enabled = false;
        await Expect(null, true, "development opt-out supported");
        try { new CaptchaSettings().Validate(false); throw new Exception("Production allowed without keys"); }
        catch (InvalidOperationException) { Console.WriteLine("PASS production requires configuration"); }
    }

    private sealed class ReplyHandler : HttpMessageHandler
    {
        public string Json = "{}";
        public int Calls;
        public bool Fail;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
            Calls++;
            if (Fail) throw new HttpRequestException("Provider unavailable");
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(Json, System.Text.Encoding.UTF8, "application/json") });
        }
    }
}
