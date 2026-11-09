using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ScreenRecorderLib;

namespace Backend
{
    public class ScreenRecordingOptions
    {
        public bool RecordScreen { get; set; } = true;
        public bool RecordAudio { get; set; } = true;
        public bool CaptureCursor { get; set; } = true;
        public int Framerate { get; set; } = 30;
        public int Quality { get; set; } = 75; // 1-100
        public string? TargetWindowTitle { get; set; }
        public IntPtr TargetWindowHandle { get; set; } = IntPtr.Zero;
        public string CaptureTarget { get; set; } = "auto"; // "auto", "monitor", "window"
    }

    /// <summary>
    /// Handles video screen recording for gameplay sessions using ScreenRecorderLib.
    /// Captures the active game window or primary monitor with hardware H.264 MP4 encoding.
    /// </summary>
    public class GameScreenRecorder : IDisposable
    {
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern int GetWindowTextLengthW(IntPtr hWnd);

        private readonly object _lock = new();
        private Recorder? _recorder;
        private TaskCompletionSource<bool>? _stopTcs;
        private bool _isRecording = false;
        private string? _currentVideoPath;
        private long _startTimeUtcMs = 0;

        public bool IsRecording
        {
            get
            {
                lock (_lock)
                {
                    return _isRecording;
                }
            }
        }

        public string? CurrentVideoPath => _currentVideoPath;
        public long StartTimeUtcMs => _startTimeUtcMs;

        public event Action<string>? OnRecordingStarted;
        public event Action<string>? OnRecordingCompleted;
        public event Action<string>? OnRecordingFailed;

