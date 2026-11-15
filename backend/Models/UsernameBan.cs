namespace Backend.Models;

public sealed class UsernameBan
{
    public required string NormalizedUsername { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
