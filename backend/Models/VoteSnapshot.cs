namespace Backend.Models;

public sealed class VoteSnapshot
{
    public int Id { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public required string TotalsJson { get; set; }
}
