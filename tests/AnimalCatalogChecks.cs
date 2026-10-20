using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

static class AnimalCatalogChecks
{
    public static async Task Run(AppDbContext db, string url)
    {
        var suffix = Guid.NewGuid().ToString("N")[..12];
        var password = Guid.NewGuid().ToString("N");
        var user = new AppUser { Id = Guid.NewGuid(), Username = "catalog_" + suffix, NormalizedUsername = ("catalog_" + suffix).ToUpperInvariant(), PasswordHash = "" };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, password);
        var type = "Test animal " + suffix;
        var breed = "Test mix " + suffix;
        using var client = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = new Uri(url) };
        client.DefaultRequestHeaders.Add("X-Schlawgs-Request", "1");
        using var anonymous = new HttpClient { BaseAddress = new Uri(url) };
        async Task Expect(HttpResponseMessage response, HttpStatusCode status) {
            if (response.StatusCode != status) throw new Exception($"Expected {status}, got {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }
        try {
            db.Users.Add(user); await db.SaveChangesAsync();
            await Expect(await anonymous.GetAsync("/api/account/animals/suggestions?kind=type"), HttpStatusCode.Unauthorized);
            await Expect(await client.PostAsJsonAsync("/api/auth/login", new { username = user.Username, password }), HttpStatusCode.OK);
            var common = await client.GetFromJsonAsync<string[]>("/api/account/animals/suggestions?kind=type");
            if (common == null || !common.Contains("Dog") || !common.Contains("Guinea pig")) throw new Exception("Missing common pets");
            var input = new { name = "Catalog test", animalType = type, breed, age = 1, ageUnit = "years", funFact = "" };
            await Expect(await client.PostAsJsonAsync("/api/account/animals", input), HttpStatusCode.Created);
            await Expect(await client.PostAsJsonAsync("/api/account/animals", input with { animalType = "  " + type.ToLowerInvariant() + "  " }), HttpStatusCode.Created);
            var types = await client.GetFromJsonAsync<string[]>($"/api/account/animals/suggestions?kind=type&q={Uri.EscapeDataString(suffix)}");
            var breeds = await client.GetFromJsonAsync<string[]>($"/api/account/animals/suggestions?kind=breed&animalType={Uri.EscapeDataString(type.ToLowerInvariant())}");
            var wrongType = await client.GetFromJsonAsync<string[]>($"/api/account/animals/suggestions?kind=breed&animalType=Dog&q={Uri.EscapeDataString(suffix)}");
            if (types?.Length != 1 || breeds?.SingleOrDefault() != breed || wrongType?.Length != 0) throw new Exception("Catalog filtering or deduplication failed");
            if (await db.AnimalCatalog.CountAsync(x => x.NormalizedName.Contains(suffix.ToUpperInvariant())) != 2) throw new Exception("Duplicate catalog entries");
            Console.WriteLine("PASS catalog authentication, common pets, custom entries, case deduplication, and breed scoping");
            var animalId = await db.AnimalProfiles.Where(x => x.OwnerId == user.Id).Select(x => x.Id).FirstAsync();
            MultipartFormDataContent Picture(bool valid = true) {
                var form = new MultipartFormDataContent();
                var bytes = new ByteArrayContent(valid ? Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=") : new byte[] { 1, 2, 3 });
                bytes.Headers.ContentType = new("image/png"); form.Add(bytes, "file", "profile.png"); return form;
            }
            await Expect(await client.PostAsync($"/api/account/animals/{animalId}/photo", Picture(false)), HttpStatusCode.BadRequest);
            await Expect(await client.PostAsync($"/api/account/animals/{Guid.NewGuid()}/photo", Picture()), HttpStatusCode.NotFound);
            var uploaded = await client.PostAsync($"/api/account/animals/{animalId}/photo", Picture());
            await Expect(uploaded, HttpStatusCode.OK);
            var photoUrl = (await uploaded.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("profilePhotoUrl").GetString()!;
            await Expect(await client.GetAsync(photoUrl), HttpStatusCode.OK);
            var updated = await client.PostAsync($"/api/account/animals/{animalId}/photo", Picture());
            await Expect(updated, HttpStatusCode.OK);
            var newUrl = (await updated.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("profilePhotoUrl").GetString();
            if (photoUrl == newUrl || await db.Users.Where(x => x.Id == user.Id).Select(x => x.ProfilePhotoId).SingleAsync() != null) throw new Exception("Animal photo replacement affected account picture");
            var feed = await client.GetFromJsonAsync<JsonElement[]>("/api/photos");
            if (feed!.Any(x => x.GetProperty("ownerId").ToString() == user.Id.ToString())) throw new Exception("Animal picture appeared in feed");
            Console.WriteLine("PASS animal photo validation, upload, replacement, download, and account/feed isolation");
        } finally {
            await db.AnimalProfiles.Where(x => x.OwnerId == user.Id).ExecuteDeleteAsync();
            await db.Photos.Where(x => x.OwnerId == user.Id).ExecuteDeleteAsync();
            await db.Users.Where(x => x.Id == user.Id).ExecuteDeleteAsync();
            await db.AnimalCatalog.Where(x => x.NormalizedName.Contains(suffix.ToUpperInvariant())).ExecuteDeleteAsync();
        }
    }
}
