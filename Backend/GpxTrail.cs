using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.Json;

namespace Backend
{
    public class GpxTrail
    {
        // ── Configurable origin ────────────────────────────────────────────
        public double BaseLat { get; set; } = 3.2206334;
        public double BaseLon { get; set; } = 101.9676587;

        public double MetresPerDegree { get; set; } = 111_000.0;

        // ── Motion parameters ──────────────────────────────────────────────
        public double MaxCadence { get; set; } = 180.0;
        public double MinCadence { get; set; } = 60.0;

        // ── Python-algorithm parameters ────────────────────────────────────
        public double Scale { get; set; } = 0.0001;
        public double AngleVariability { get; set; } = Math.PI / 7.0;
        public double TotalDistanceKm { get; set; } = 1.932782;
        public double DurationMinutes { get; set; } = 25.7238;
        public DateTime? EndTime { get; set; } = null;

        // ── Trail state ────────────────────────────────────────────────────
        private List<TrackPoint> _trail = new();
        private int _trailIndex = 0;
        private double _trailIndexAccum = 0.0;

        /// <summary>
        /// Total distance actually walked so far in km.
        /// Accumulated by summing Haversine distance between trail segments crossed.
        /// </summary>
        private double _distanceWalkedKm = 0.0;
        public double DistanceWalkedKm => _distanceWalkedKm;

        private long _lastTimestamp = 0;
        private readonly object _lock = new();

        // Track is a list of (Timestamp, TrailIndex) keyframes for timestamp rewriting.
        public List<(DateTime Time, int TrailIndex)> Track { get; } = new();
        public List<(double Lat, double Lon, string File)> Screenshots { get; } = new();
        public Dictionary<string, string> Metadata { get; } = new();

        /// <summary>Current simulated position on the trail.</summary>
        public (double Lat, double Lon) CurrentPosition => _trail.Count > 0
            ? (_trail[_trailIndex].Lat, _trail[_trailIndex].Lon)
            : (BaseLat, BaseLon);

        // ── Public API ─────────────────────────────────────────────────────

        public void SetStartPoint(double lat, double lon)
        {
            BaseLat = lat;
            BaseLon = lon;
        }

        public double StepLengthM { get; set; } = 0.75;

        public void AddMetadata(string key, string value) => Metadata[key] = value;

        /// <summary>
        /// Generates the full trail upfront using the Python random-walk algorithm,
        /// then fetches real elevation data for each point from Open-Elevation API.
        /// Must be called after SetStartPoint() and before the first Update().
        /// </summary>
        public void GenerateTrail()
        {
            lock (_lock)
            {
                if (DurationMinutes <= 0)
                    throw new InvalidOperationException("[Trail] DurationMinutes must be > 0.");

                if (TotalDistanceKm <= 0)
                    throw new InvalidOperationException("[Trail] TotalDistanceKm must be > 0.");

                var rng = new Random();

                double totalDistanceKm = 0.0;
                double targetDistanceKm = TotalDistanceKm;

                double durationSeconds = DurationMinutes * 60.0;

                // Distance per step (based on your Scale)
                double segmentKm = Haversine(BaseLon, BaseLat, BaseLon + Scale, BaseLat);
                double segmentMeters = segmentKm * 1000.0;

                // Number of segments needed
                int totalSegments = (int)(targetDistanceKm / segmentKm);

                double secondsPerSegment = durationSeconds / totalSegments;

                DateTime startTime = EndTime?.AddSeconds(-durationSeconds) ?? DateTime.UtcNow;
                DateTime currentTime = startTime;

                double currentLat = BaseLat;
                double currentLon = BaseLon;
                double angle = 0.0;

                var generatedPoints = new List<TrackPoint>();

                // ✅ FIRST POINT = EXACT START
                generatedPoints.Add(new TrackPoint
                {
                    Lat = currentLat,
                    Lon = currentLon,
                    Time = currentTime,
                    Speed = 0,
                    Cadence = null,
                    Heading = null,
                    Elevation = null
                });

                for (int i = 0; i < totalSegments; i++)
                {
                    // Random angle variation
                    angle += rng.NextDouble() * AngleVariability - (AngleVariability / 2.0);

                    double newLat = currentLat + Math.Cos(angle) * Scale;
                    double newLon = currentLon + Math.Sin(angle) * Scale;

                    double stepKm = Haversine(currentLon, currentLat, newLon, newLat);
                    totalDistanceKm += stepKm;

                    currentTime = currentTime.AddSeconds(secondsPerSegment);

                    double speedMs = (stepKm * 1000.0) / secondsPerSegment;

                    generatedPoints.Add(new TrackPoint
                    {
                        Lat = newLat,
                        Lon = newLon,
                        Time = currentTime,
                        Speed = speedMs,
                        Cadence = null,
                        Heading = null,
                        Elevation = null
                    });

                    currentLat = newLat;
                    currentLon = newLon;
                }

                // Assign to trail
                _trail = generatedPoints;
                _trailIndex = 0;
                _trailIndexAccum = 0.0;
                _distanceWalkedKm = 0.0;

                _lastTimestamp = 0;
                Track.Clear();
                Screenshots.Clear();
                Metadata.Clear();

                Console.WriteLine($"[Trail] Generated {_trail.Count} points");
                Console.WriteLine($"[Trail] Start: {_trail[0].Lat:F7}, {_trail[0].Lon:F7}");
                Console.WriteLine($"[Trail] End:   {_trail[^1].Lat:F7}, {_trail[^1].Lon:F7}");
                Console.WriteLine($"[Trail] Distance ≈ {totalDistanceKm:F3} km");
                Console.WriteLine($"[Trail] Time {startTime:O} → {currentTime:O}");
            }
        }

