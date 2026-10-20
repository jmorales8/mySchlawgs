using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AnimalCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "animal_catalog",
                columns: table => new
                {
                    Kind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AnimalType = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_animal_catalog", x => new { x.Kind, x.AnimalType, x.NormalizedName });
                });

            migrationBuilder.InsertData(
                table: "animal_catalog",
                columns: new[] { "AnimalType", "Kind", "NormalizedName", "Name" },
                values: new object[,]
                {
                    { "BIRD", "breed", "BUDGERIGAR", "Budgerigar" },
                    { "BIRD", "breed", "COCKATIEL", "Cockatiel" },
                    { "BIRD", "breed", "LOVEBIRD", "Lovebird" },
                    { "CAT", "breed", "BENGAL", "Bengal" },
                    { "CAT", "breed", "DOMESTIC LONGHAIR", "Domestic longhair" },
                    { "CAT", "breed", "DOMESTIC SHORTHAIR", "Domestic shorthair" },
                    { "CAT", "breed", "MAINE COON", "Maine coon" },
                    { "CAT", "breed", "MIXED BREED", "Mixed breed" },
                    { "CAT", "breed", "PERSIAN", "Persian" },
                    { "CAT", "breed", "RAGDOLL", "Ragdoll" },
                    { "CAT", "breed", "SIAMESE", "Siamese" },
                    { "DOG", "breed", "AUSTRALIAN SHEPHERD", "Australian shepherd" },
                    { "DOG", "breed", "BEAGLE", "Beagle" },
                    { "DOG", "breed", "BORDER COLLIE", "Border collie" },
                    { "DOG", "breed", "CHIHUAHUA", "Chihuahua" },
                    { "DOG", "breed", "DACHSHUND", "Dachshund" },
                    { "DOG", "breed", "FRENCH BULLDOG", "French bulldog" },
                    { "DOG", "breed", "GERMAN SHEPHERD", "German shepherd" },
                    { "DOG", "breed", "GOLDEN RETRIEVER", "Golden retriever" },
                    { "DOG", "breed", "LABRADOR RETRIEVER", "Labrador retriever" },
                    { "DOG", "breed", "MIXED BREED", "Mixed breed" },
                    { "DOG", "breed", "POODLE", "Poodle" },
                    { "DOG", "breed", "SIBERIAN HUSKY", "Siberian husky" },
                    { "FISH", "breed", "BETTA", "Betta" },
                    { "FISH", "breed", "GOLDFISH", "Goldfish" },
                    { "FISH", "breed", "GUPPY", "Guppy" },
                    { "RABBIT", "breed", "HOLLAND LOP", "Holland lop" },
                    { "RABBIT", "breed", "LIONHEAD", "Lionhead" },
                    { "RABBIT", "breed", "NETHERLAND DWARF", "Netherland dwarf" },
                    { "", "type", "BIRD", "Bird" },
                    { "", "type", "CAT", "Cat" },
                    { "", "type", "CHICKEN", "Chicken" },
                    { "", "type", "CHINCHILLA", "Chinchilla" },
                    { "", "type", "DOG", "Dog" },
                    { "", "type", "DUCK", "Duck" },
                    { "", "type", "FERRET", "Ferret" },
                    { "", "type", "FISH", "Fish" },
                    { "", "type", "FROG", "Frog" },
                    { "", "type", "GERBIL", "Gerbil" },
                    { "", "type", "GOAT", "Goat" },
                    { "", "type", "GUINEA PIG", "Guinea pig" },
                    { "", "type", "HAMSTER", "Hamster" },
                    { "", "type", "HEDGEHOG", "Hedgehog" },
                    { "", "type", "HORSE", "Horse" },
                    { "", "type", "LIZARD", "Lizard" },
                    { "", "type", "MOUSE", "Mouse" },
                    { "", "type", "PONY", "Pony" },
                    { "", "type", "RABBIT", "Rabbit" },
                    { "", "type", "RAT", "Rat" },
                    { "", "type", "SNAKE", "Snake" },
                    { "", "type", "TORTOISE", "Tortoise" },
                    { "", "type", "TURTLE", "Turtle" }
                });
            // Existing profiles also contribute to the shared library.
            migrationBuilder.Sql("""
                INSERT INTO animal_catalog ("Kind", "AnimalType", "NormalizedName", "Name")
                SELECT DISTINCT 'type', '', upper(trim(regexp_replace("AnimalType", '\s+', ' ', 'g'))), trim(regexp_replace("AnimalType", '\s+', ' ', 'g'))
                FROM animal_profiles WHERE trim("AnimalType") <> ''
                ON CONFLICT DO NOTHING;
                INSERT INTO animal_catalog ("Kind", "AnimalType", "NormalizedName", "Name")
                SELECT DISTINCT 'breed', upper(trim(regexp_replace("AnimalType", '\s+', ' ', 'g'))), upper(trim(regexp_replace("Breed", '\s+', ' ', 'g'))), trim(regexp_replace("Breed", '\s+', ' ', 'g'))
                FROM animal_profiles WHERE trim("Breed") <> ''
                ON CONFLICT DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "animal_catalog");
        }
    }
}
