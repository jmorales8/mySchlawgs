namespace Backend.Models;

public sealed class RemovedCommentReport
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public Guid? PhotoId { get; set; }
    public string AuthorUsername { get; set; } = "";
    public string ReporterUsername { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}
