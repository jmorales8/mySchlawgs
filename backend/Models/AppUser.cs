namespace Backend.Models;

public sealed class AppUser
{
    public Guid Id { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsModerator { get; set; }
    public required string Username { get; set; }
    public required string NormalizedUsername { get; set; }
    public required string PasswordHash { get; set; }
    public Guid? ProfilePhotoId { get; set; }
}
