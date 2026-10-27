namespace Backend.Models;

public sealed class Post
{
    public int ModerationVersion { get; set; }
    public DateTimeOffset? RemovedAt { get; set; }
    public Guid? RemovedById { get; set; }
    public string? RemovalReason { get; set; }
    public Guid Id { get; set; }
    public Guid? OwnerId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class PostReport
{
    public DateTimeOffset? DismissedAt { get; set; }
    public Guid PostId { get; set; }
    public Guid ReporterId { get; set; }
    public required string Reason { get; set; }
    public string Details { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class PostReaction
{
    public Guid PostId { get; set; }
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public required string Kind { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class PostComment
{
    public Guid? ParentCommentId { get; set; }
    public bool IsReply { get; set; }
    public Guid? PhotoId { get; set; }
    public Photo? Photo { get; set; }
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public Guid AuthorId { get; set; }
    public AppUser Author { get; set; } = null!;
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class CommentLike
{
    public Guid CommentId { get; set; }
    public Guid UserId { get; set; }
    public string Kind { get; set; } = "like";
}
