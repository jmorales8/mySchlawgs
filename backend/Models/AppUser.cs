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
    public Guid? VotingForAnimalId { get; set; }
    public string? Email { get; set; }
    public string? PendingEmail { get; set; }
    public string? EmailTokenHash { get; set; }
    public DateTimeOffset? EmailTokenExpiresAt { get; set; }
    public DateTimeOffset? EmailSentAt { get; set; }
    public string? PasswordResetHash { get; set; }
    public DateTimeOffset? PasswordResetExpiresAt { get; set; }
    public DateTimeOffset? PasswordResetSentAt { get; set; }
    public int SessionVersion { get; set; }
}