        public static string GetRecordingsDirectory()
        {
            string primary = Path.Combine(AppContext.BaseDirectory, "recordings");
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
                    "recordings");
                Directory.CreateDirectory(fallback);
                return fallback;
            }
        }

        public bool Start(string destinationFilePath, ScreenRecordingOptions? options = null)
        {
            lock (_lock)
            {
                if (_isRecording)
                {
                    Console.WriteLine("[GameScreenRecorder] Already recording.");
                    return false;
                }

                options ??= new ScreenRecordingOptions();
                string? dir = Path.GetDirectoryName(destinationFilePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                _currentVideoPath = destinationFilePath;
                _stopTcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

                RecordingSourceBase recordingSource;
                IntPtr targetHwnd = IntPtr.Zero;

                if (options.CaptureTarget == "window" || options.CaptureTarget == "auto")
                {
                    if (options.TargetWindowHandle != IntPtr.Zero)
                    {
                        targetHwnd = options.TargetWindowHandle;
                    }
                    else if (!string.IsNullOrWhiteSpace(options.TargetWindowTitle))
                    {
                        targetHwnd = ScreenCapture.FindWindowByTitle(options.TargetWindowTitle);
                    }
                    else if (options.CaptureTarget == "auto")
                    {
                        // Check foreground window, ensuring it is not our own window
                        IntPtr fg = GetForegroundWindow();
                        if (fg != IntPtr.Zero && !IsCurrentProcessWindow(fg))
                        {
                            targetHwnd = fg;
                        }
                    }
                }

                if (targetHwnd != IntPtr.Zero)
                {
                    Console.WriteLine($"[GameScreenRecorder] Recording window handle 0x{targetHwnd.ToInt64():X} with WindowsGraphicsCapture");
                    recordingSource = new WindowRecordingSource(targetHwnd)
                    {
                        IsBorderRequired = false,
                        IsCursorCaptureEnabled = options.CaptureCursor
                    };
                }
                else
                {
                    Console.WriteLine("[GameScreenRecorder] Recording main monitor with WindowsGraphicsCapture");
                    recordingSource = new DisplayRecordingSource(DisplayRecordingSource.MainMonitor)
                    {
                        RecorderApi = RecorderApi.WindowsGraphicsCapture,
                        IsBorderRequired = false,
                        IsCursorCaptureEnabled = options.CaptureCursor
                    };
                }

                var audioOptions = new AudioOptions
                {
                    IsAudioEnabled = options.RecordAudio
                };

                if (options.RecordAudio)
                {
                    try
                    {
                        audioOptions.AudioSources = new List<AudioSourceBase>
                        {
                            new LoopbackAudioSource(LoopbackAudioSource.Default)
                        };
                    }
                    catch { }
                }

                var recorderOptions = new RecorderOptions
                {
                    SourceOptions = new SourceOptions
                    {
                        RecordingSources = { recordingSource }
                    },
                    VideoEncoderOptions = new VideoEncoderOptions
                    {
                        Encoder = new H264VideoEncoder
                        {
                            BitrateMode = H264BitrateControlMode.Quality,
                            EncoderProfile = H264Profile.Main
                        },
                        Framerate = Math.Clamp(options.Framerate, 15, 60),
                        Quality = Math.Clamp(options.Quality, 30, 100),
                        IsHardwareEncodingEnabled = true,
                        IsFragmentedMp4Enabled = true, // Critical: fragments prevent corrupt MP4 on unexpected stops or crashes
                        IsMp4FastStartEnabled = false,  // Critical: avoid full file rewrite on stop which causes file locks/corruption
                        IsFixedFramerate = true,        // Critical: stable constant framerate prevents timestamp drift and player corruption
                        IsThrottlingDisabled = true,
                        IsLowLatencyEnabled = false
                    },
                    AudioOptions = audioOptions
                };

                try
                {
                    _recorder = Recorder.CreateRecorder(recorderOptions);

                    _recorder.OnRecordingComplete += (s, e) =>
                    {
                        Console.WriteLine($"[GameScreenRecorder] Recording complete: {e.FilePath}");
                        _stopTcs?.TrySetResult(true);
                        OnRecordingCompleted?.Invoke(e.FilePath);
                    };

                    _recorder.OnRecordingFailed += (s, e) =>
                    {
                        Console.WriteLine($"[GameScreenRecorder] Recording failed: {e.Error}");
                        _stopTcs?.TrySetResult(false);
                        OnRecordingFailed?.Invoke(e.Error);
                    };

                    _startTimeUtcMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    _recorder.Record(destinationFilePath);
                    _isRecording = true;

                    OnRecordingStarted?.Invoke(destinationFilePath);
                    return true;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[GameScreenRecorder] Failed to start recorder: {ex.Message}");
                    _isRecording = false;
                    _recorder?.Dispose();
                    _recorder = null;
                    return false;
                }
            }
        }

        public async Task<bool> StopAsync(int timeoutMs = 30000)
        {
            TaskCompletionSource<bool>? tcs;
            Recorder? rec;

            lock (_lock)
            {
                if (!_isRecording || _recorder == null)
                {
                    return false;
                }

                _isRecording = false;
                rec = _recorder;
                tcs = _stopTcs;
            }

            try
            {
                Console.WriteLine("[GameScreenRecorder] Stopping recorder and flushing MP4 streams...");
                rec.Stop();

                if (tcs != null)
                {
                    var completedTask = await Task.WhenAny(tcs.Task, Task.Delay(timeoutMs));
                    if (completedTask == tcs.Task)
                    {
                        bool success = await tcs.Task;
                        Console.WriteLine($"[GameScreenRecorder] Recording finalize completed, success: {success}");
                        return success;
                    }
                    Console.WriteLine("[GameScreenRecorder] Stop timed out waiting for recording completion.");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GameScreenRecorder] Error while stopping recording: {ex.Message}");
                return false;
            }
            finally
            {
                lock (_lock)
                {
                    try { rec?.Dispose(); } catch { }
                    if (_recorder == rec)
                    {
                        _recorder = null;
                    }
                    _stopTcs = null;
                }
            }
        }

        private static bool IsCurrentProcessWindow(IntPtr hWnd)
        {
            try
            {
                GetWindowThreadProcessId(hWnd, out uint processId);
                return processId == Process.GetCurrentProcess().Id;
            }
            catch
            {
                return false;
            }
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        public void Dispose()
        {
            lock (_lock)
            {
                if (_isRecording)
                {
                    try { _recorder?.Stop(); } catch { }
                    _isRecording = false;
                }
                _recorder?.Dispose();
                _recorder = null;
            }
        }
    }
}
