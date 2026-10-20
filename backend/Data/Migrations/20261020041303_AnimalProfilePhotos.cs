using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AnimalProfilePhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProfilePhotoId",
                table: "animal_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_animal_profiles_ProfilePhotoId",
                table: "animal_profiles",
                column: "ProfilePhotoId");

            migrationBuilder.AddForeignKey(
                name: "FK_animal_profiles_photos_ProfilePhotoId",
                table: "animal_profiles",
                column: "ProfilePhotoId",
                principalTable: "photos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_animal_profiles_photos_ProfilePhotoId",
                table: "animal_profiles");

            migrationBuilder.DropIndex(
                name: "IX_animal_profiles_ProfilePhotoId",
                table: "animal_profiles");

            migrationBuilder.DropColumn(
                name: "ProfilePhotoId",
                table: "animal_profiles");
        }
    }
}
