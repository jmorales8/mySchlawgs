using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class PostingAppealsAndFollowedPosterDigest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FollowedPosterDigestEnabled",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PostingRestrictionStartedAt",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "posting_appeals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RestrictionStartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Explanation = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Accepted = table.Column<bool>(type: "boolean", nullable: true),
                    DecisionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_posting_appeals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_posting_appeals_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_posting_appeals_UserId_RestrictionStartedAt",
                table: "posting_appeals",
                columns: new[] { "UserId", "RestrictionStartedAt" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "posting_appeals");

            migrationBuilder.DropColumn(
                name: "FollowedPosterDigestEnabled",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PostingRestrictionStartedAt",
                table: "users");
        }
    }
}