        public void Reset()
        {
            lock (_lock)
            {
                _trail.Clear();
                _trailIndex = 0;
                _trailIndexAccum = 0.0;
                _distanceWalkedKm = 0.0;
                _lastTimestamp = 0;
                Track.Clear();
                Screenshots.Clear();
                Metadata.Clear();
            }
        }

        public void Update(Packet p)
        {
            lock (_lock)
            {
                if (_trail.Count == 0)
                {
                    Console.WriteLine("[Trail] Update() called before GenerateTrail() — ignoring.");
                    return;
                }

                if (_lastTimestamp == 0)
                {
                    _lastTimestamp = p.timeStamp;
                    Track.Add((DateTimeOffset.FromUnixTimeMilliseconds(p.timeStamp).UtcDateTime, _trailIndex));
                    return;
                }

                double dt = (p.timeStamp - _lastTimestamp) / 1000.0;
                _lastTimestamp = p.timeStamp;

                if (dt <= 0 || dt > 5.0) return;

                double cadence = 0.0;
                if (p.payload.TryGetValue("stepsCadence", out var c))
                    cadence = Convert.ToDouble(c);

                double speedMs = cadence * StepLengthM / 60.0;
                double segmentKm = Haversine(BaseLon, BaseLat, BaseLon + Scale, BaseLat);
                double segmentMs = segmentKm * 1000.0;
                double segmentsPerSecond = segmentMs > 0 ? speedMs / segmentMs : 0;

                _trailIndexAccum += segmentsPerSecond * dt;
                int newIndex = Math.Min((int)_trailIndexAccum, _trail.Count - 1);

                for (int idx = _trailIndex; idx < newIndex; idx++)
                {
                    var from = _trail[idx];
                    var to = _trail[idx + 1];
                    _distanceWalkedKm += Haversine(from.Lon, from.Lat, to.Lon, to.Lat);
                }

                _trailIndex = newIndex;

                Track.Add((DateTimeOffset.FromUnixTimeMilliseconds(p.timeStamp).UtcDateTime, _trailIndex));
            }
        }

        public void AddScreenshot(string file)
        {
            lock (_lock)
            {
                double lat = _trail.Count > 0 ? _trail[_trailIndex].Lat : BaseLat;
                double lon = _trail.Count > 0 ? _trail[_trailIndex].Lon : BaseLon;
                Screenshots.Add((lat, lon, file));
            }
        }

