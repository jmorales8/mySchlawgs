namespace Backend.Models;

public sealed class PhotoAnimalProfile
{
    public Guid PhotoId { get; set; }
    public Photo Photo { get; set; } = null!;
    public Guid AnimalProfileId { get; set; }
}
