namespace Backend.Models;

public sealed class Photo
{
    public Guid Id { get; set; }
    public Guid? PostId { get; set; }
    public Guid? BestQuoteCommentId { get; set; }
    public Guid? BatchId { get; set; }
    public int BatchPosition { get; set; }
    public Guid? OwnerId { get; set; }
    public AppUser? Owner { get; set; }
    public string Description { get; set; } = "";
    public bool IsProfilePhoto { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long Size { get; set; }
    public required byte[] Data { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}
