namespace Backend.Models;

public enum BugReportStatus { Open, InProgress, Resolved }

public sealed class BugReport
{
    public Guid Id { get; set; }
    public Guid? ReporterId { get; set; }
    public AppUser? Reporter { get; set; }
    public required string Title { get; set; }
    public required string Encounter { get; set; }
    public required string Steps { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public BugReportStatus Status { get; set; }
}
