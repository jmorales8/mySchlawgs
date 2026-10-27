using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class CommentReactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "comment_likes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "like");

            migrationBuilder.AddCheckConstraint(
                name: "CK_comment_reaction_kind",
                table: "comment_likes",
                sql: "\"Kind\" IN ('like', 'love', 'laugh')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_comment_reaction_kind",
                table: "comment_likes");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "comment_likes");
        }
    }
}
