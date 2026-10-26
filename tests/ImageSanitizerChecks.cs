using System.Text;
using Backend.Security;
using ImageMagick;

internal static class ImageSanitizerChecks
{
    private const string PrivateText = "private-camera-owner-and-location";

    public static byte[] Fixture(MagickFormat format, bool animated = false)
    {
        using var images = new MagickImageCollection();
        for (var index = 0; index < (animated ? 2 : 1); index++) {
            var image = new MagickImage(index == 0 ? MagickColors.Red : MagickColors.Blue, 12, 8);
            image.AnimationDelay = 12;
            image.AnimationIterations = 3;
            image.Comment = PrivateText;
            if (format != MagickFormat.Gif) {
                var exif = new ExifProfile();
                exif.SetValue(ExifTag.Artist, PrivateText);
                exif.SetValue(ExifTag.DateTimeOriginal, "2026:10:26 12:34:56");
                exif.SetValue(ExifTag.Orientation, (ushort)6);
                exif.SetValue(ExifTag.GPSLatitudeRef, "N");
                exif.SetValue(ExifTag.GPSLatitude, new[] { new Rational(41u), new Rational(52u), new Rational(0u) });
                exif.SetValue(ExifTag.GPSLongitudeRef, "W");
                exif.SetValue(ExifTag.GPSLongitude, new[] { new Rational(87u), new Rational(38u), new Rational(0u) });
                image.SetProfile(exif);
                image.Orientation = Orientation.RightTop;
                image.SetProfile(new XmpProfile(Encoding.UTF8.GetBytes($"<x:xmpmeta xmlns:x='adobe:ns:meta/'><rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'><rdf:Description xmlns:dc='http://purl.org/dc/elements/1.1/' dc:creator='{PrivateText}' /></rdf:RDF></x:xmpmeta>")));
                var iptc = new IptcProfile();
                iptc.SetValue(IptcTag.Byline, PrivateText);
                image.SetProfile(iptc);
                image.SetProfile(ColorProfiles.SRGB);
            }
            images.Add(image);
        }
        return images.ToByteArray(format);
    }

    public static async Task Run()
    {
        foreach (var (format, contentType) in new[] {
            (MagickFormat.Jpeg, "image/jpeg"), (MagickFormat.Png, "image/png"),
            (MagickFormat.Gif, "image/gif"), (MagickFormat.WebP, "image/webp") }) {
            var original = Fixture(format);
            using (var before = new MagickImage(original)) {
                if (format != MagickFormat.Gif && before.GetExifProfile()?.GetValue(ExifTag.GPSLatitude) == null)
                    throw new Exception($"{format} test fixture must actually contain GPS data");
                if (format == MagickFormat.Gif && before.Comment != PrivateText)
                    throw new Exception("GIF test fixture must actually contain a comment");
            }
            var cleaned = await ImageSanitizer.SanitizeAsync(original.Concat(Encoding.UTF8.GetBytes(PrivateText)).ToArray(), contentType);
            using var after = new MagickImage(cleaned);
            if (after.ProfileNames.Any() || !string.IsNullOrEmpty(after.Comment)
                || Encoding.UTF8.GetString(cleaned).Contains(PrivateText)) throw new Exception($"{format} leaked metadata");
            if (format != MagickFormat.Gif && (after.Width != 8 || after.Height != 12)) throw new Exception($"{format} lost EXIF orientation");
            if (after.Format != format) throw new Exception($"{format} changed format");
            Console.WriteLine($"PASS {format}: GPS, author, timestamps, comments, and trailing data removed; orientation preserved");
        }
        foreach (var (format, contentType) in new[] { (MagickFormat.Gif, "image/gif"), (MagickFormat.WebP, "image/webp") }) {
            var cleaned = await ImageSanitizer.SanitizeAsync(Fixture(format, animated: true), contentType);
            using var frames = new MagickImageCollection(cleaned);
            if (frames.Count != 2 || frames[0].AnimationIterations != 3 || frames.Any(frame => frame.AnimationDelay != 12 || frame.ProfileNames.Any() || !string.IsNullOrEmpty(frame.Comment)))
                throw new Exception($"{format} animation or metadata stripping failed");
            Console.WriteLine($"PASS {format}: animation frames and timing preserved without metadata");
        }
        foreach (var (header, type) in new[] { (new byte[] { 0xff, 0xd8, 0xff }, "image/jpeg"), (new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }, "image/png") }) {
            try { await ImageSanitizer.SanitizeAsync(header, type); throw new Exception("Corrupt image was accepted"); }
            catch (InvalidDataException) { Console.WriteLine($"PASS corrupt {type} rejected rather than storing original bytes"); }
        }
    }
}
