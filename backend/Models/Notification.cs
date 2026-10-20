namespace Backend.Models;

public sealed class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid PostId { get; set; }
    public required string EventKey { get; set; }
    public required string Kind { get; set; }
    public required string Message { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}

public sealed class PostDispute
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public int Version { get; set; }
    public required string Explanation { get; set; }
    public string Status { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? ReviewedById { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? DecisionReason { get; set; }
}
