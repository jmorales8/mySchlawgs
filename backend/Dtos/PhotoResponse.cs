using Backend.Models;

namespace Backend.Dtos;

public sealed record PhotoResponse(
    Guid Id,
    string FileName,
    string ContentType,
    long Size,
    DateTimeOffset UploadedAt,
    string DownloadUrl,
    string Description,
    Guid? OwnerId,
    string? Username,
    string? ProfilePhotoUrl,
    Guid? BatchId,
    int BatchPosition,
    Guid? PostId,
    bool IsUnderReview = false)
{
    public static PhotoResponse FromPhoto(Photo photo) => new(
        photo.Id,
        photo.FileName,
        photo.ContentType,
        photo.Size,
        photo.UploadedAt,
        $"/api/photos/{photo.Id}", photo.Description, photo.OwnerId, photo.Owner?.Username,
        photo.Owner?.ProfilePhotoId is Guid id ? $"/api/photos/{id}" : null, photo.BatchId, photo.BatchPosition, photo.PostId);
}
