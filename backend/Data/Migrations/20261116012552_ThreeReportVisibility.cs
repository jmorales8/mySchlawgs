using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class ThreeReportVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HiddenByReports",
                table: "posts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "HiddenByReports",
                table: "post_comments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "comment_reports",
                columns: table => new
                {
                    CommentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DismissedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comment_reports", x => new { x.CommentId, x.ReporterId });
                    table.ForeignKey(
                        name: "FK_comment_reports_post_comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "post_comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_comment_reports_users_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_comment_reports_ReporterId",
                table: "comment_reports",
                column: "ReporterId");

            migrationBuilder.Sql("""
                UPDATE posts SET "HiddenByReports" = TRUE
                WHERE "Id" IN (
                    SELECT "PostId" FROM post_reports WHERE "DismissedAt" IS NULL
                    GROUP BY "PostId" HAVING COUNT(*) >= 3
                );
                UPDATE posting_appeals SET "Accepted" = TRUE,
                    "DecisionReason" = 'Automatic posting restrictions were lifted under the updated reporting rules.'
                WHERE "Accepted" IS NULL;
                UPDATE users SET "PostingRestrictedAt" = NULL, "PostingRestrictionStartedAt" = NULL
                WHERE "PostingRestrictedAt" IS NOT NULL OR "PostingRestrictionStartedAt" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comment_reports");

            migrationBuilder.DropColumn(
                name: "HiddenByReports",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "HiddenByReports",
                table: "post_comments");
        }
    }
}
