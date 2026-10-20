namespace Backend.Models;

public sealed class AnimalCatalogEntry
{
    public required string Kind { get; set; }
    public required string AnimalType { get; set; }
    public required string NormalizedName { get; set; }
    public required string Name { get; set; }
}
