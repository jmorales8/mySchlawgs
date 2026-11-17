using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class WeeklyPhotoPrompts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "prompt_ideas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedById = table.Column<Guid>(type: "uuid", nullable: true),
                    Text = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prompt_ideas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_prompt_ideas_users_SubmittedById",
                        column: x => x.SubmittedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "weekly_prompts",
                columns: table => new
                {
                    WeekOf = table.Column<DateOnly>(type: "date", nullable: false),
                    IdeaId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_weekly_prompts", x => x.WeekOf);
                    table.ForeignKey(
                        name: "FK_weekly_prompts_prompt_ideas_IdeaId",
                        column: x => x.IdeaId,
                        principalTable: "prompt_ideas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_prompt_ideas_CreatedAt_Id",
                table: "prompt_ideas",
                columns: new[] { "CreatedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_prompt_ideas_SubmittedById",
                table: "prompt_ideas",
                column: "SubmittedById");

            migrationBuilder.CreateIndex(
                name: "IX_weekly_prompts_IdeaId",
                table: "weekly_prompts",
                column: "IdeaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "weekly_prompts");

            migrationBuilder.DropTable(
                name: "prompt_ideas");
        }
    }
}
