using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

await CaptchaChecks.Run();
if (args.FirstOrDefault() == "--captcha-only") return;
await ImageSanitizerChecks.Run();
if (args.FirstOrDefault() == "--images-only") return;
var apiUrl = args.FirstOrDefault() ?? "http://localhost:5006";
var config = new ConfigurationBuilder().AddJsonFile(Path.GetFullPath("backend/appsettings.json"))
    .AddUserSecrets(typeof(AppDbContext).Assembly).AddEnvironmentVariables().Build();
await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(config.GetConnectionString("Postgres")).Options);
if (args.FirstOrDefault() == "--catalog-only") { await AnimalCatalogChecks.Run(db, args.ElementAtOrDefault(1) ?? "http://localhost:5005"); return; }
// Explicit repair for a known upload made before batch IDs were recorded.
if (args.FirstOrDefault() == "--group-photos") {
    var ids = args.Skip(1).Select(Guid.Parse).ToArray();
    if (ids.Length is < 2 or > 10 || ids.Distinct().Count() != ids.Length) throw new Exception("Provide 2–10 distinct photo IDs.");
    var selected = await db.Photos.Where(p => ids.Contains(p.Id)).OrderBy(p => p.UploadedAt).ToListAsync();
    if (selected.Count != ids.Length || selected.Any(p => p.IsProfilePhoto || p.PostId != null || p.BatchId != null || p.OwnerId == null) || selected.Select(p => p.OwnerId).Distinct().Count() != 1 || selected[^1].UploadedAt - selected[0].UploadedAt > TimeSpan.FromSeconds(1))
        throw new Exception("Repair requires ungrouped photos from one owner uploaded within one second.");
    var repairedBatch = Guid.NewGuid();
    for (var i = 0; i < selected.Count; i++) { selected[i].BatchId = repairedBatch; selected[i].BatchPosition = i; }
    await db.SaveChangesAsync();
    Console.WriteLine($"Grouped {selected.Count} photos into one post. Image bytes and captions unchanged.");
    return;
}
var suffix = Guid.NewGuid().ToString("N")[..12];
var names = new[] { "smoke_a_" + suffix, "smoke_b_" + suffix, "smoke_c_" + suffix }.Concat(Enumerable.Range(0, 10).Select(i => $"smoke_r{i}_{suffix}")).ToArray();
var password = Guid.NewGuid().ToString("N");
HttpClient Client(bool header = true) {
    var client = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = new Uri(apiUrl) };
    if (header) client.DefaultRequestHeaders.Add("X-Schlawgs-Request", "1");
    return client;
}
using var first = Client(); using var second = Client(); using var anonymous = Client(); using var noHeader = Client(false);
int passed = 0;
async Task<JsonElement> Check(HttpResponseMessage response, HttpStatusCode expected, string name) {
    var body = await response.Content.ReadAsStringAsync();
    if (response.StatusCode != expected) throw new Exception($"{name}: expected {expected}, got {response.StatusCode}: {body}");
    Console.WriteLine($"PASS {name}"); passed++;
    return string.IsNullOrEmpty(body) ? default : JsonDocument.Parse(body).RootElement.Clone();
}
var png = ImageSanitizerChecks.Fixture(ImageMagick.MagickFormat.Png);
var cleanPng = await Backend.Security.ImageSanitizer.SanitizeAsync(png, "image/png");
MultipartFormDataContent Upload(bool invalid = false, int count = 2) {
    var form = new MultipartFormDataContent();
    for (var i = 0; i < count; i++) {
        var bytes = new ByteArrayContent(invalid && i == count - 1 ? new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 } : png);
        bytes.Headers.ContentType = new("image/png");
        form.Add(bytes, "files", $"dog{i}.png"); form.Add(new StringContent($"Story {i}"), "descriptions");
    }
    return form;
}
try {
    await Check(await noHeader.PostAsJsonAsync("/api/auth/register", new { username = names[0], password }), HttpStatusCode.Forbidden, "cross-origin write protection");
    await Check(await anonymous.PostAsync("/api/photos", Upload()), HttpStatusCode.Unauthorized, "anonymous uploads rejected");
    await Check(await first.PostAsJsonAsync("/api/auth/register", new { username = names[0], password = "short" }), HttpStatusCode.BadRequest, "weak password rejected");
    var account = await Check(await first.PostAsJsonAsync("/api/auth/register", new { username = names[0], password }), HttpStatusCode.OK, "registration signs in immediately");
    var ownerId = account.GetProperty("id").GetGuid();
    var stored = await db.Users.AsNoTracking().SingleAsync(x => x.Id == ownerId);
    if (stored.PasswordHash == password || stored.PasswordHash.Length < 40) throw new Exception("Password was not hashed");
    Console.WriteLine("PASS password stored as hash"); passed++;
    await Check(await first.GetAsync("/api/auth/me"), HttpStatusCode.OK, "session cookie persists");
    await Check(await second.PostAsJsonAsync("/api/auth/register", new { username = names[0].ToUpperInvariant(), password }), HttpStatusCode.Conflict, "case-insensitive duplicate rejected");
    var uploaded = await Check(await first.PostAsync("/api/photos", Upload()), HttpStatusCode.Created, "multi-photo upload");
    if (uploaded.GetArrayLength() != 2 || uploaded[1].GetProperty("description").GetString() != "Story 1") throw new Exception("Descriptions lost");
    var batchId = uploaded[0].GetProperty("batchId").GetGuid();
    if (uploaded[1].GetProperty("batchId").GetGuid() != batchId || uploaded[0].GetProperty("batchPosition").GetInt32() != 0 || uploaded[1].GetProperty("batchPosition").GetInt32() != 1) throw new Exception("Batch identity or order lost");
    Console.WriteLine("PASS uploaded photos share a batch and preserve selection order"); passed++;
    var id = uploaded[0].GetProperty("id").GetGuid();
    var image = await first.GetAsync($"/api/photos/{id}");
    if (!image.IsSuccessStatusCode || !(await image.Content.ReadAsByteArrayAsync()).SequenceEqual(cleanPng)) throw new Exception("Downloaded image was not sanitized");
    var storedPhoto = await db.Photos.AsNoTracking().SingleAsync(p => p.Id == id);
    if (storedPhoto.FileName != $"{id:N}.png" || storedPhoto.Size != cleanPng.LongLength || !storedPhoto.Data.SequenceEqual(cleanPng)) throw new Exception("Original filename, metadata, or wrong size stored");
    Console.WriteLine("PASS sanitized image round-trip and generated filename"); passed++;
    var before = await db.Photos.CountAsync(x => x.OwnerId == ownerId);
    await Check(await first.PostAsync("/api/photos", Upload(invalid: true)), HttpStatusCode.BadRequest, "invalid image batch rejected");
    if (await db.Photos.CountAsync(x => x.OwnerId == ownerId) != before) throw new Exception("Partial batch saved");
    Console.WriteLine("PASS invalid batch saves no photos"); passed++;
    await Check(await first.PostAsync("/api/photos", Upload(count: 11)), HttpStatusCode.BadRequest, "batch count limit");
    await Check(await first.PatchAsJsonAsync($"/api/photos/{id}", new { description = new string('x', 2001) }), HttpStatusCode.BadRequest, "caption length limit");
    await Check(await first.PatchAsJsonAsync($"/api/photos/{id}", new { description = "Updated story" }), HttpStatusCode.NoContent, "owner edits caption");
    await Check(await second.PostAsJsonAsync("/api/auth/register", new { username = names[1], password }), HttpStatusCode.OK, "second account");
    await Check(await second.PatchAsJsonAsync($"/api/photos/{id}", new { description = "Not mine" }), HttpStatusCode.NotFound, "other users cannot edit caption");
    var profile = await Check(await first.PostAsync("/api/profile/photo", Upload(count: 1)), HttpStatusCode.OK, "profile picture upload");
    if (profile.GetProperty("profilePhotoUrl").ValueKind != JsonValueKind.String) throw new Exception("Profile URL missing");
    var profileId = Guid.Parse(profile.GetProperty("profilePhotoUrl").GetString()!.Split('/').Last());
    var profileImage = await db.Photos.AsNoTracking().SingleAsync(p => p.Id == profileId);
    if (!profileImage.Data.SequenceEqual(cleanPng) || profileImage.FileName != $"{profileId:N}.png") throw new Exception("Profile photo was not sanitized");
    Console.WriteLine("PASS profile picture metadata stripped"); passed++;
    var animal = await Check(await first.PostAsJsonAsync("/api/account/animals", new { name = "Privacy test", animalType = "Dog", breed = "", age = 1, ageUnit = "years", funFact = "" }), HttpStatusCode.Created, "animal for upload privacy check");
    var animalPicture = await Check(await first.PostAsync($"/api/account/animals/{animal.GetProperty("id").GetGuid()}/photo", Upload(count: 1)), HttpStatusCode.OK, "animal picture upload");
    var animalPhotoId = animalPicture.GetProperty("profilePhotoId").GetGuid();
    var animalImage = await db.Photos.AsNoTracking().SingleAsync(p => p.Id == animalPhotoId);
    if (!animalImage.Data.SequenceEqual(cleanPng) || animalImage.FileName != $"{animalPhotoId:N}.png") throw new Exception("Animal photo was not sanitized");
    Console.WriteLine("PASS animal picture metadata stripped"); passed++;
    var feed = await Check(await first.GetAsync("/api/photos"), HttpStatusCode.OK, "public photo feed");
    var mine = feed.EnumerateArray().Where(p => p.GetProperty("ownerId").ValueKind == JsonValueKind.String && p.GetProperty("ownerId").GetGuid() == ownerId).ToArray();
    if (mine.Length != 2 || mine.Any(p => p.GetProperty("profilePhotoUrl").GetString() != profile.GetProperty("profilePhotoUrl").GetString())) throw new Exception("Profile feed association broken");
    if (mine.Any(p => p.GetProperty("batchId").GetGuid() != batchId) || mine.Single(p => p.GetProperty("batchPosition").GetInt32() == 0).GetProperty("description").GetString() != "Updated story" || mine.Single(p => p.GetProperty("batchPosition").GetInt32() == 1).GetProperty("description").GetString() != "Story 1") throw new Exception("Feed lost batch or caption association");
    Console.WriteLine("PASS feed preserves batch and individual captions after editing"); passed++;

    var postId = uploaded[0].GetProperty("postId").GetGuid();
    if (uploaded[1].GetProperty("postId").GetGuid() != postId) throw new Exception("Carousel split across posts");
    var post = await Check(await anonymous.GetAsync($"/api/posts/{postId}"), HttpStatusCode.OK, "shared post accessible without login");
    if (post.GetArrayLength() != 2 || post[1].GetProperty("description").GetString() != "Story 1") throw new Exception("Shared post incomplete");
    await Check(await anonymous.GetAsync($"/api/posts/{Guid.NewGuid()}"), HttpStatusCode.NotFound, "missing shared post returns 404");
    await Check(await anonymous.GetAsync($"/api/posts/{Guid.Parse(profile.GetProperty("profilePhotoUrl").GetString()!.Split('/').Last())}"), HttpStatusCode.NotFound, "profile image is not a post");
    await Check(await anonymous.PutAsJsonAsync($"/api/posts/{postId}/reaction", new { kind = "like" }), HttpStatusCode.Unauthorized, "anonymous reactions rejected");
    await Check(await noHeader.PutAsJsonAsync($"/api/posts/{postId}/reaction", new { kind = "like" }), HttpStatusCode.Forbidden, "reaction PUT requires CSRF header");
    await Check(await first.PutAsJsonAsync($"/api/posts/{postId}/reaction", new { kind = "invalid" }), HttpStatusCode.BadRequest, "invalid reaction rejected");
    await Check(await first.PutAsJsonAsync($"/api/posts/{postId}/reaction", new { kind = "like" }), HttpStatusCode.NoContent, "like saved");
    await Check(await first.PutAsJsonAsync($"/api/posts/{postId}/reaction", new { kind = "love" }), HttpStatusCode.NoContent, "reaction changed to love");
    var concurrent = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => second.PutAsJsonAsync($"/api/posts/{postId}/reaction", new { kind = "laugh" })));
    foreach (var response in concurrent) { if (response.StatusCode != HttpStatusCode.NoContent) throw new Exception("Concurrent reaction failed"); response.Dispose(); }
    var activity = await Check(await anonymous.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "public reactions include people and types");
    var reactions = activity.GetProperty("reactions").EnumerateArray().ToArray();
    if (reactions.Length != 2 || reactions.Single(r => r.GetProperty("username").GetString() == names[0]).GetProperty("kind").GetString() != "love" || reactions.Single(r => r.GetProperty("username").GetString() == names[1]).GetProperty("kind").GetString() != "laugh") throw new Exception("Reactions duplicated or misattributed");
    Console.WriteLine("PASS concurrent reactions are unique per user and post"); passed++;
    await Check(await first.DeleteAsync($"/api/posts/{postId}/reaction"), HttpStatusCode.NoContent, "remove own reaction");
    if (await db.Reactions.CountAsync(r => r.PostId == postId) != 1) throw new Exception("Reaction removal affected someone else");
    await Check(await anonymous.GetAsync("/api/photos?feed=interacted"), HttpStatusCode.Unauthorized, "personal activity feed requires login");
    await Check(await anonymous.GetAsync("/api/photos?feed=mine"), HttpStatusCode.Unauthorized, "my photos feed requires login");
    await Check(await anonymous.GetAsync("/api/photos?feed=invalid"), HttpStatusCode.BadRequest, "invalid feed rejected");
    var likedFeed = await Check(await second.GetAsync("/api/photos?feed=interacted"), HttpStatusCode.OK, "reacted posts appear in personal feed");
    if (likedFeed.GetArrayLength() != 2 || likedFeed.EnumerateArray().Any(p => p.GetProperty("postId").GetGuid() != postId)) throw new Exception("Interacted feed did not preserve entire carousel");
    var unlikedFeed = await Check(await first.GetAsync("/api/photos?feed=interacted"), HttpStatusCode.OK, "removed reaction no longer qualifies");
    if (unlikedFeed.GetArrayLength() != 0) throw new Exception("Interacted feed includes someone else's activity");
    var ownFeed = await Check(await first.GetAsync("/api/photos?feed=mine"), HttpStatusCode.OK, "my photos contains only own public photos");
    if (ownFeed.GetArrayLength() != 2 || ownFeed.EnumerateArray().Any(p => p.GetProperty("ownerId").GetGuid() != ownerId)) throw new Exception("My photos feed incorrect");
    await Check(await anonymous.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = "Hello" }), HttpStatusCode.Unauthorized, "anonymous comments rejected");
    await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = "  " }), HttpStatusCode.BadRequest, "empty comment rejected");
    await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = new string('a', 2001) }), HttpStatusCode.BadRequest, "long comment rejected");
    var comment = await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = "Wonderful schlawgs!" }), HttpStatusCode.Created, "comment saved");
    var commentId = comment.GetProperty("id").GetGuid();
    using var third = Client();
    var thirdAccount = await Check(await third.PostAsJsonAsync("/api/auth/register", new { username = names[2], password, isAdmin = true }), HttpStatusCode.OK, "third account for authorization checks");
    if (thirdAccount.GetProperty("isAdmin").GetBoolean()) throw new Exception("Client self-promoted to admin");
    var thirdId = thirdAccount.GetProperty("id").GetGuid();
    await Check(await third.DeleteAsync($"/api/posts/{postId}/comments/{commentId}"), HttpStatusCode.Forbidden, "unrelated user cannot remove comment");
    await Check(await anonymous.DeleteAsync($"/api/posts/{postId}/comments/{commentId}"), HttpStatusCode.Unauthorized, "anonymous removal rejected");
    var otherUpload = await Check(await third.PostAsync("/api/photos", Upload(count: 1)), HttpStatusCode.Created, "separate post");
    var otherPost = otherUpload[0].GetProperty("postId").GetGuid();
    var editPath = $"/api/posts/{postId}/comments/{commentId}";
    var originalComment = await db.Comments.AsNoTracking().SingleAsync(c => c.Id == commentId);
    await Check(await anonymous.PatchAsJsonAsync(editPath, new { body = "Guest edit" }), HttpStatusCode.Unauthorized, "anonymous comment edit denied");
    await Check(await noHeader.PatchAsJsonAsync(editPath, new { body = "No CSRF header" }), HttpStatusCode.Forbidden, "comment edit requires CSRF header");
    await Check(await first.PatchAsJsonAsync(editPath, new { body = "Owner edit" }), HttpStatusCode.Forbidden, "post owner cannot edit another author's comment");
    await Check(await third.PatchAsJsonAsync(editPath, new { body = "Other edit" }), HttpStatusCode.Forbidden, "unrelated account cannot edit comment");
    await Check(await second.PatchAsJsonAsync($"/api/posts/{otherPost}/comments/{commentId}", new { body = "Wrong post" }), HttpStatusCode.NotFound, "comment edit checks post identity");
    await Check(await second.PatchAsJsonAsync(editPath, new { body = "  " }), HttpStatusCode.BadRequest, "blank comment edit rejected");
    await Check(await second.PatchAsJsonAsync(editPath, new { body = new string('x', 2001) }), HttpStatusCode.BadRequest, "oversized comment edit rejected");
    await Check(await second.PatchAsJsonAsync(editPath, new { body = "  Updated schlawg appreciation!  ", photoId = Guid.NewGuid(), parentCommentId = Guid.NewGuid() }), HttpStatusCode.NoContent, "author edits comment");
    var editedComment = await db.Comments.AsNoTracking().SingleAsync(c => c.Id == commentId);
    if (editedComment.Body != "Updated schlawg appreciation!" || editedComment.CreatedAt != originalComment.CreatedAt || editedComment.PhotoId != originalComment.PhotoId || editedComment.ParentCommentId != originalComment.ParentCommentId) throw new Exception("Editing changed comment identity or thread context");
    var editableActivity = await Check(await second.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "author sees edit permission");
    if (!editableActivity.GetProperty("comments").EnumerateArray().Single(c => c.GetProperty("id").GetGuid() == commentId).GetProperty("canEdit").GetBoolean()) throw new Exception("Author missing edit permission");
    await Check(await first.DeleteAsync($"/api/posts/{otherPost}/comments/{commentId}"), HttpStatusCode.NotFound, "comment ID cannot be used with another post");
    var publicComments = await Check(await anonymous.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "comments publicly readable");
    if (publicComments.GetProperty("comments")[0].GetProperty("canDelete").GetBoolean() || publicComments.GetProperty("comments")[0].GetProperty("canEdit").GetBoolean()) throw new Exception("Guest allowed to edit or delete");
    await Check(await second.DeleteAsync($"/api/posts/{postId}/comments/{commentId}"), HttpStatusCode.NoContent, "comment author can remove own comment");
    await Check(await second.PatchAsJsonAsync(editPath, new { body = "Deleted comment edit" }), HttpStatusCode.NotFound, "deleted comment cannot be edited");
    var deletionInbox = await Check(await second.GetAsync("/api/notifications"), HttpStatusCode.OK, "self-deletion notification check");
    if (deletionInbox.GetProperty("items").EnumerateArray().Any(n => n.GetProperty("kind").GetString() == "comment-removed")) throw new Exception("Self-deletion or forbidden deletion sent a notification");
    comment = await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = "Owner can moderate" }), HttpStatusCode.Created, "comment for owner moderation");
    await Check(await first.DeleteAsync($"/api/posts/{postId}/comments/{comment.GetProperty("id").GetGuid()}"), HttpStatusCode.NoContent, "post owner can remove another user's comment");
    deletionInbox = await Check(await second.GetAsync("/api/notifications"), HttpStatusCode.OK, "post owner removal notifies comment author");
    var ownerRemoval = deletionInbox.GetProperty("items").EnumerateArray().Single(n => n.GetProperty("kind").GetString() == "comment-removed");
    if (ownerRemoval.GetProperty("postId").GetGuid() != postId || ownerRemoval.GetProperty("readAt").ValueKind != JsonValueKind.Null || ownerRemoval.GetProperty("message").GetString() != "Your comment was removed by the post author.") throw new Exception("Owner removal notification incorrect");
    comment = await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = "Admin can moderate" }), HttpStatusCode.Created, "comment for admin moderation");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsAdmin, true));
    await Check(await third.PatchAsJsonAsync($"/api/posts/{postId}/comments/{comment.GetProperty("id").GetGuid()}", new { body = "Admin edit" }), HttpStatusCode.Forbidden, "admin cannot edit another author comment");
    await Check(await third.DeleteAsync($"/api/posts/{postId}/comments/{comment.GetProperty("id").GetGuid()}"), HttpStatusCode.NoContent, "admin can remove comments on another post");
    await Check(await third.DeleteAsync($"/api/posts/{postId}/comments/{comment.GetProperty("id").GetGuid()}"), HttpStatusCode.NotFound, "repeated comment removal cannot notify twice");
    deletionInbox = await Check(await second.GetAsync("/api/notifications"), HttpStatusCode.OK, "admin removal notifies comment author");
    var removalNotifications = deletionInbox.GetProperty("items").EnumerateArray().Where(n => n.GetProperty("kind").GetString() == "comment-removed").ToArray();
    if (removalNotifications.Length != 2 || !removalNotifications.Any(n => n.GetProperty("message").GetString() == "Your comment was removed by an administrator.")) throw new Exception("Admin removal notification missing or duplicated");
    var moderatorComment = await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = "Moderator can moderate" }), HttpStatusCode.Created, "comment for moderator notification");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsAdmin, false).SetProperty(u => u.IsModerator, true));
    await Check(await third.PatchAsJsonAsync($"/api/posts/{postId}/comments/{moderatorComment.GetProperty("id").GetGuid()}", new { body = "Moderator edit" }), HttpStatusCode.Forbidden, "moderator cannot edit another author comment");
    await Check(await third.DeleteAsync($"/api/posts/{postId}/comments/{moderatorComment.GetProperty("id").GetGuid()}"), HttpStatusCode.NoContent, "moderator removes comment");
    deletionInbox = await Check(await second.GetAsync("/api/notifications"), HttpStatusCode.OK, "moderator removal notifies comment author");
    if (!deletionInbox.GetProperty("items").EnumerateArray().Any(n => n.GetProperty("kind").GetString() == "comment-removed" && n.GetProperty("message").GetString() == "Your comment was removed by a moderator.")) throw new Exception("Moderator removal notification missing");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsModerator, false));
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsAdmin, false));
    comment = await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = id, body = "Revoked admin must not delete" }), HttpStatusCode.Created, "comment after admin revocation");
    await Check(await third.DeleteAsync($"/api/posts/{postId}/comments/{comment.GetProperty("id").GetGuid()}"), HttpStatusCode.Forbidden, "admin revocation takes effect without new login");
    var remaining = await Check(await anonymous.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "deleted comments stay removed");
    if (remaining.GetProperty("comments").GetArrayLength() != 1) throw new Exception("Deletion did not persist");
    if (await db.Photos.AnyAsync(p => !p.IsProfilePhoto && p.PostId == null)) throw new Exception("Migration did not backfill existing public photos");
    Console.WriteLine("PASS existing photos have permanent posts"); passed++;
    var photo2 = uploaded[1].GetProperty("id").GetGuid();
    var quotePath = $"/api/posts/{postId}/photos/{id}/quote";
    var quote2Path = $"/api/posts/{postId}/photos/{photo2}/quote";
    var quoteComment = await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = photo2, body = "Second slide superstar" }), HttpStatusCode.Created, "comment references second slide");
    var quoteCommentId = quoteComment.GetProperty("id").GetGuid();
    await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { body = "Missing photo" }), HttpStatusCode.BadRequest, "new comments require photo reference");
    await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { photoId = otherUpload[0].GetProperty("id").GetGuid(), body = "Wrong photo" }), HttpStatusCode.BadRequest, "cross-post comment photo rejected");
    await Check(await anonymous.PutAsJsonAsync(quotePath, new { commentId = quoteCommentId }), HttpStatusCode.Unauthorized, "guest cannot select quote");
    await Check(await second.PutAsJsonAsync(quotePath, new { commentId = quoteCommentId }), HttpStatusCode.Forbidden, "comment author cannot select someone else's post quote");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsAdmin, true));
    await Check(await third.PutAsJsonAsync(quotePath, new { commentId = quoteCommentId }), HttpStatusCode.Forbidden, "admin cannot choose another author's quote");
    await Check(await first.PutAsJsonAsync(quotePath, new { commentId = quoteCommentId }), HttpStatusCode.NoContent, "post author selects quote");
    await Check(await first.PutAsJsonAsync(quote2Path, new { commentId = quoteCommentId }), HttpStatusCode.NoContent, "each photo has independent quote");
    await Check(await second.PatchAsJsonAsync($"/api/posts/{postId}/comments/{quoteCommentId}", new { body = "An edited best quote" }), HttpStatusCode.NoContent, "author edits featured comment");
    var quotes = await Check(await anonymous.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "quotes public without login");
    var slideComment = quotes.GetProperty("comments").EnumerateArray().Single(c => c.GetProperty("id").GetGuid() == quoteCommentId);
    if (slideComment.GetProperty("slideNumber").GetInt32() != 2 || slideComment.GetProperty("photoId").GetGuid() != photo2 || quotes.GetProperty("bestQuotes").GetArrayLength() != 2 || quotes.GetProperty("canChooseQuote").GetBoolean()) throw new Exception("Slide or quote metadata incorrect");
    if (slideComment.GetProperty("body").GetString() != "An edited best quote" || quotes.GetProperty("bestQuotes").EnumerateArray().Any(q => q.GetProperty("commentId").GetGuid() != quoteCommentId)) throw new Exception("Editing detached the featured quote");
    await Check(await first.PutAsJsonAsync(quotePath, new { commentId = comment.GetProperty("id").GetGuid() }), HttpStatusCode.NoContent, "replaces single quote for photo");
    if (await db.Photos.Where(p => p.PostId == postId && p.BestQuoteCommentId != null).CountAsync() != 2) throw new Exception("Quote replacement changed other slide");
    await Check(await first.PutAsJsonAsync(quotePath, new { commentId = (Guid?)null }), HttpStatusCode.NoContent, "quote is optional and removable");
    await Check(await third.PutAsJsonAsync($"/api/posts/{otherPost}/photos/{otherUpload[0].GetProperty("id").GetGuid()}/quote", new { commentId = quoteCommentId }), HttpStatusCode.BadRequest, "cross-post quote rejected");
    await Check(await first.PutAsJsonAsync($"/api/posts/{postId}/photos/{otherUpload[0].GetProperty("id").GetGuid()}/quote", new { commentId = quoteCommentId }), HttpStatusCode.NotFound, "cross-post target photo rejected");
    await Check(await second.DeleteAsync($"/api/posts/{postId}/comments/{quoteCommentId}"), HttpStatusCode.NoContent, "featured comment deletion allowed");
    if (await db.Photos.AnyAsync(p => p.PostId == postId && p.BestQuoteCommentId != null)) throw new Exception("Deleted comment left stale quote");
    Console.WriteLine("PASS deleting featured comment clears its quote"); passed++;
    // Seed popularity and stale activity directly so discovery boundaries are deterministic.
    for (var i = 0; i < 5; i++) db.Comments.Add(new Backend.Models.PostComment {
        Id = Guid.NewGuid(), PostId = postId, PhotoId = id, AuthorId = ownerId,
        Body = "Discovery fixture", CreatedAt = DateTimeOffset.UtcNow.AddDays(-8)
    });
    await db.SaveChangesAsync();
    await Check(await anonymous.GetAsync("/api/posts/random?category=unknown"), HttpStatusCode.BadRequest, "invalid discovery category rejected");
    await Check(await anonymous.GetAsync("/api/posts/random"), HttpStatusCode.BadRequest, "discovery requires category");
    foreach (var category in new[] { "popular", "niche", "relevant" }) {
        var pick = await Check(await anonymous.GetAsync($"/api/posts/random?category={category}"), HttpStatusCode.OK, $"guest can discover {category} post");
        var pickedId = pick.GetProperty("postId").GetGuid();
        var score = await db.Reactions.CountAsync(r => r.PostId == pickedId) + await db.Comments.CountAsync(c => c.PostId == pickedId);
        if (category == "popular" && score < 5 || category == "niche" && score >= 5 || category == "relevant" && !await db.Comments.AnyAsync(c => c.PostId == pickedId && c.CreatedAt >= DateTimeOffset.UtcNow.AddDays(-7))) throw new Exception("Discovery category mismatch");
        await Check(await anonymous.GetAsync($"/api/posts/{pickedId}"), HttpStatusCode.OK, "discovered post opens publicly");
    }
    foreach (var category in new[] { "popular", "niche", "relevant" }) {
        using var response = await first.GetAsync($"/api/posts/random?category={category}&excludePostId={otherPost}");
        if (response.StatusCode == HttpStatusCode.NotFound) { Console.WriteLine("PASS empty discovery handled"); passed++; continue; }
        var pick = await Check(response, HttpStatusCode.OK, "signed-in discovery excludes own and current posts");
        var pickedId = pick.GetProperty("postId").GetGuid();
        if (pickedId == otherPost || await db.Posts.AnyAsync(p => p.Id == pickedId && p.OwnerId == ownerId)) throw new Exception("Discovery returned own or current post");
    }
    // Threaded replies and author endorsement.
    var parentId = comment.GetProperty("id").GetGuid();
    var reply = await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/comments", new { body = "A reply", photoId = photo2, parentCommentId = parentId }), HttpStatusCode.Created, "reply saved");
    var replyId = reply.GetProperty("id").GetGuid();
    var nested = await Check(await first.PostAsJsonAsync($"/api/posts/{postId}/comments", new { body = "Reply to reply", parentCommentId = replyId }), HttpStatusCode.Created, "nested reply saved");
    await Check(await first.PostAsJsonAsync($"/api/posts/{otherPost}/comments", new { body = "Wrong post", parentCommentId = replyId }), HttpStatusCode.BadRequest, "cross-post reply rejected");
    await Check(await anonymous.PutAsync($"/api/posts/{postId}/comments/{replyId}/like", null), HttpStatusCode.Unauthorized, "guest comment like denied");
    await Check(await first.PutAsync($"/api/posts/{postId}/comments/{replyId}/like", null), HttpStatusCode.NoContent, "author likes comment");
    await Check(await first.PutAsync($"/api/posts/{postId}/comments/{replyId}/like", null), HttpStatusCode.NoContent, "repeated comment like idempotent");
    var commentedFeed = await Check(await first.GetAsync("/api/photos?feed=interacted"), HttpStatusCode.OK, "commented posts appear in personal feed");
    if (commentedFeed.GetArrayLength() != 2) throw new Exception("Comment interaction not included");
    await Check(await third.PutAsync($"/api/posts/{postId}/comments/{replyId}/like", null), HttpStatusCode.NoContent, "comment-only liker");
    var commentLikeFeed = await Check(await third.GetAsync("/api/photos?feed=interacted"), HttpStatusCode.OK, "comment likes qualify for activity feed");
    if (commentLikeFeed.GetArrayLength() != 2) throw new Exception("Comment like interaction not included");
    await Check(await third.DeleteAsync($"/api/posts/{postId}/comments/{replyId}/like"), HttpStatusCode.NoContent, "remove comment-only feed fixture like");
    var thread = await Check(await anonymous.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "public threaded comments and author badge");
    var replyData = thread.GetProperty("comments").EnumerateArray().Single(c => c.GetProperty("id").GetGuid() == replyId);
    if (replyData.GetProperty("photoId").GetGuid() != id || !replyData.GetProperty("likedByPostAuthor").GetBoolean() || replyData.GetProperty("likeCount").GetInt32() != 1 || replyData.GetProperty("parentCommentId").GetGuid() != parentId) throw new Exception("Thread or author endorsement incorrect");
    await Check(await second.PatchAsJsonAsync($"/api/posts/{postId}/comments/{replyId}", new { body = "Updated reply" }), HttpStatusCode.NoContent, "author edits existing reply");
    var editedThread = await Check(await anonymous.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "edited reply visible publicly");
    var editedReply = editedThread.GetProperty("comments").EnumerateArray().Single(c => c.GetProperty("id").GetGuid() == replyId);
    if (editedReply.GetProperty("body").GetString() != "Updated reply" || editedReply.GetProperty("parentCommentId").GetGuid() != parentId || editedReply.GetProperty("photoId").GetGuid() != id || editedReply.GetProperty("likeCount").GetInt32() != 1) throw new Exception("Editing reply lost likes or parent/photo context");
    await Check(await first.DeleteAsync($"/api/posts/{postId}/comments/{replyId}/like"), HttpStatusCode.NoContent, "author removes comment like");
    var commentReactionPath = $"/api/posts/{postId}/comments/{replyId}/reaction";
    await Check(await anonymous.PutAsJsonAsync(commentReactionPath, new { kind = "love" }), HttpStatusCode.Unauthorized, "comment reactions require sign-in");
    await Check(await second.PutAsJsonAsync(commentReactionPath, new { kind = "invalid" }), HttpStatusCode.BadRequest, "comment reaction kind validated");
    await Check(await second.PutAsJsonAsync($"/api/posts/{otherPost}/comments/{replyId}/reaction", new { kind = "love" }), HttpStatusCode.NotFound, "comment reaction checks parent post");
    await Check(await first.PutAsJsonAsync(commentReactionPath, new { kind = "love" }), HttpStatusCode.NoContent, "post author loves reply");
    await Check(await second.PutAsJsonAsync(commentReactionPath, new { kind = "laugh" }), HttpStatusCode.NoContent, "another account laughs at reply");
    var reactedThread = await Check(await first.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.OK, "comment reaction counts and viewer selection");
    var reactedReply = reactedThread.GetProperty("comments").EnumerateArray().Single(c => c.GetProperty("id").GetGuid() == replyId);
    if (reactedReply.GetProperty("reactionCount").GetInt32() != 2 || reactedReply.GetProperty("myReaction").GetString() != "love" || reactedReply.GetProperty("postAuthorReaction").GetString() != "love" || reactedReply.GetProperty("reactionCounts").EnumerateArray().Single(c => c.GetProperty("kind").GetString() == "laugh").GetProperty("count").GetInt32() != 1) throw new Exception("Comment reaction summary incorrect");
    await Check(await first.PutAsJsonAsync(commentReactionPath, new { kind = "laugh" }), HttpStatusCode.NoContent, "switching comment reaction replaces previous kind");
    if (await db.CommentLikes.CountAsync(l => l.CommentId == replyId && l.UserId == ownerId) != 1 || !await db.CommentLikes.AnyAsync(l => l.CommentId == replyId && l.UserId == ownerId && l.Kind == "laugh")) throw new Exception("Comment reaction replacement duplicated rows");
    var concurrentCommentReactions = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => second.PutAsJsonAsync(commentReactionPath, new { kind = "love" })));
    if (concurrentCommentReactions.Any(r => r.StatusCode != HttpStatusCode.NoContent) || await db.CommentLikes.CountAsync(l => l.CommentId == replyId) != 2) throw new Exception("Concurrent comment reactions failed");
    foreach (var response in concurrentCommentReactions) response.Dispose();
    await Check(await first.DeleteAsync(commentReactionPath), HttpStatusCode.NoContent, "selected comment reaction can be removed");
    await Check(await second.DeleteAsync(commentReactionPath), HttpStatusCode.NoContent, "remove other account comment reaction");
    if (await db.CommentLikes.AnyAsync(l => l.CommentId == replyId)) throw new Exception("Removing comment reactions left rows");
    await Check(await second.DeleteAsync($"/api/posts/{postId}/comments/{parentId}"), HttpStatusCode.NoContent, "remove parent without deleting replies");
    if (!await db.Comments.AnyAsync(c => c.Id == replyId && c.ParentCommentId == null && c.IsReply) || !await db.Comments.AnyAsync(c => c.Id == nested.GetProperty("id").GetGuid())) throw new Exception("Parent deletion damaged replies");

    // Reports are unique per account and moderation checks current database permissions.
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsAdmin, false));
    await Check(await anonymous.PostAsJsonAsync($"/api/posts/{postId}/reports", new { reason = "spam" }), HttpStatusCode.Unauthorized, "report requires sign-in");
    await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/reports", new { reason = "invalid" }), HttpStatusCode.BadRequest, "report category validated");
    await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/reports", new { reason = "spam", details = "Test report" }), HttpStatusCode.OK, "account can report");
    await Check(await second.PostAsJsonAsync($"/api/posts/{postId}/reports", new { reason = "other" }), HttpStatusCode.Conflict, "duplicate report does not count");
    await Check(await anonymous.GetAsync($"/api/posts/{postId}"), HttpStatusCode.NotFound, "first report hides public post link");
    await Check(await second.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.NotFound, "reported activity hidden from other accounts");
    await Check(await anonymous.GetAsync($"/api/photos/{id}"), HttpStatusCode.NotFound, "first report hides direct image");
    using var pendingImage = await first.GetAsync($"/api/photos/{id}");
    if (pendingImage.StatusCode != HttpStatusCode.OK || !(await pendingImage.Content.ReadAsByteArrayAsync()).SequenceEqual(cleanPng)) throw new Exception("Author cannot view reported image");
    Console.WriteLine("PASS author can view reported image"); passed++;
    var pendingPost = await Check(await first.GetAsync($"/api/posts/{postId}"), HttpStatusCode.OK, "author can open reported post");
    if (!pendingPost[0].GetProperty("isUnderReview").GetBoolean()) throw new Exception("Missing pending review status");
    var pendingMine = await Check(await first.GetAsync("/api/photos?feed=mine"), HttpStatusCode.OK, "reported post stays in My photos");
    if (!pendingMine.EnumerateArray().Any(p => p.GetProperty("postId").GetGuid() == postId && p.GetProperty("isUnderReview").GetBoolean())) throw new Exception("Reported post missing from author's uploads");
    foreach (var client in new[] { anonymous, first, second }) {
        var publicFeed = await Check(await client.GetAsync("/api/photos"), HttpStatusCode.OK, "reported post absent from latest feed for all viewers");
        if (publicFeed.EnumerateArray().Any(p => p.GetProperty("postId").GetGuid() == postId)) throw new Exception("Reported post leaked to public feed");
    }
    var pendingFavorites = await Check(await first.GetAsync("/api/photos?feed=interacted"), HttpStatusCode.OK, "reported post hidden from favorites");
    if (pendingFavorites.EnumerateArray().Any(p => p.GetProperty("postId").GetGuid() == postId)) throw new Exception("Reported post leaked to favorites");
    await Check(await second.GetAsync("/api/moderation/reports"), HttpStatusCode.Forbidden, "reports private to moderators");
    await Check(await anonymous.GetAsync("/api/moderation/reports"), HttpStatusCode.Unauthorized, "guest moderation denied");
    await Check(await third.PostAsJsonAsync($"/api/moderation/posts/{otherPost}/remove", new { reason = "Test" }), HttpStatusCode.Forbidden, "ordinary owner cannot force moderation removal");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsModerator, true));
    await Check(await third.GetAsync("/api/moderation/reports"), HttpStatusCode.OK, "moderator queue accessible immediately");
    await Check(await third.PostAsJsonAsync($"/api/moderation/posts/{otherPost}/remove", new { reason = "Test moderation removal" }), HttpStatusCode.NoContent, "moderator forcefully removes post");
    await Check(await anonymous.GetAsync($"/api/posts/{otherPost}"), HttpStatusCode.NotFound, "moderator removal blocks public post");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsModerator, false));
    await Check(await third.GetAsync("/api/moderation/reports"), HttpStatusCode.Forbidden, "moderator revocation immediate");
    for (var i = 3; i < names.Length; i++) db.Users.Add(new Backend.Models.AppUser { Id = Guid.NewGuid(), Username = names[i], NormalizedUsername = names[i].ToUpperInvariant(), PasswordHash = stored.PasswordHash });
    await db.SaveChangesAsync();
    for (var i = 3; i < names.Length; i++) {
        using var reporter = Client();
        await Check(await reporter.PostAsJsonAsync("/api/auth/login", new { username = names[i], password }), HttpStatusCode.OK, "reporter login");
        if (i == names.Length - 1) {
            await Check(await anonymous.GetAsync($"/api/posts/{postId}"), HttpStatusCode.NotFound, "reported post stays hidden before moderator decision");
            var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => reporter.PostAsJsonAsync($"/api/posts/{postId}/reports", new { reason = "spam" })));
            if (responses.Count(r => r.StatusCode == HttpStatusCode.OK) != 1 || responses.Count(r => r.StatusCode == HttpStatusCode.Conflict) != 1) throw new Exception("Concurrent report uniqueness failed");
            foreach (var response in responses) response.Dispose();
        } else await Check(await reporter.PostAsJsonAsync($"/api/posts/{postId}/reports", new { reason = "spam" }), HttpStatusCode.OK, "distinct report counted");
    }
    if (await db.Reports.CountAsync(r => r.PostId == postId) != 11 || !await db.Posts.IgnoreQueryFilters().AnyAsync(p => p.Id == postId && p.RemovedAt == null && p.RemovedById == null)) throw new Exception("Reports must await a moderator, without automatic removal");
    await Check(await first.GetAsync($"/api/posts/{postId}"), HttpStatusCode.OK, "11 reports still preserves author access pending review");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsModerator, true));
    await Check(await third.PostAsJsonAsync($"/api/moderation/posts/{postId}/remove", new { reason = "Reviewed reports and removed post" }), HttpStatusCode.NoContent, "moderator removes reported post");
    await Check(await first.GetAsync($"/api/posts/{postId}"), HttpStatusCode.NotFound, "moderator removal blocks author post link");
    await Check(await first.GetAsync($"/api/photos/{id}"), HttpStatusCode.NotFound, "moderator removal blocks author image");
    var removedMine = await Check(await first.GetAsync("/api/photos?feed=mine"), HttpStatusCode.OK, "My photos after moderator removal");
    if (removedMine.EnumerateArray().Any(p => p.GetProperty("postId").GetGuid() == postId)) throw new Exception("Moderator-removed post remains in My photos");
    await Check(await anonymous.GetAsync($"/api/posts/{postId}"), HttpStatusCode.NotFound, "moderator removal hides shared post");
    await Check(await anonymous.GetAsync($"/api/photos/{id}"), HttpStatusCode.NotFound, "takedown blocks direct image URL");
    await Check(await anonymous.GetAsync($"/api/posts/{postId}/activity"), HttpStatusCode.NotFound, "takedown blocks comments and reactions");
    await Check(await first.PutAsJsonAsync($"/api/posts/{postId}/reaction", new { kind = "like" }), HttpStatusCode.NotFound, "cannot react to removed post");
    var afterRemoval = await Check(await anonymous.GetAsync("/api/photos"), HttpStatusCode.OK, "feed after takedown");
    if (afterRemoval.EnumerateArray().Any(p => p.GetProperty("postId").GetGuid() == postId)) throw new Exception("Removed post leaked to feed");
    await db.Users.Where(u => u.Id == thirdId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsModerator, true));
    using var reviewedPhoto = await third.GetAsync($"/api/moderation/photos/{id}");
    if (reviewedPhoto.StatusCode != HttpStatusCode.OK || !(await reviewedPhoto.Content.ReadAsByteArrayAsync()).SequenceEqual(cleanPng)) throw new Exception("Moderator cannot review removed photo");
    Console.WriteLine("PASS moderator can review removed photo"); passed++;
    await Check(await anonymous.GetAsync($"/api/moderation/photos/{id}"), HttpStatusCode.Unauthorized, "removed photo review private");
    await Check(await anonymous.GetAsync("/api/notifications"), HttpStatusCode.Unauthorized, "notifications require login");
    var inbox = await Check(await first.GetAsync("/api/notifications"), HttpStatusCode.OK, "owner receives notification inbox");
    if (inbox.GetProperty("unreadCount").GetInt32() == 0 || !inbox.GetProperty("items").EnumerateArray().Any(n => n.GetProperty("kind").GetString() == "report") || !inbox.GetProperty("items").EnumerateArray().Any(n => n.GetProperty("kind").GetString() == "removed")) throw new Exception("Report/takedown notifications missing");
    var notificationId = inbox.GetProperty("items")[0].GetProperty("id").GetGuid();
    await Check(await second.PutAsync($"/api/notifications/{notificationId}/read", null), HttpStatusCode.NotFound, "cannot mark another user's notification read");
    await Check(await first.PutAsync($"/api/notifications/{notificationId}/read", null), HttpStatusCode.NoContent, "mark own notification read");
    if (!await db.Notifications.AnyAsync(n => n.Id == notificationId && n.ReadAt != null)) throw new Exception("Read state not persisted");

    var commenterId = await db.Users.Where(u => u.Username == names[1]).Select(u => u.Id).SingleAsync();
    if (await db.Notifications.CountAsync(n => n.EventKey == $"reaction:{postId}:{commenterId}") != 1) throw new Exception("Concurrent reactions duplicated notification");
    if (!await db.Notifications.AnyAsync(n => n.UserId == commenterId && n.Kind == "best-quote") || !await db.Notifications.AnyAsync(n => n.UserId == commenterId && n.Kind == "comment-like") || !await db.Notifications.AnyAsync(n => n.UserId == commenterId && n.Kind == "reply")) throw new Exception("Commenter notifications missing");
    var ownReports = await Check(await first.GetAsync($"/api/account/reports?postId={postId}"), HttpStatusCode.OK, "owner can inspect reports after takedown");
    if (ownReports.GetArrayLength() != 1 || ownReports[0].GetProperty("reportCount").GetInt32() != 11 || ownReports.ToString().Contains("Test report")) throw new Exception("Owner report summary wrong or private details leaked");
    var othersReports = await Check(await second.GetAsync($"/api/account/reports?postId={postId}"), HttpStatusCode.OK, "other user cannot inspect owner report summary");
    if (othersReports.GetArrayLength() != 0) throw new Exception("Private owner reports leaked");
    await Check(await second.PostAsJsonAsync($"/api/account/reports/{postId}/dispute", new { explanation = "Not my post" }), HttpStatusCode.NotFound, "only owner can dispute");
    var dispute = await Check(await first.PostAsJsonAsync($"/api/account/reports/{postId}/dispute", new { explanation = "Please reconsider the reports" }), HttpStatusCode.OK, "owner disputes removed post");
    var disputeId = dispute.GetProperty("id").GetGuid();
    await Check(await first.PostAsJsonAsync($"/api/account/reports/{postId}/dispute", new { explanation = "Duplicate" }), HttpStatusCode.Conflict, "duplicate pending dispute rejected");
    await Check(await second.PostAsJsonAsync($"/api/moderation/disputes/{disputeId}/decision", new { accept = true, reason = "Try bypass" }), HttpStatusCode.Forbidden, "ordinary user cannot decide dispute");
    var modQueue = await Check(await third.GetAsync("/api/moderation/reports"), HttpStatusCode.OK, "moderator sees pending disputes");
    if (!modQueue.EnumerateArray().Any(p => p.GetProperty("disputes").EnumerateArray().Any(d => d.GetProperty("id").GetGuid() == disputeId))) throw new Exception("Dispute absent from moderation queue");
    await Check(await third.PostAsJsonAsync($"/api/moderation/disputes/{disputeId}/decision", new { accept = true, reason = "Reviewed and found no violation" }), HttpStatusCode.NoContent, "moderator accepts dispute");
    await Check(await anonymous.GetAsync($"/api/posts/{postId}"), HttpStatusCode.OK, "accepted dispute restores public post");
    if (await db.Reports.AnyAsync(r => r.PostId == postId && r.DismissedAt == null)) throw new Exception("Accepted dispute left active reports");
    await Check(await third.PostAsJsonAsync($"/api/moderation/disputes/{disputeId}/decision", new { accept = false, reason = "Overwrite decision" }), HttpStatusCode.Conflict, "review decision cannot be overwritten");
    await Check(await first.PostAsJsonAsync($"/api/posts/{postId}/reports", new { reason = "other" }), HttpStatusCode.OK, "new report after restoration");
    await Check(await anonymous.GetAsync($"/api/posts/{postId}"), HttpStatusCode.NotFound, "new active report hides restored post again");
    var newDispute = await Check(await first.PostAsJsonAsync($"/api/account/reports/{postId}/dispute", new { explanation = "New report to review" }), HttpStatusCode.OK, "new reports allow new dispute");
    await Check(await third.PostAsJsonAsync($"/api/moderation/disputes/{newDispute.GetProperty("id").GetGuid()}/decision", new { accept = false, reason = "Report remains valid" }), HttpStatusCode.NoContent, "moderator rejects dispute with explanation");
    await Check(await first.PostAsJsonAsync($"/api/account/reports/{postId}/dispute", new { explanation = "Repeat same rejected dispute" }), HttpStatusCode.Conflict, "same rejected reports cannot be appealed repeatedly");
    var selfDispute = await Check(await third.PostAsJsonAsync($"/api/account/reports/{otherPost}/dispute", new { explanation = "My removed post" }), HttpStatusCode.OK, "moderator can submit own dispute");
    await Check(await third.PostAsJsonAsync($"/api/moderation/disputes/{selfDispute.GetProperty("id").GetGuid()}/decision", new { accept = true, reason = "Approve myself" }), HttpStatusCode.Forbidden, "moderator cannot approve own dispute");
    if (await db.Notifications.CountAsync(n => n.UserId == ownerId && n.Kind == "dispute") != 2) throw new Exception("Dispute outcomes not notified");
    await Check(await first.PostAsync("/api/auth/logout", null), HttpStatusCode.NoContent, "logout");
    await Check(await first.GetAsync("/api/auth/me"), HttpStatusCode.Unauthorized, "logout clears session");
    await Check(await first.PostAsJsonAsync("/api/auth/login", new { username = names[0], password = "wrong" }), HttpStatusCode.Unauthorized, "wrong password rejected");
    await Check(await first.PostAsJsonAsync("/api/auth/login", new { username = names[0].ToUpperInvariant(), password }), HttpStatusCode.OK, "login with stored credentials");
    await Check(await first.PostAsJsonAsync("/api/auth/register", new { username = "rate_limit_check", password }), HttpStatusCode.TooManyRequests, "sixth registration attempt rate limited");
    var captchaConfig = await Check(await anonymous.GetAsync("/api/auth/captcha"), HttpStatusCode.OK, "public CAPTCHA configuration");
    if (captchaConfig.TryGetProperty("secretKey", out _)) throw new Exception("CAPTCHA secret exposed");
    for (var attempt = 0; attempt < 20; attempt++) { using var response = await first.PostAsJsonAsync("/api/auth/login", new { username = names[0], password = "wrong" }); }
    await Check(await first.PostAsJsonAsync("/api/auth/login", new { username = names[0], password }), HttpStatusCode.TooManyRequests, "login flooding rate limited");
    Console.WriteLine($"{passed} checks passed, plus CAPTCHA verifier checks.");
} finally {
    // Remove only the accounts and photos created by this run.
    var ids = await db.Users.Where(x => names.Contains(x.Username)).Select(x => x.Id).ToListAsync();
    await db.Users.Where(x => ids.Contains(x.Id)).ExecuteUpdateAsync(s => s.SetProperty(x => x.ProfilePhotoId, (Guid?)null));
    await db.Photos.IgnoreQueryFilters().Where(x => x.OwnerId != null && ids.Contains(x.OwnerId.Value)).ExecuteDeleteAsync();
    await db.Posts.IgnoreQueryFilters().Where(x => x.OwnerId != null && ids.Contains(x.OwnerId.Value)).ExecuteDeleteAsync();
    await db.Users.Where(x => ids.Contains(x.Id)).ExecuteDeleteAsync();
}


