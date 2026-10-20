namespace Backend.Models;

public sealed class AnimalProfile
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public Guid? ProfilePhotoId { get; set; }
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? ProfilePhotoUrl => ProfilePhotoId is Guid id ? $"/api/photos/{id}" : null;
    public required string Name { get; set; }
    public required string AnimalType { get; set; }
    public required string Breed { get; set; }
    public int Age { get; set; }
    public required string AgeUnit { get; set; }
    public required string FunFact { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
