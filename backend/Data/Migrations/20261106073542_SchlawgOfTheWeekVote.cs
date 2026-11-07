using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class SchlawgOfTheWeekVote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "VotingForAnimalId",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_VotingForAnimalId",
                table: "users",
                column: "VotingForAnimalId");

            migrationBuilder.AddForeignKey(
                name: "FK_users_animal_profiles_VotingForAnimalId",
                table: "users",
                column: "VotingForAnimalId",
                principalTable: "animal_profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_users_animal_profiles_VotingForAnimalId",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_VotingForAnimalId",
                table: "users");

            migrationBuilder.DropColumn(
                name: "VotingForAnimalId",
                table: "users");
        }
    }
}
