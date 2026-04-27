using System;
using System.Collections.Generic;
using System.IO;

namespace Backend
{
    

    public class GpxTrail
    {
        // ── Position state ─────────────────────────────────────────────────
        private double _x = 0;
        private double _y = 0;

        /// <summary>Heading in radians. Kept in [−π, π] to avoid float drift.</summary>
        private double _heading = 0;

        // ── Configurable origin ────────────────────────────────────────────
        public double BaseLat { get; set; } = 3.2206334;
        public double BaseLon { get; set; } = 101.9676587;

        /// <summary>
        /// Metres-per-unit in the internal X/Y coordinate system.
        /// The Python reference uses SCALE=0.0001 degrees per segment;
        /// at ~111 km/degree that is ~11.1 m per step. We expose this so
        /// the caller can tune without recompiling.
        /// </summary>
        public double MetresPerDegree { get; set; } = 111_000.0;

        // ── Motion parameters ──────────────────────────────────────────────
        /// <summary>Turn-rate in radians per second per unit of steer (−1…1).</summary>
        public double TurnRateRad { get; set; } = 1.2;

        /// <summary>Cadence (steps/min) that maps to maximum speed.</summary>
        public double MaxCadence { get; set; } = 180.0;

        /// <summary>Cadence below which the model treats the user as stopped.</summary>
        public double MinCadence { get; set; } = 60.0;

        /// <summary>Maximum speed in m/s (reached at MaxCadence).</summary>
        public double MaxSpeedMs { get; set; } = 3.0;

        /// <summary>EMA smoothing factor for cadence → speed (0 = frozen, 1 = instant).</summary>
        public double SpeedAlpha { get; set; } = 0.2;

        /// <summary>
        /// Per-second speed decay factor (like rolling friction).
        /// Applied as  smoothedSpeed *= Math.Pow(Decay, dt)  so it is
        /// frame-rate independent.
        /// </summary>
        public double SpeedDecayPerSecond { get; set; } = 0.85;

        // ── Internal state ─────────────────────────────────────────────────
        private long _lastTimestamp = 0;
        private double _smoothedSpeed = 0.0;
        private double _currentSteer = 0.0;

        private readonly object _lock = new();

        public List<TrackPoint> Track { get; } = new();
        public List<(double Lat, double Lon, string File)> Screenshots { get; } = new();

        // ── Public API ─────────────────────────────────────────────────────

        public void SetSteering(double steer) =>
            _currentSteer = Math.Clamp(steer, -1.0, 1.0);

        public void Reset()
        {
            lock (_lock)
            {
                _x = _y = _heading = _smoothedSpeed = 0;
                _lastTimestamp = 0;
                _currentSteer = 0;
                Track.Clear();
                Screenshots.Clear();
            }
        }

        public void Update(Packet p)
        {
            lock (_lock)
            {
                if (_lastTimestamp == 0)
                {
                    // Seed the timestamp; emit the first point at origin so the
                    // track starts exactly at BaseLat/BaseLon.
                    _lastTimestamp = p.timeStamp;
                    AppendTrackPoint(p.timeStamp, 0, null);
                    return;
                }

                double dt = (p.timeStamp - _lastTimestamp) / 1000.0;
                _lastTimestamp = p.timeStamp;

                // Guard against huge dt spikes (e.g. app was backgrounded).
                if (dt <= 0 || dt > 5.0) return;

                // ── Cadence → speed ──────────────────────────────────────
                double cadence = 0.0;
                if (p.payload.TryGetValue("stepsCadence", out var c))
                    cadence = Convert.ToDouble(c);

                double targetSpeed = NormaliseCadence(cadence) * MaxSpeedMs;
                _smoothedSpeed += (targetSpeed - _smoothedSpeed) * SpeedAlpha;

                // Frame-rate-independent decay (simulate surface friction).
                _smoothedSpeed *= Math.Pow(SpeedDecayPerSecond, dt);
                _smoothedSpeed = Math.Max(0, _smoothedSpeed); // never negative

                // ── Dead-reckoning ───────────────────────────────────────
                _heading += _currentSteer * TurnRateRad * dt;

                // Normalise to (−π, π] to prevent floating-point drift.
                _heading = NormaliseAngle(_heading);

                double distance = _smoothedSpeed * dt; // metres
                double degPerMetre = 1.0 / MetresPerDegree;

                _x += Math.Cos(_heading) * distance * degPerMetre; // Δlon
                _y += Math.Sin(_heading) * distance * degPerMetre; // Δlat

                AppendTrackPoint(p.timeStamp, _smoothedSpeed, cadence);
            }
        }

