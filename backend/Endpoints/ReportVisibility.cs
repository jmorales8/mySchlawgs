using Backend.Data;
using Backend.Models;

namespace Backend.Endpoints;

internal static class ReportVisibility
{
    public const int Threshold = 3;

    public static IQueryable<Guid> HiddenPosts(AppDbContext db, Guid? viewer) =>
        db.Posts.Where(p => p.HiddenByReports || (viewer != null &&
            db.Reports.Any(r => r.PostId == p.Id && r.ReporterId == viewer))).Select(p => p.Id);

    public static IQueryable<PostComment> VisibleComments(AppDbContext db, Guid? viewer) =>
        db.Comments.Where(c => !c.HiddenByReports && (viewer == null ||
            !db.CommentReports.Any(r => r.CommentId == c.Id && r.ReporterId == viewer)));
}
