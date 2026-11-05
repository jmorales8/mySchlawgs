using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class MultipleAnimalsPerPhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "photo_animal_profiles",
                columns: table => new
                {
                    PhotoId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnimalProfileId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_photo_animal_profiles", x => new { x.PhotoId, x.AnimalProfileId });
                    table.ForeignKey(
                        name: "FK_photo_animal_profiles_animal_profiles_AnimalProfileId",
                        column: x => x.AnimalProfileId,
                        principalTable: "animal_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_photo_animal_profiles_photos_PhotoId",
                        column: x => x.PhotoId,
                        principalTable: "photos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_photo_animal_profiles_AnimalProfileId",
                table: "photo_animal_profiles",
                column: "AnimalProfileId");

            migrationBuilder.Sql("""
                INSERT INTO photo_animal_profiles ("PhotoId", "AnimalProfileId")
                SELECT "Id", "AnimalProfileId" FROM photos WHERE "AnimalProfileId" IS NOT NULL
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_photos_animal_profiles_AnimalProfileId",
                table: "photos");

            migrationBuilder.DropIndex(
                name: "IX_photos_AnimalProfileId",
                table: "photos");

            migrationBuilder.DropColumn(
                name: "AnimalProfileId",
                table: "photos");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AnimalProfileId",
                table: "photos",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE photos AS p SET "AnimalProfileId" = tag."AnimalProfileId"
                FROM (
                    SELECT DISTINCT ON ("PhotoId") "PhotoId", "AnimalProfileId"
                    FROM photo_animal_profiles ORDER BY "PhotoId", "AnimalProfileId"
                ) AS tag WHERE p."Id" = tag."PhotoId"
                """);

            migrationBuilder.DropTable(
                name: "photo_animal_profiles");

            migrationBuilder.CreateIndex(
                name: "IX_photos_AnimalProfileId",
                table: "photos",
                column: "AnimalProfileId");

            migrationBuilder.AddForeignKey(
                name: "FK_photos_animal_profiles_AnimalProfileId",
                table: "photos",
                column: "AnimalProfileId",
                principalTable: "animal_profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
