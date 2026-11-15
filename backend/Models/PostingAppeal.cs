namespace Backend.Models;

public sealed class PostingAppeal
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset RestrictionStartedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public required string Explanation { get; set; }
    public bool? Accepted { get; set; }
    public string? DecisionReason { get; set; }
}