        /// <summary>
        /// Exports a GPX 1.1-conformant file.
        ///
        /// FIX: Exports _trail points up to _trailIndex (the walked portion),
        /// NOT the Track list. This ensures Strava sees a complete time-stamped
        /// route with speed and elevation on every point → moving time and pace
        /// are calculated correctly.
        /// </summary>
        public void Export(string filePath)
        {
            lock (_lock)
            {
                var finalExportPoints = new List<TrackPoint>();

                if (_trailIndex > 0 && Track.Count > 1)
                {
                    var geomPoints = _trail.GetRange(0, _trailIndex + 1);
                    int keyframeIndex = 0;

                    for (int i = 0; i < geomPoints.Count; i++)
                    {
                        // Advance keyframe until the NEXT keyframe covers point i,
                        // but never go past the second-to-last keyframe
                        while (keyframeIndex + 1 < Track.Count - 1 &&
                               Track[keyframeIndex + 1].TrailIndex <= i)
                        {
                            keyframeIndex++;
                        }

                        // Guard: clamp so keyframeIndex+1 is always valid
                        int nextKf = Math.Min(keyframeIndex + 1, Track.Count - 1);

                        var prevKeyframe = Track[keyframeIndex];
                        var nextKeyframe = Track[nextKf];

                        DateTime interpolatedTime;
                        if (nextKeyframe.TrailIndex == prevKeyframe.TrailIndex ||
                            nextKf == keyframeIndex)
                        {
                            interpolatedTime = prevKeyframe.Time;
                        }
                        else
                        {
                            double fraction = (double)(i - prevKeyframe.TrailIndex) /
                                              (nextKeyframe.TrailIndex - prevKeyframe.TrailIndex);
                            fraction = Math.Clamp(fraction, 0.0, 1.0);  // guard against overshoot
                            long interpolatedTicks = prevKeyframe.Time.Ticks +
                                (long)((nextKeyframe.Time.Ticks - prevKeyframe.Time.Ticks) * fraction);
                            interpolatedTime = new DateTime(interpolatedTicks, DateTimeKind.Utc);
                        }

                        var pt = geomPoints[i];
                        pt.Time = interpolatedTime;
                        finalExportPoints.Add(pt);
                    }
                }
                else if (_trail.Count > 0)
                {
                    // Fallback for very short sessions with not enough keyframes to interpolate
                    finalExportPoints = _trail.GetRange(0, _trailIndex + 1);
                }


                TimeSpan duration = finalExportPoints.Count >= 2
                    ? finalExportPoints[^1].Time - finalExportPoints[0].Time
                    : TimeSpan.Zero;

                using var writer = new StreamWriter(filePath);

                writer.WriteLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
                writer.WriteLine(
                    "<gpx version=\"1.1\" creator=\"PhoneController\" " +
                    "xmlns=\"http://www.topografix.com/GPX/1/1\" " +
                    "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
                    "xsi:schemaLocation=\"http://www.topografix.com/GPX/1/1 " +
                    "http://www.topografix.com/GPX/1/1/gpx.xsd\">");

                writer.WriteLine("  <metadata>");
                writer.WriteLine($"    <time>{DateTime.UtcNow:O}</time>");
                writer.WriteLine($"    <desc>" +
                    $"Start: {BaseLat:F7}, {BaseLon:F7} | " +
                    $"Distance walked: {_distanceWalkedKm:F3} km | " +
                    $"Duration: {duration:hh\\:mm\\:ss}" +
                    $"</desc>");

                if (Metadata.Count > 0)
                {
                    writer.WriteLine("    <extensions>");
                    foreach (var kvp in Metadata)
                        writer.WriteLine($"      <{kvp.Key}>{EscapeXml(kvp.Value)}</{kvp.Key}>");
                    writer.WriteLine("    </extensions>");
                }
                writer.WriteLine("  </metadata>");

                // Waypoints — must precede <trk> per GPX spec
                foreach (var s in Screenshots)
                {
                    writer.WriteLine($"  <wpt lat=\"{s.Lat:F7}\" lon=\"{s.Lon:F7}\">");
                    writer.WriteLine("    <name>Screenshot</name>");
                    writer.WriteLine($"    <desc>{EscapeXml(s.File)}</desc>");
                    writer.WriteLine("  </wpt>");
                }

                writer.WriteLine("  <trk>");
                writer.WriteLine("    <name>PhoneController Session</name>");
                writer.WriteLine("    <type>walking</type>");   // tells Strava activity type
                writer.WriteLine("    <trkseg>");

                foreach (var pt in finalExportPoints)
                {
                    writer.WriteLine($"      <trkpt lat=\"{pt.Lat:F7}\" lon=\"{pt.Lon:F7}\">");

                    // FIX 2: Write <ele> — populated by FetchElevations() in GenerateTrail()
                    if (pt.Elevation.HasValue)
                        writer.WriteLine($"        <ele>{pt.Elevation.Value:F1}</ele>");

                    writer.WriteLine($"        <time>{pt.Time:O}</time>");

                    // FIX 1: Speed is now set on every trail point — Strava uses
                    // this + timestamp delta to compute moving time and pace.
                    if (pt.Speed.HasValue || pt.Cadence.HasValue || pt.Heading.HasValue)
                    {
                        writer.WriteLine("        <extensions>");
                        if (pt.Speed.HasValue)
                            writer.WriteLine($"          <speed>{pt.Speed.Value:F3}</speed>");
                        if (pt.Cadence.HasValue)
                            writer.WriteLine($"          <cadence>{pt.Cadence.Value:F1}</cadence>");
                        if (pt.Heading.HasValue)
                            writer.WriteLine($"          <course>{pt.Heading.Value:F1}</course>");
                        writer.WriteLine("        </extensions>");
                    }

                    writer.WriteLine("      </trkpt>");
                }

                writer.WriteLine("    </trkseg>");
                writer.WriteLine("  </trk>");
                writer.WriteLine("</gpx>");

                Console.WriteLine($"[Export] Saved → {filePath}");
                Console.WriteLine($"[Export] Points: {finalExportPoints.Count} | " +
                                  $"Distance: {_distanceWalkedKm:F3} km | " +
                                  $"Duration: {duration:hh\\:mm\\:ss}");
            }
        }

        // ── Helpers ────────────────────────────────────────────────────────

        private static double Haversine(double lon1, double lat1, double lon2, double lat2)
        {
            const double R = 6371.0;
            double dLat = ToRad(lat2 - lat1);
            double dLon = ToRad(lon2 - lon1);
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                       Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }

        private static double ToRad(double deg) => deg * Math.PI / 180.0;

        private static string EscapeXml(string s) =>
            s.Replace("&", "&amp;")
             .Replace("<", "&lt;")
             .Replace(">", "&gt;")
             .Replace("\"", "&quot;")
             .Replace("'", "&apos;");
    }
}