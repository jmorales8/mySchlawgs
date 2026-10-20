using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class ModerationAndCommentThreads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsModerator",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RemovalReason",
                table: "posts",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RemovedAt",
                table: "posts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RemovedById",
                table: "posts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsReply",
                table: "post_comments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentCommentId",
                table: "post_comments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "comment_likes",
                columns: table => new
                {
                    CommentId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comment_likes", x => new { x.CommentId, x.UserId });
                    table.ForeignKey(
                        name: "FK_comment_likes_post_comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "post_comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_comment_likes_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "post_reports",
                columns: table => new
                {
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Details = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_post_reports", x => new { x.PostId, x.ReporterId });
                    table.ForeignKey(
                        name: "FK_post_reports_posts_PostId",
                        column: x => x.PostId,
                        principalTable: "posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_post_reports_users_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_posts_RemovedById",
                table: "posts",
                column: "RemovedById");

            migrationBuilder.CreateIndex(
                name: "IX_post_comments_ParentCommentId",
                table: "post_comments",
                column: "ParentCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_comment_likes_UserId",
                table: "comment_likes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_post_reports_ReporterId",
                table: "post_reports",
                column: "ReporterId");

            migrationBuilder.AddForeignKey(
                name: "FK_post_comments_post_comments_ParentCommentId",
                table: "post_comments",
                column: "ParentCommentId",
                principalTable: "post_comments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_posts_users_RemovedById",
                table: "posts",
                column: "RemovedById",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_post_comments_post_comments_ParentCommentId",
                table: "post_comments");

            migrationBuilder.DropForeignKey(
                name: "FK_posts_users_RemovedById",
                table: "posts");

            migrationBuilder.DropTable(
                name: "comment_likes");

            migrationBuilder.DropTable(
                name: "post_reports");

            migrationBuilder.DropIndex(
                name: "IX_posts_RemovedById",
                table: "posts");

            migrationBuilder.DropIndex(
                name: "IX_post_comments_ParentCommentId",
                table: "post_comments");

            migrationBuilder.DropColumn(
                name: "IsModerator",
                table: "users");

            migrationBuilder.DropColumn(
                name: "RemovalReason",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "RemovedAt",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "RemovedById",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "IsReply",
                table: "post_comments");

            migrationBuilder.DropColumn(
                name: "ParentCommentId",
                table: "post_comments");
        }
    }
}
