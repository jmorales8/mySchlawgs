# CAPTCHA and abuse limits

## Activate Cloudflare Turnstile

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Turnstile**, add a widget, choose **Managed**, and enter your site's hostname (for example, `myschlawgs.com`, without a URL path). Add `localhost` separately if testing locally with real keys.
2. Copy the public **site key** and private **secret key**. Keep the secret out of frontend files, source control, and chat.
3. For local development, edit the backend's existing .NET user-secrets file using your local editor. Preserve its existing connection string and add these properties, replacing the placeholders:

```json
{
  "Captcha:Enabled": "true",
  "Captcha:SiteKey": "YOUR_PUBLIC_SITE_KEY",
  "Captcha:SecretKey": "YOUR_PRIVATE_SECRET_KEY",
  "Captcha:AllowedHostnames:0": "localhost"
}
```

On Windows the file is `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json`; find this project's `UserSecretsId` in `backend/backend.csproj`. Merge the entries into that file, rather than replacing it. Do not commit the file. This avoids placing your secret in shell history.

4. Restart the backend and refresh the page. Signup and login should now display Turnstile. Test both a valid submission and submitting without completing the check.

For hosting, use the platform's secret/environment settings:

```text
Captcha__Enabled=true
Captcha__SiteKey=YOUR_PUBLIC_SITE_KEY
Captcha__SecretKey=YOUR_PRIVATE_SECRET_KEY
Captcha__AllowedHostnames__0=myschlawgs.com
Captcha__AllowedHostnames__1=www.myschlawgs.com
```

Only include actual allowed hostnames. Production requires CAPTCHA configuration and refuses to start without it, even if `Enabled` is false. Development without configured CAPTCHA remains usable; it is not bot-protected by CAPTCHA. Never deploy in Development mode. No database migration or frontend environment key is needed.

## How it works

The frontend retrieves only the public key from `/api/auth/captcha`. Signup/login include a `captchaToken`. Before checking credentials or creating an account, the backend sends that token to Cloudflare and checks success, hostname, and the expected action (`register` or `login`). Missing, oversized, invalid, wrong-host, wrong-action, and provider-error results are denied. Tokens are reset after each form submission and when switching forms.

Cloudflare tokens are single-use and expire after five minutes. See [server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Test keys are intended only for [development testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/); use real keys for bot protection.

## Limits and deployment

- Registration: 5 attempts per 10 minutes per backend-observed IP, including invalid attempts.
- Login: 20 attempts per minute per backend-observed IP.
- Photo and profile uploads combined: 10 requests per 10 minutes per account.
- Reactions, comments, and quote updates: existing 60 requests per minute per account.
- Existing password hashing, HTTP-only cookies, production secure cookies, authorization checks, upload validation, and cross-origin write protection remain enabled.

These limits are in memory per API process; restarting resets them, and multiple replicas do not share them. CAPTCHA reduces automated abuse but does not guarantee all bots are blocked.

**Reverse proxies:** The current Next.js rewrite may make the API see the proxy IP for everyone, sharing the signup/login quota. Before public hosting, configure rate limiting at your trusted ingress (which sees client IPs), or configure ASP.NET forwarded headers for explicitly trusted proxy addresses/networks. Do not trust arbitrary client-supplied `X-Forwarded-For` or `CF-Connecting-IP`. Restrict direct public access to the backend so users cannot bypass ingress limits. For multiple API replicas, enforce shared limits at that ingress or through a shared store.

## Verification

The suite covers CAPTCHA response validation with a mocked provider, production configuration enforcement, auth rate limits, and existing integration behavior. Run `dotnet run --project tests/SmokeTests.csproj -c Release -- --captcha-only` for offline CAPTCHA checks. The full smoke suite expects Development mode with CAPTCHA disabled and a freshly started API (to avoid pre-used rate quotas). Real-widget verification requires your own keys; it has not been performed automatically.
