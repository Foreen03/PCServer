using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
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

        [JsonProperty("video_time_ms", NullValueHandling = NullValueHandling.Ignore)]
        public long? videoTimeMs { get; set; }

        [JsonProperty("video_time", NullValueHandling = NullValueHandling.Ignore)]
        public string? videoTime { get; set; }
    }

    public static class StepLogger
    {
        private static readonly List<StepLogRecord> _records = new();
        private static readonly List<StepLogRecord> _sessionRecords = new();
        private static readonly object _lock = new();
        private static PhotinoWindow? _window;
        private static long _lastTimestamp = -1;
        private static int _lastSteps = -1;
        private static DateTime _lastUiUpdateTime = DateTime.MinValue;

        // Session state
        private static bool _isSessionLogging = false;
        private static bool _isRecordingScreen = false;
        private static long _sessionStartTimeUtcMs = 0;
        private static string? _sessionVideoPath = null;
        private static string? _sessionId = null;
        private static GameScreenRecorder? _screenRecorder = null;

        public static bool IsSessionLogging
        {
            get
            {
                lock (_lock) { return _isSessionLogging; }
            }
        }

        public static bool IsRecordingScreen
        {
            get
            {
                lock (_lock) { return _isRecordingScreen; }
            }
        }

        public static long SessionStartTimeUtcMs
        {
            get
            {
                lock (_lock) { return _sessionStartTimeUtcMs; }
            }
        }

        public static string? SessionVideoPath
        {
            get
            {
                lock (_lock) { return _sessionVideoPath; }
            }
        }

        public static int SessionCount
        {
            get
            {
                lock (_lock) { return _sessionRecords.Count; }
            }
        }

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

        public static bool StartSession(bool recordScreen = true, bool recordAudio = true, string? windowTitle = null, string captureTarget = "auto")
        {
            lock (_lock)
            {
                if (_isSessionLogging)
                {
                    Console.WriteLine("[StepLogger] Session already in progress.");
                    return false;
                }

                _sessionId = $"session_{DateTime.Now:yyyyMMdd_HHmmss}";
                _sessionStartTimeUtcMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                _sessionRecords.Clear();
                _isSessionLogging = true;
                _isRecordingScreen = recordScreen;
                _sessionVideoPath = null;

                if (recordScreen)
                {
                    try
                    {
                        string recordingsDir = GameScreenRecorder.GetRecordingsDirectory();
                        string videoPath = Path.Combine(recordingsDir, $"{_sessionId}.mp4");
                        _sessionVideoPath = videoPath;

                        _screenRecorder = new GameScreenRecorder();
                        var recOptions = new ScreenRecordingOptions
                        {
                            RecordScreen = true,
                            RecordAudio = recordAudio,
                            TargetWindowTitle = windowTitle,
                            CaptureTarget = captureTarget,
                            CaptureCursor = true,
                            Framerate = 30,
                            Quality = 75
                        };

                        bool started = _screenRecorder.Start(videoPath, recOptions);
                        if (started)
                        {
                            if (_screenRecorder.StartTimeUtcMs > 0)
                            {
                                _sessionStartTimeUtcMs = _screenRecorder.StartTimeUtcMs;
                            }
                            Console.WriteLine($"[StepLogger] Screen recording started for session {_sessionId}: {videoPath}");
                        }
                        else
                        {
                            Console.WriteLine("[StepLogger] Screen recorder failed to start; continuing with steps-only logging.");
                            _isRecordingScreen = false;
                            _sessionVideoPath = null;
                            _screenRecorder.Dispose();
                            _screenRecorder = null;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[StepLogger] Error initializing screen recorder: {ex.Message}");
                        _isRecordingScreen = false;
                        _sessionVideoPath = null;
                        _screenRecorder?.Dispose();
                        _screenRecorder = null;
                    }
                }

                NotifyUiLoggingStatus();
                NotifyUiCount();
                return true;
            }
        }

        public static async Task<(string? videoPath, string stepsPath, string summaryPath, string? subtitlePath, int count)> StopSessionAsync()
        {
            GameScreenRecorder? recorderToStop = null;
            string sessionId;
            long startTimeMs;
            long endTimeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            string? videoPath;
            List<StepLogRecord> sessionRecordsCopy;

            lock (_lock)
            {
                if (!_isSessionLogging)
                {
                    return (null, string.Empty, string.Empty, null, 0);
                }

                _isSessionLogging = false;
                sessionId = _sessionId ?? $"session_{DateTime.Now:yyyyMMdd_HHmmss}";
                startTimeMs = _sessionStartTimeUtcMs;
                videoPath = _sessionVideoPath;
                recorderToStop = _screenRecorder;
                _screenRecorder = null;
                sessionRecordsCopy = _sessionRecords.ToList();
            }

            if (recorderToStop != null)
            {
                try
                {
                    Console.WriteLine("[StepLogger] Stopping screen recorder and flushing MP4 container...");
                    bool finalized = await recorderToStop.StopAsync(timeoutMs: 30000);
                    if (!finalized)
                    {
                        Console.WriteLine("[StepLogger] Warning: Video recorder finalization timed out or reported failure.");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[StepLogger] Error stopping recorder: {ex.Message}");
                }
                finally
                {
                    recorderToStop.Dispose();
                }
            }

            // Verify video file validity
            if (!string.IsNullOrEmpty(videoPath) && File.Exists(videoPath))
            {
                try
                {
                    var fi = new FileInfo(videoPath);
                    if (fi.Length == 0)
                    {
                        Console.WriteLine("[StepLogger] Warning: Video file has 0 bytes (corrupt or unwritten). Discarding invalid video path.");
                        videoPath = null;
                    }
                }
                catch { }
            }
            else
            {
                videoPath = null;
            }

            string recordingsDir = GameScreenRecorder.GetRecordingsDirectory();
            string stepsPath = Path.Combine(recordingsDir, $"{sessionId}_steps.txt");
            string summaryPath = Path.Combine(recordingsDir, $"{sessionId}_summary.json");
            string srtPath = Path.Combine(recordingsDir, $"{sessionId}.srt");

            long durationMs = Math.Max(0, endTimeMs - startTimeMs);

            try
            {
                // 1. Write steps txt (JSON lines with steps, timestamp, video_time_ms, video_time)
                var lines = sessionRecordsCopy.Select(r =>
                    System.Text.Json.JsonSerializer.Serialize(new
                    {
                        steps = r.steps,
                        timestamp = r.timestamp,
                        video_time_ms = r.videoTimeMs ?? 0,
                        video_time = r.videoTime ?? "00:00:00.000"
                    }));
                File.WriteAllLines(stepsPath, lines, Encoding.UTF8);

                // 2. Write summary JSON
                int initialSteps = sessionRecordsCopy.Count > 0 ? sessionRecordsCopy.First().steps : 0;
                int finalSteps = sessionRecordsCopy.Count > 0 ? sessionRecordsCopy.Last().steps : 0;
                int deltaSteps = finalSteps - initialSteps;

                var summaryObj = new
                {
                    sessionId = sessionId,
                    startTimeUtc = DateTimeOffset.FromUnixTimeMilliseconds(startTimeMs).ToString("o"),
                    endTimeUtc = DateTimeOffset.FromUnixTimeMilliseconds(endTimeMs).ToString("o"),
                    startTimeMs = startTimeMs,
                    endTimeMs = endTimeMs,
                    durationMs = durationMs,
                    duration = TimeSpan.FromMilliseconds(durationMs).ToString(@"hh\:mm\:ss\.fff"),
                    totalRecords = sessionRecordsCopy.Count,
                    initialSteps = initialSteps,
                    finalSteps = finalSteps,
                    deltaSteps = deltaSteps,
                    videoFile = !string.IsNullOrEmpty(videoPath) && File.Exists(videoPath) ? Path.GetFileName(videoPath) : null,
                    stepsFile = Path.GetFileName(stepsPath),
                    subtitleFile = Path.GetFileName(srtPath),
                    records = sessionRecordsCopy
                };
                File.WriteAllText(summaryPath, System.Text.Json.JsonSerializer.Serialize(summaryObj, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }), Encoding.UTF8);

                // 3. Write SRT subtitle file so video players can show step counts synchronized with the video
                if (!string.IsNullOrEmpty(videoPath) && File.Exists(videoPath) && sessionRecordsCopy.Count > 0)
                {
                    GenerateSrtFile(srtPath, sessionRecordsCopy, durationMs);
                }
                else
                {
                    srtPath = string.Empty;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[StepLogger] Failed writing session files: {ex.Message}");
            }

            lock (_lock)
            {
                _isRecordingScreen = false;
                _sessionVideoPath = null;
                _sessionId = null;
            }

            NotifyUiLoggingStatus(stoppedVideoPath: videoPath, stoppedStepsPath: stepsPath, count: sessionRecordsCopy.Count, durationMs: durationMs);
            NotifyUiCount();

            string logMessage = !string.IsNullOrEmpty(videoPath) && File.Exists(videoPath)
                ? $"[StepLogger] Session completed! Video: {Path.GetFileName(videoPath)}, Steps: {sessionRecordsCopy.Count} records saved to {Path.GetFileName(stepsPath)}"
                : $"[StepLogger] Session completed! Steps: {sessionRecordsCopy.Count} records saved to {Path.GetFileName(stepsPath)}";

            try
            {
                _window?.SendWebMessage(System.Text.Json.JsonSerializer.Serialize(new
                {
                    type = "log",
                    message = logMessage
                }));
            }
            catch { }

            return (videoPath, stepsPath, summaryPath, string.IsNullOrEmpty(srtPath) ? null : srtPath, sessionRecordsCopy.Count);
        }

        private static void GenerateSrtFile(string srtPath, List<StepLogRecord> records, long totalDurationMs)
        {
            var sb = new StringBuilder();
            int subIndex = 1;

            for (int i = 0; i < records.Count; i++)
            {
                var cur = records[i];
                long curMs = cur.videoTimeMs ?? 0;
                long nextMs = (i + 1 < records.Count) ? (records[i + 1].videoTimeMs ?? curMs) : totalDurationMs;
                if (nextMs <= curMs) nextMs = curMs + 1000;

                string srtStart = FormatSrtTime(curMs);
                string srtEnd = FormatSrtTime(nextMs);

                sb.AppendLine(subIndex.ToString());
                sb.AppendLine($"{srtStart} --> {srtEnd}");
                sb.AppendLine($"Steps: {cur.steps}");
                sb.AppendLine();
                subIndex++;
            }

            File.WriteAllText(srtPath, sb.ToString(), Encoding.UTF8);
        }

        private static string FormatSrtTime(long ms)
        {
            var ts = TimeSpan.FromMilliseconds(Math.Max(0, ms));
            return $"{(int)ts.TotalHours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2},{ts.Milliseconds:D3}";
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

                var record = new StepLogRecord
                {
                    steps = steps,
                    timestamp = timestamp
                };

                _records.Add(record);

                if (_isSessionLogging)
                {
                    long videoMs = Math.Max(0, timestamp - _sessionStartTimeUtcMs);
                    var ts = TimeSpan.FromMilliseconds(videoMs);
                    record.videoTimeMs = videoMs;
                    record.videoTime = ts.ToString(@"hh\:mm\:ss\.fff");
                    _sessionRecords.Add(record);
                }

                var now = DateTime.UtcNow;
                if ((now - _lastUiUpdateTime).TotalMilliseconds >= 500)
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
                _sessionRecords.Clear();
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

        public static IReadOnlyList<StepLogRecord> GetSessionRecords()
        {
            lock (_lock)
            {
                return _sessionRecords.ToList();
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

        public static void NotifyUiLoggingStatus(string? stoppedVideoPath = null, string? stoppedStepsPath = null, int count = 0, long durationMs = 0)
        {
            try
            {
                bool isLogging;
                bool isRecScreen;
                long startMs;
                string? currentVideo;
                int sessionCount;

                lock (_lock)
                {
                    isLogging = _isSessionLogging;
                    isRecScreen = _isRecordingScreen;
                    startMs = _sessionStartTimeUtcMs;
                    currentVideo = _sessionVideoPath;
                    sessionCount = _sessionRecords.Count;
                }

                _window?.SendWebMessage(System.Text.Json.JsonSerializer.Serialize(new
                {
                    type = "loggingStatus",
                    isLogging = isLogging,
                    isRecordingScreen = isRecScreen,
                    sessionStartTime = startMs,
                    videoPath = isLogging ? currentVideo : stoppedVideoPath,
                    stepsPath = stoppedStepsPath,
                    sessionCount = isLogging ? sessionCount : count,
                    durationMs = durationMs
                }));
            }
            catch { }
        }

        public static void NotifyUiCount()
        {
            try
            {
                int count;
                int sessionCount;
                bool isLogging;
                lock (_lock)
                {
                    count = _records.Count;
                    sessionCount = _sessionRecords.Count;
                    isLogging = _isSessionLogging;
                }

                _window?.SendWebMessage(System.Text.Json.JsonSerializer.Serialize(new
                {
                    type = "stepLogCount",
                    count = count,
                    sessionCount = sessionCount,
                    isLogging = isLogging
                }));
            }
            catch
            {
                // Window may be closed or closing
            }
        }
    }
}
