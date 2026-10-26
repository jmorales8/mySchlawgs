using ImageMagick;

namespace Backend.Security;

public static class ImageSanitizer
{
    private const ulong MaxPixels = 50_000_000;
    private const int MaxOutputBytes = 10 * 1024 * 1024;
    private static readonly SemaphoreSlim Gate = new(1, 1);

    static ImageSanitizer()
    {
        // Bound native decoding and disallow spilling users' original pixels to disk.
        ResourceLimits.Memory = 512 * 1024 * 1024;
        ResourceLimits.Disk = 0;
        ResourceLimits.Width = 16384;
        ResourceLimits.Height = 16384;
        ResourceLimits.ListLength = 200;
        ResourceLimits.Thread = 2;
    }

    public static async Task<byte[]> SanitizeAsync(byte[] input, string contentType, CancellationToken ct = default)
    {
        var format = contentType.ToLowerInvariant() switch {
            "image/jpeg" => MagickFormat.Jpeg,
            "image/png" => MagickFormat.Png,
            "image/gif" => MagickFormat.Gif,
            "image/webp" => MagickFormat.WebP,
            _ => throw new InvalidDataException("Choose a JPEG, PNG, GIF, or WebP image.")
        };

        await Gate.WaitAsync(ct);
        try {
            // Force the expected decoder instead of allowing arbitrary ImageMagick formats.
            var settings = new MagickReadSettings { Format = format };
            using (var info = new MagickImageCollection()) {
                info.Ping(input, settings);
                ulong pixels = 0;
                foreach (var frame in info) pixels += (ulong)frame.Width * frame.Height;
                if (info.Count == 0 || pixels > MaxPixels)
                    throw new InvalidDataException("Use an image with at most 50 million pixels across all animation frames.");
            }

            using var images = new MagickImageCollection();
            images.Read(input, settings);
            foreach (var frame in images) {
                ct.ThrowIfCancellationRequested();
                // Bake EXIF orientation into pixels before removing it.
                frame.AutoOrient();
                if (frame.GetColorProfile() != null) frame.TransformColorSpace(ColorProfiles.SRGB);
                frame.Strip();
                foreach (var name in frame.AttributeNames.ToArray()) frame.RemoveAttribute(name);
                if (format == MagickFormat.Png) frame.Settings.SetDefine(MagickFormat.Png, "exclude-chunks", "all");
                if (format == MagickFormat.Jpeg) frame.Quality = 90;
            }
            // Re-encoding discards original trailing data as well as metadata profiles.
            var output = images.ToByteArray(format);
            if (output.Length > MaxOutputBytes)
                throw new InvalidDataException("The cleaned image exceeds 10 MB. Try a smaller image.");
            return output;
        }
        catch (MagickException) {
            throw new InvalidDataException("This image could not be safely processed. Choose a valid image up to 16,384 pixels per side and 200 animation frames.");
        }
        finally { Gate.Release(); }
    }
}
