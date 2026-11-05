using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class PhotoAnimalProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AnimalProfileId",
                table: "photos",
                type: "uuid",
                nullable: true);

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
    }
}
