using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using SharpExifTool;

namespace Backend
{
    /// <summary>
    /// Captures the primary screen and writes GPS EXIF metadata into the
    /// saved image using SharpExifTool (no manual ExifTool install required —
    /// the binary is bundled with the NuGet package).
    /// </summary>
    public class ScreenshotService
    {
        private readonly string _screenshotsDir;

        public ScreenshotService(string screenshotsDir)
        {
            _screenshotsDir = screenshotsDir;
            EnsureDirectory(_screenshotsDir);
        }

        /// <summary>
        /// Captures the primary screen, saves it as JPEG, writes GPS EXIF tags,
        /// then returns the saved file path so the caller can pass it to
        /// GpxTrail.AddScreenshot().
        ///
        /// Returns null if the capture or EXIF write fails.
        /// </summary>
        public async Task<string?> CaptureAsync(double lat, double lon)
        {
            string? filePath = CaptureScreen();
            if (filePath == null) return null;

            await WriteGpsExifAsync(filePath, lat, lon);
            return filePath;
        }

        // ── Screen capture ─────────────────────────────────────────────────

        private string? CaptureScreen()
        {
            var screen = Screen.PrimaryScreen;
            if (screen == null)
            {
                Console.WriteLine("[Screenshot] Primary screen is null.");
                return null;
            }

            try
            {
                Rectangle bounds = screen.Bounds;
                using var bitmap = new Bitmap(bounds.Width, bounds.Height);
                using (var g = Graphics.FromImage(bitmap))
                    g.CopyFromScreen(Point.Empty, Point.Empty, bounds.Size);

                string fileName = $"screenshot_{DateTime.Now:yyyyMMdd_HHmmssfff}.jpg";
                string filePath = Path.Combine(_screenshotsDir, fileName);
                bitmap.Save(filePath, ImageFormat.Jpeg);

                Console.WriteLine($"[Screenshot] Saved → {filePath}");
                return filePath;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Screenshot] Capture failed: {ex.Message}");
                return null;
            }
        }

        // ── EXIF GPS tagging ───────────────────────────────────────────────

        /// <summary>
        /// Writes GPS coordinates into the image EXIF using SharpExifTool.
        /// SharpExifTool bundles exiftool.exe — no user install needed.
        ///
        /// Tags written:
        ///   GPSLatitude / GPSLatitudeRef
        ///   GPSLongitude / GPSLongitudeRef
        ///   GPSDateStamp / GPSTimeStamp
        ///   DateTimeOriginal
        /// </summary>
        private static async Task WriteGpsExifAsync(string filePath, double lat, double lon)
        {
            try
            {
                var now    = DateTime.UtcNow;
                string latRef = lat >= 0 ? "N" : "S";
                string lonRef = lon >= 0 ? "E" : "W";

                // SharpExifTool expects decimal degrees as a string.
                // ExifTool internally converts to the DMS rational format.
                var tags = new Dictionary<string, string>
                {
                    ["GPSLatitude"]      = $"{Math.Abs(lat):F6}",
                    ["GPSLatitudeRef"]   = latRef,
                    ["GPSLongitude"]     = $"{Math.Abs(lon):F6}",
                    ["GPSLongitudeRef"]  = lonRef,
                    ["GPSDateStamp"]     = now.ToString("yyyy:MM:dd"),
                    ["GPSTimeStamp"]     = now.ToString("HH:mm:ss"),
                    ["DateTimeOriginal"] = now.ToString("yyyy:MM:dd HH:mm:ss"),
                };

                // ExifTool instance is cheap to create — SharpExifTool manages
                // the underlying process lifecycle automatically.
                using var exiftool = new ExifTool();
                await exiftool.WriteTagsAsync(
                    filename: filePath,
                    properties: tags,
                    overwriteOriginal: true);   // no _original backup file

                Console.WriteLine($"[EXIF] GPS tagged: ({lat:F6}, {lon:F6}) → " +
                                  $"{Path.GetFileName(filePath)}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EXIF] Failed to write GPS tags: {ex.Message}");
                // Non-fatal — screenshot is still saved without GPS tags
            }
        }

        // ── Helpers ────────────────────────────────────────────────────────

        private static void EnsureDirectory(string path)
        {
            try
            {
                Directory.CreateDirectory(path);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Screenshot] Could not create directory {path}: {ex.Message}");
            }
        }

        /// <summary>
        /// Resolves the screenshots directory with the same fallback logic
        /// used elsewhere in VigemController (AppBase → LocalAppData).
        /// Call this statically to get the correct path before constructing
        /// the service.
        /// </summary>
        public static string ResolveDirectory()
        {
            string primary = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory, "screenshots");
            try
            {
                Directory.CreateDirectory(primary);
                // Test write access
                string test = Path.Combine(primary, ".writetest");
                File.WriteAllText(test, "");
                File.Delete(test);
                return primary;
            }
            catch
            {
                string fallback = Path.Combine(
                    Environment.GetFolderPath(
                        Environment.SpecialFolder.LocalApplicationData),
                    "PCServer", "screenshots");
                Directory.CreateDirectory(fallback);
                Console.WriteLine($"[Screenshot] Using fallback directory: {fallback}");
                return fallback;
            }
        }
    }
}