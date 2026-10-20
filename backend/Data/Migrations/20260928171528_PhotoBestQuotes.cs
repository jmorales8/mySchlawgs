using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class PhotoBestQuotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PhotoId",
                table: "post_comments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BestQuoteCommentId",
                table: "photos",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_post_comments_PhotoId",
                table: "post_comments",
                column: "PhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_photos_BestQuoteCommentId",
                table: "photos",
                column: "BestQuoteCommentId");

            migrationBuilder.AddForeignKey(
                name: "FK_photos_post_comments_BestQuoteCommentId",
                table: "photos",
                column: "BestQuoteCommentId",
                principalTable: "post_comments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_post_comments_photos_PhotoId",
                table: "post_comments",
                column: "PhotoId",
                principalTable: "photos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_photos_post_comments_BestQuoteCommentId",
                table: "photos");

            migrationBuilder.DropForeignKey(
                name: "FK_post_comments_photos_PhotoId",
                table: "post_comments");

            migrationBuilder.DropIndex(
                name: "IX_post_comments_PhotoId",
                table: "post_comments");

            migrationBuilder.DropIndex(
                name: "IX_photos_BestQuoteCommentId",
                table: "photos");

            migrationBuilder.DropColumn(
                name: "PhotoId",
                table: "post_comments");

            migrationBuilder.DropColumn(
                name: "BestQuoteCommentId",
                table: "photos");
        }
    }
}
