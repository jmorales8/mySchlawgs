namespace Backend.Models;

public sealed class PosterFollow
{
    public Guid FollowerId { get; set; }
    public Guid PosterId { get; set; }
}
