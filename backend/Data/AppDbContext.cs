using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AnimalProfile> AnimalProfiles => Set<AnimalProfile>();
    public DbSet<AnimalCatalogEntry> AnimalCatalog => Set<AnimalCatalogEntry>();
    public DbSet<Photo> Photos => Set<Photo>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<PostReaction> Reactions => Set<PostReaction>();
    public DbSet<PostComment> Comments => Set<PostComment>();
    public DbSet<PostReport> Reports => Set<PostReport>();
    public DbSet<CommentLike> CommentLikes => Set<CommentLike>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<PostDispute> Disputes => Set<PostDispute>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var catalog = modelBuilder.Entity<AnimalCatalogEntry>();
        catalog.ToTable("animal_catalog");
        catalog.HasKey(x => new { x.Kind, x.AnimalType, x.NormalizedName });
        catalog.Property(x => x.Kind).HasMaxLength(10);
        catalog.Property(x => x.AnimalType).HasMaxLength(60);
        catalog.Property(x => x.NormalizedName).HasMaxLength(100);
        catalog.Property(x => x.Name).HasMaxLength(100);
        catalog.HasData(new[] { "Dog", "Cat", "Rabbit", "Bird", "Fish", "Hamster", "Guinea pig", "Gerbil", "Mouse", "Rat", "Ferret", "Chinchilla", "Hedgehog", "Turtle", "Tortoise", "Lizard", "Snake", "Frog", "Horse", "Pony", "Goat", "Chicken", "Duck" }
            .Select(name => new AnimalCatalogEntry { Kind = "type", AnimalType = "", NormalizedName = name.ToUpperInvariant(), Name = name }));
        catalog.HasData(new[] {
            ("Dog", "Labrador retriever"), ("Dog", "Golden retriever"), ("Dog", "German shepherd"), ("Dog", "French bulldog"), ("Dog", "Poodle"), ("Dog", "Beagle"), ("Dog", "Chihuahua"), ("Dog", "Dachshund"), ("Dog", "Border collie"), ("Dog", "Australian shepherd"), ("Dog", "Siberian husky"), ("Dog", "Mixed breed"),
            ("Cat", "Domestic shorthair"), ("Cat", "Domestic longhair"), ("Cat", "Siamese"), ("Cat", "Maine coon"), ("Cat", "Ragdoll"), ("Cat", "Persian"), ("Cat", "Bengal"), ("Cat", "Mixed breed"),
            ("Rabbit", "Holland lop"), ("Rabbit", "Netherland dwarf"), ("Rabbit", "Lionhead"), ("Bird", "Budgerigar"), ("Bird", "Cockatiel"), ("Bird", "Lovebird"), ("Fish", "Goldfish"), ("Fish", "Betta"), ("Fish", "Guppy")
        }.Select(entry => new AnimalCatalogEntry { Kind = "breed", AnimalType = entry.Item1.ToUpperInvariant(), NormalizedName = entry.Item2.ToUpperInvariant(), Name = entry.Item2 }));
        var animal = modelBuilder.Entity<AnimalProfile>();
        animal.ToTable("animal_profiles");
        animal.HasKey(x => x.Id);
        animal.HasOne<Photo>().WithMany().HasForeignKey(x => x.ProfilePhotoId).OnDelete(DeleteBehavior.SetNull);
        animal.HasIndex(x => x.OwnerId);
        animal.Property(x => x.Name).HasMaxLength(60);
        animal.Property(x => x.AnimalType).HasMaxLength(60);
        animal.Property(x => x.Breed).HasMaxLength(100);
        animal.Property(x => x.AgeUnit).HasMaxLength(10);
        animal.Property(x => x.FunFact).HasMaxLength(1000);
        animal.HasOne<AppUser>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        var notification = modelBuilder.Entity<Notification>();
        notification.ToTable("notifications");
        notification.HasKey(x => x.Id);
        notification.HasIndex(x => new { x.UserId, x.EventKey }).IsUnique();
        notification.HasIndex(x => new { x.UserId, x.CreatedAt });
        notification.Property(x => x.EventKey).HasMaxLength(180);
        notification.Property(x => x.Kind).HasMaxLength(30);
        notification.Property(x => x.Message).HasMaxLength(1200);
        notification.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        notification.HasOne<Post>().WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        var dispute = modelBuilder.Entity<PostDispute>();
        dispute.ToTable("post_disputes");
        dispute.HasKey(x => x.Id);
        dispute.HasIndex(x => new { x.PostId, x.Version }).IsUnique();
        dispute.HasIndex(x => x.PostId).IsUnique().HasFilter("\"Status\" = 'pending'");
        dispute.Property(x => x.Explanation).HasMaxLength(2000);
        dispute.Property(x => x.DecisionReason).HasMaxLength(1000);
        dispute.Property(x => x.Status).HasMaxLength(20);
        dispute.HasOne<Post>().WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        dispute.HasOne<AppUser>().WithMany().HasForeignKey(x => x.ReviewedById).OnDelete(DeleteBehavior.SetNull);
        var post = modelBuilder.Entity<Post>();
        post.ToTable("posts");
        post.HasKey(x => x.Id);
        post.HasQueryFilter(x => x.RemovedAt == null);
        post.Property(x => x.RemovalReason).HasMaxLength(1000);
        post.HasOne<AppUser>().WithMany().HasForeignKey(x => x.RemovedById).OnDelete(DeleteBehavior.SetNull);
        var report = modelBuilder.Entity<PostReport>();
        report.ToTable("post_reports");
        report.HasKey(x => new { x.PostId, x.ReporterId });
        report.Property(x => x.Reason).HasMaxLength(40);
        report.Property(x => x.Details).HasMaxLength(1000);
        report.HasOne<Post>().WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        report.HasOne<AppUser>().WithMany().HasForeignKey(x => x.ReporterId).OnDelete(DeleteBehavior.Cascade);
        post.HasOne<AppUser>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        var reaction = modelBuilder.Entity<PostReaction>();
        reaction.ToTable("post_reactions", table => table.HasCheckConstraint("CK_reaction_kind", "\"Kind\" IN ('like', 'love', 'laugh')"));
        reaction.HasKey(x => new { x.PostId, x.UserId });
        reaction.Property(x => x.Kind).HasMaxLength(10);
        reaction.HasOne<Post>().WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        reaction.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        var comment = modelBuilder.Entity<PostComment>();
        comment.ToTable("post_comments");
        comment.HasKey(x => x.Id);
        comment.HasOne<PostComment>().WithMany().HasForeignKey(x => x.ParentCommentId).OnDelete(DeleteBehavior.SetNull);
        var like = modelBuilder.Entity<CommentLike>();
        like.ToTable("comment_likes");
        like.HasKey(x => new { x.CommentId, x.UserId });
        like.HasOne<PostComment>().WithMany().HasForeignKey(x => x.CommentId).OnDelete(DeleteBehavior.Cascade);
        like.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        comment.HasOne(x => x.Photo).WithMany().HasForeignKey(x => x.PhotoId).OnDelete(DeleteBehavior.SetNull);
        comment.Property(x => x.Body).HasMaxLength(2000);
        comment.HasIndex(x => new { x.PostId, x.CreatedAt });
        comment.HasOne<Post>().WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        comment.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Cascade);
        var user = modelBuilder.Entity<AppUser>();
        user.ToTable("users");
        user.HasKey(x => x.Id);
        user.Property(x => x.Username).HasMaxLength(30);
        user.Property(x => x.NormalizedUsername).HasMaxLength(30);
        user.HasIndex(x => x.NormalizedUsername).IsUnique();
        user.HasOne<Photo>().WithMany().HasForeignKey(x => x.ProfilePhotoId).OnDelete(DeleteBehavior.SetNull);
        var photo = modelBuilder.Entity<Photo>();
        photo.ToTable("photos");
        photo.HasKey(x => x.Id);
        photo.HasQueryFilter(x => x.PostId == null || Posts.Any(p => p.Id == x.PostId));
        photo.HasOne<PostComment>().WithMany().HasForeignKey(x => x.BestQuoteCommentId).OnDelete(DeleteBehavior.SetNull);
        photo.HasOne<Post>().WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        photo.Property(x => x.Description).HasMaxLength(2000);
        photo.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        photo.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        photo.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        photo.Property(x => x.Data).HasColumnType("bytea").IsRequired();
    }
}