        public void AddScreenshot(string file)
        {
            lock (_lock)
            {
                double lat = BaseLat + _y;
                double lon = BaseLon + _x;
                Screenshots.Add((lat, lon, file));
            }
        }

        /// <summary>
        /// Exports a GPX 1.1-conformant file.  Waypoints (screenshots) are
        /// written before the track as required by the schema.
        /// </summary>
        public void Export(string filePath)
        {
            lock (_lock)
            {
                using var writer = new StreamWriter(filePath);

                writer.WriteLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
                writer.WriteLine(
                    "<gpx version=\"1.1\" creator=\"PhoneController\" " +
                    "xmlns=\"http://www.topografix.com/GPX/1/1\" " +
                    "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
                    "xsi:schemaLocation=\"http://www.topografix.com/GPX/1/1 " +
                    "http://www.topografix.com/GPX/1/1/gpx.xsd\">");

                // Metadata
                writer.WriteLine("  <metadata>");
                writer.WriteLine($"    <time>{DateTime.UtcNow:O}</time>");
                writer.WriteLine("  </metadata>");

                // Waypoints (screenshots) — must precede <trk> per GPX spec.
                foreach (var s in Screenshots)
                {
                    writer.WriteLine(
                        $"  <wpt lat=\"{s.Lat:F7}\" lon=\"{s.Lon:F7}\">");
                    writer.WriteLine("    <name>Screenshot</name>");
                    writer.WriteLine($"    <desc>{EscapeXml(s.File)}</desc>");
                    writer.WriteLine("  </wpt>");
                }

                // Track
                writer.WriteLine("  <trk>");
                writer.WriteLine("    <name>PhoneController Session</name>");
                writer.WriteLine("    <trkseg>");

                foreach (var pt in Track)
                {
                    writer.WriteLine(
                        $"      <trkpt lat=\"{pt.Lat:F7}\" lon=\"{pt.Lon:F7}\">");

                    if (pt.Elevation.HasValue)
                        writer.WriteLine($"        <ele>{pt.Elevation.Value:F1}</ele>");

                    writer.WriteLine($"        <time>{pt.Time:O}</time>");

                    // Extensions: speed and cadence for analysis tools.
                    if (pt.Speed.HasValue || pt.Cadence.HasValue || pt.Heading.HasValue)
                    {
                        writer.WriteLine("        <extensions>");
                        if (pt.Speed.HasValue)
                            writer.WriteLine(
                                $"          <speed>{pt.Speed.Value:F3}</speed>");
                        if (pt.Cadence.HasValue)
                            writer.WriteLine(
                                $"          <cadence>{pt.Cadence.Value:F1}</cadence>");
                        if (pt.Heading.HasValue)
                            writer.WriteLine(
                                $"          <course>{pt.Heading.Value:F1}</course>");
                        writer.WriteLine("        </extensions>");
                    }

                    writer.WriteLine("      </trkpt>");
                }

                writer.WriteLine("    </trkseg>");
                writer.WriteLine("  </trk>");
                writer.WriteLine("</gpx>");
            }
        }

        // ── Helpers ────────────────────────────────────────────────────────

        private void AppendTrackPoint(long timestampMs, double speedMs, double? cadence)
        {
            double lat = BaseLat + _y;
            double lon = BaseLon + _x;

            // Convert heading from radians (East=0) to degrees true north (North=0).
            double headingDeg = (90.0 - _heading * 180.0 / Math.PI + 360.0) % 360.0;

            Track.Add(new TrackPoint
            {
                Lat = lat,
                Lon = lon,
                Time = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs).UtcDateTime,
                Speed = speedMs,
                Cadence = cadence,
                Heading = headingDeg
            });
        }

        private double NormaliseCadence(double cadence)
        {
            if (MaxCadence <= MinCadence) return 0;
            return Math.Clamp((cadence - MinCadence) / (MaxCadence - MinCadence), 0.0, 1.0);
        }

        /// <summary>Wraps angle in radians to (−π, π].</summary>
        private static double NormaliseAngle(double radians)
        {
            while (radians > Math.PI)  radians -= 2 * Math.PI;
            while (radians <= -Math.PI) radians += 2 * Math.PI;
            return radians;
        }

        private static string EscapeXml(string s) =>
            s.Replace("&", "&amp;")
             .Replace("<", "&lt;")
             .Replace(">", "&gt;")
             .Replace("\"", "&quot;")
             .Replace("'", "&apos;");
    }
}