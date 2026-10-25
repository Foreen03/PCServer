using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Photino.NET;

namespace Backend
{
    public struct StepLogRecord
    {
        [JsonProperty("steps")]
        public int steps { get; set; }

        [JsonProperty("timestamp")]
        public long timestamp { get; set; }
    }

    public static class StepLogger
    {
        private static readonly List<StepLogRecord> _records = new();
        private static readonly object _lock = new();
        private static PhotinoWindow? _window;
        private static long _lastTimestamp = -1;
        private static int _lastSteps = -1;
        private static DateTime _lastUiUpdateTime = DateTime.MinValue;

        public static int Count
        {
            get
            {
                lock (_lock)
                {
                    return _records.Count;
                }
            }
        }

        public static void SetWindow(PhotinoWindow window)
        {
            _window = window;
        }

        public static void Record(int steps, long timestamp)
        {
            lock (_lock)
            {
                if (timestamp <= 0)
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                }

                // Skip exact duplicates
                if (timestamp == _lastTimestamp && steps == _lastSteps)
                {
                    return;
                }

                _lastTimestamp = timestamp;
                _lastSteps = steps;

                _records.Add(new StepLogRecord
                {
                    steps = steps,
                    timestamp = timestamp
                });

                var now = DateTime.UtcNow;
                if ((now - _lastUiUpdateTime).TotalMilliseconds >= 1000)
                {
                    _lastUiUpdateTime = now;
                    NotifyUiCount();
                }
            }
        }

        public static void RecordFromPacket(string rawData)
        {
            if (string.IsNullOrWhiteSpace(rawData)) return;

            try
            {
                var jObj = JObject.Parse(rawData);
                long timestamp = 0;

                if (jObj.TryGetValue("timestamp", StringComparison.OrdinalIgnoreCase, out var tsToken))
                {
                    timestamp = tsToken.Value<long>();
                }

                // If standard Packet: { packetType: "movement", payload: { steps: ..., timestamp: ... } }
                if (jObj.TryGetValue("packetType", StringComparison.OrdinalIgnoreCase, out var typeToken) &&
                    string.Equals(typeToken.ToString(), "movement", StringComparison.OrdinalIgnoreCase))
                {
                    if (jObj.TryGetValue("payload", StringComparison.OrdinalIgnoreCase, out var payloadToken) &&
                        payloadToken is JObject payload)
                    {
                        int steps = 0;
                        bool hasSteps = false;

                        if (payload.TryGetValue("steps", StringComparison.OrdinalIgnoreCase, out var sToken))
                        {
                            steps = sToken.Value<int>();
                            hasSteps = true;
                        }

                        if (timestamp <= 0 && payload.TryGetValue("timestamp", StringComparison.OrdinalIgnoreCase, out var pTsToken))
                        {
                            timestamp = pTsToken.Value<long>();
                        }

                        if (hasSteps)
                        {
                            Record(steps, timestamp);
                            return;
                        }
                    }
                }

                // Direct { steps: 0, timestamp: ... }
                if (jObj.TryGetValue("steps", StringComparison.OrdinalIgnoreCase, out var directStepsToken))
                {
                    int steps = directStepsToken.Value<int>();
                    Record(steps, timestamp);
                }
            }
            catch
            {
                // Non-JSON or malformed packet, ignore
            }
        }

        public static void Clear()
        {
            lock (_lock)
            {
                _records.Clear();
                _lastTimestamp = -1;
                _lastSteps = -1;
            }
            NotifyUiCount();
        }

        public static IReadOnlyList<StepLogRecord> GetRecords()
        {
            lock (_lock)
            {
                return _records.ToList();
            }
        }

        public static string GetLogsDirectory()
        {
            string primary = Path.Combine(AppContext.BaseDirectory, "logs");
            try
            {
                if (!Directory.Exists(primary))
                {
                    Directory.CreateDirectory(primary);
                }
                return primary;
            }
            catch
            {
                string fallback = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "PCServer",
                    "logs");
                Directory.CreateDirectory(fallback);
                return fallback;
            }
        }

        public static string Export(string? targetFilePath = null)
        {
            lock (_lock)
            {
                if (string.IsNullOrWhiteSpace(targetFilePath))
                {
                    string dir = GetLogsDirectory();
                    string fileName = $"step_logs_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
                    targetFilePath = Path.Combine(dir, fileName);
                }

                string? parentDir = Path.GetDirectoryName(targetFilePath);
                if (!string.IsNullOrEmpty(parentDir) && !Directory.Exists(parentDir))
                {
                    Directory.CreateDirectory(parentDir);
                }

                var lines = _records.Select(r => $"{{\"steps\": {r.steps}, \"timestamp\": {r.timestamp}}}");
                File.WriteAllLines(targetFilePath, lines, Encoding.UTF8);

                NotifyUiCount();
                return targetFilePath;
            }
        }

        public static string ExportWithDialog(string defaultFileName)
        {
            string filePath = string.Empty;

            var thread = new Thread(() =>
            {
                using var sfd = new SaveFileDialog
                {
                    Title = "Export Step Logs",
                    InitialDirectory = GetLogsDirectory(),
                    Filter = "Text Files (*.txt)|*.txt|All files (*.*)|*.*",
                    FilterIndex = 1,
                    RestoreDirectory = true,
                    DefaultExt = "txt",
                    FileName = defaultFileName
                };

                if (sfd.ShowDialog() == DialogResult.OK)
                {
                    filePath = sfd.FileName;
                }
            });

            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();

            if (!string.IsNullOrEmpty(filePath))
            {
                return Export(filePath);
            }

            return string.Empty;
        }

        public static void NotifyUiCount()
        {
            try
            {
                int count;
                lock (_lock)
                {
                    count = _records.Count;
                }

                _window?.SendWebMessage(System.Text.Json.JsonSerializer.Serialize(new
                {
                    type = "stepLogCount",
                    count = count
                }));
            }
            catch
            {
                // Window may be closed or closing
            }
        }
    }
}
