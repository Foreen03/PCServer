using Nefarius.ViGEm.Client;
using Nefarius.ViGEm.Client.Targets;
using Nefarius.ViGEm.Client.Targets.Xbox360;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Photino.NET;

using System.Drawing.Imaging;
using RedCorners.ExifLibrary;

namespace Backend
{
    public class VigemController : IController
    {
        private PhotinoWindow? _window;
        private ViGEmClient? vigemClient;
        private IXbox360Controller? controller;
        private ControllerMapping? controllerMapping;

        private Dictionary<string, bool> sensorToggleStates = new Dictionary<string, bool>();
        private Dictionary<string, float> smoothedAxisValues = new Dictionary<string, float>();

        private static readonly object _processingLock = new object();

        // --- Throttling: prevent ViGEm driver overload (BSOD fix) ---
        private DateTime _lastSubmitTime = DateTime.MinValue;
        private static readonly TimeSpan _minSubmitInterval = TimeSpan.FromMilliseconds(8); // ~120Hz max

        // --- Throttle walked_distance UI updates to ~1Hz ---
        private DateTime _lastWalkedDistanceUpdate = DateTime.MinValue;
        private static readonly TimeSpan _walkedDistanceInterval = TimeSpan.FromSeconds(1);

        private GpxTrail gpxTrail = new GpxTrail();

        public void SetWindow(PhotinoWindow window)
        {
            _window = window;
        }

        private void Log(string message)
        {
            _window?.SendWebMessage(JsonConvert.SerializeObject(new { type = "log", message }));
        }

        private void LoadControllerMapping()
        {
            var json = GetJsonFromFile();
            if (string.IsNullOrEmpty(json))
            {
                Log("No controller mapping file selected. Controller mapping will be disabled.");
                return;
            }
            Log($"Loaded controller mapping: {json}");
            controllerMapping = JsonConvert.DeserializeObject<ControllerMapping>(json);
        }

        public void Activate()
        {
            Log("Vigem Controller Activated");
            LoadControllerMapping();
            try
            {
                vigemClient = new ViGEmClient();
                controller = vigemClient.CreateXbox360Controller();
                controller.Connect();
                Log("ViGEm controller connected.");
            }
            catch (Exception ex)
            {
                Log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
                Log($"Error initializing ViGEm client: {ex.Message}");
                Log(ex.StackTrace ?? "No stack trace available");
                Log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
                return;
            }
        }

        public void Deactivate()
        {
            Log("--- Vigem Controller Deactivated ---");
            if (controller != null)
            {
                controller.Disconnect();
                Log("ViGEm controller disconnected.");
            }

            vigemClient?.Dispose();
        }

        public void ProcessData(string data)
        {
            try
            {
                Packet? p = JsonConvert.DeserializeObject<Packet>(data);
                if (p == null) return;

                // Verbose per-packet logging removed — was flooding UI at 60Hz

                if (controllerMapping?.Mapping?.Enabled == true && controller != null)
                {
                    lock (_processingLock)
                    {
                        try
                        {
                            controller.ResetReport();
                            ProcessButtons(p, controllerMapping.Mapping, controller);
                            ProcessAxes(p, controllerMapping.Mapping, controller);

                            if (p.packetType == "movement")
                            {
                                ProcessSensors(p, controllerMapping.Mapping, controller);
                                gpxTrail.Update(p);
                                _walkedDistance = gpxTrail.DistanceWalkedKm;

                                // Throttle UI updates to ~1Hz to avoid flooding the UI thread
                                var now = DateTime.UtcNow;
                                if (now - _lastWalkedDistanceUpdate >= _walkedDistanceInterval)
                                {
                                    _lastWalkedDistanceUpdate = now;
                                    _window?.SendWebMessage(JsonConvert.SerializeObject(new { type = "walked_distance", value = _walkedDistance }));
                                }
                            }
                            else if (p.packetType == "command")
                            {
                                ProcessCommand(p, controller);
                            }

                            // Throttle SubmitReport to ~120Hz max to prevent ViGEm driver BSOD
                            var submitNow = DateTime.UtcNow;
                            if (submitNow - _lastSubmitTime >= _minSubmitInterval)
                            {
                                _lastSubmitTime = submitNow;
                                controller.SubmitReport();
                            }
                        }
                        catch (Exception ex)
                        {
                            Log($"!!---- ERROR processing packet ----!!");
                            Log($"Error: {ex.Message}");
                            Log($"Stack Trace: {ex.StackTrace ?? "No stack trace available"}");
                            Log($"Packet causing error: {data}");
                            Log($"!!---------------------------------!!");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"Error handling write: {ex.Message}");
            }
        }

        private double _walkedDistance = 0.0;

        private void ProcessCommand(Packet p, IXbox360Controller controller)
        {
            if (p.payload.TryGetValue("command", out var commandObj))
            {
                var commandStr = commandObj?.ToString()?.ToLower();
                if (commandStr == "screenshot")
                {
                    CaptureScreen();
                }
                else if (commandStr == "pause")
                {
                    // Press Start, submit, then release after delay — outside the main lock
                    controller.SetButtonState(Xbox360Button.Start, true);
                    controller.SubmitReport();
                    _ = Task.Run(async () =>
                    {
                        await Task.Delay(50);
                        lock (_processingLock)
                        {
                            controller.SetButtonState(Xbox360Button.Start, false);
                            controller.SubmitReport();
                        }
                    });
                    Log("Game Paused");
                }
            }
        }

        private void CaptureScreen()
        {
            if (Screen.PrimaryScreen == null) { Log("Primary screen is null"); return; }

            try
            {
                // 1. Capture screen
                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                using var bitmap = new Bitmap(bounds.Width, bounds.Height);
                using (var g = Graphics.FromImage(bitmap))
                    g.CopyFromScreen(Point.Empty, Point.Empty, bounds.Size);

                string dir = ResolveDirectory(
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "screenshots"));
                string filePath = Path.Combine(dir,
                    $"screenshot_{DateTime.Now:yyyyMMdd_HHmmssfff}.jpg");

                bitmap.Save(filePath, ImageFormat.Jpeg);

                // 2. Write GPS EXIF directly into the saved JPEG
                var (lat, lon) = gpxTrail.CurrentPosition;
                WriteGpsToImage(filePath, lat, lon);

                // 3. Register waypoint in GPX
                gpxTrail.AddScreenshot(filePath);
                Log($"[Screenshot] Saved + GPS tagged → {Path.GetFileName(filePath)}");
            }
            catch (Exception ex)
            {
                Log($"[Screenshot] Error: {ex.Message}");
            }
        }

        private static void WriteGpsToImage(string filePath, double lat, double lon)
        {
            try
            {
                var file = ImageFile.FromFile(filePath);
                file.SetGPSCoords((float)lat, (float)lon);
                file.Properties.Set(ExifTag.DateTimeOriginal, DateTime.UtcNow);
                file.Save(filePath);
                Console.WriteLine($"[EXIF] GPS written: ({lat:F6}, {lon:F6})");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EXIF] Failed: {ex.Message}");
            }
        }

        private static string ResolveDirectory(string primary)
        {
            try
            {
                Directory.CreateDirectory(primary);
                string test = Path.Combine(primary, ".writetest");
                File.WriteAllText(test, ""); File.Delete(test);
                return primary;
            }
            catch
            {
                string fallback = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "PCServer", "screenshots");
                Directory.CreateDirectory(fallback);
                return fallback;
            }
        }


        public void StartNewTrail(Double startLat, double startLon)
        {
            gpxTrail = new GpxTrail();
            gpxTrail.SetStartPoint(startLat, startLon);
            gpxTrail.GenerateTrail();
        }

        public void ExportGpx()
        {
            // gpxTrail.AddMetadata("WalkedDistance", _walkedDistance.ToString());

            string gpxPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "gpx");
            try
            {
                Directory.CreateDirectory(gpxPath);
            }
            catch (UnauthorizedAccessException)
            {
                gpxPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PCServer", "gpx");
                Directory.CreateDirectory(gpxPath);
                Log($"Base directory not writable; falling back to {gpxPath}");
            }
            catch (Exception ex)
            {
                gpxPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PCServer", "gpx");
                Directory.CreateDirectory(gpxPath);
                Log($"Could not create gpx directory in base dir: {ex.Message}. Falling back to {gpxPath}");
            }

            string fileName = $"gpx_{DateTime.Now:yyyyMMdd_HHmmssfff}.gpx";
            string filePath = Path.Combine(gpxPath, fileName);
            gpxTrail.Export(filePath);
        }

        private void ProcessButtons(Packet p, MappingConfig mapping, IXbox360Controller controller)
        {
            if (mapping.ButtonMap == null || !p.payload.ContainsKey("buttons")) return;

            var buttons = JObject.FromObject(p.payload["buttons"]).ToObject<Dictionary<string, bool>>();
            if (buttons == null) return;

            foreach (var buttonEntry in buttons)
            {
                if (mapping.ButtonMap.TryGetValue(buttonEntry.Key, out var targetButtonStr))
                {
                    if (targetButtonStr == null) continue;

                    switch (targetButtonStr.ToLower())
                    {
                        case "a": controller.SetButtonState(Xbox360Button.A, buttonEntry.Value); break;
                        case "b": controller.SetButtonState(Xbox360Button.B, buttonEntry.Value); break;
                        case "x": controller.SetButtonState(Xbox360Button.X, buttonEntry.Value); break;
                        case "y": controller.SetButtonState(Xbox360Button.Y, buttonEntry.Value); break;
                        case "leftshoulder": controller.SetButtonState(Xbox360Button.LeftShoulder, buttonEntry.Value); break;
                        case "rightshoulder": controller.SetButtonState(Xbox360Button.RightShoulder, buttonEntry.Value); break;
                        case "leftthumb": controller.SetButtonState(Xbox360Button.LeftThumb, buttonEntry.Value); break;
                        case "rightthumb": controller.SetButtonState(Xbox360Button.RightThumb, buttonEntry.Value); break;
                        case "start": controller.SetButtonState(Xbox360Button.Start, buttonEntry.Value); break;
                        case "back": controller.SetButtonState(Xbox360Button.Back, buttonEntry.Value); break;
                        case "up": controller.SetButtonState(Xbox360Button.Up, buttonEntry.Value); break;
                        case "down": controller.SetButtonState(Xbox360Button.Down, buttonEntry.Value); break;
                        case "left": controller.SetButtonState(Xbox360Button.Left, buttonEntry.Value); break;
                        case "right": controller.SetButtonState(Xbox360Button.Right, buttonEntry.Value); break;
                        case "lefttrigger": controller.LeftTrigger = buttonEntry.Value ? (byte)255 : (byte)0; break;
                        case "righttrigger": controller.RightTrigger = buttonEntry.Value ? (byte)255 : (byte)0; break;
                    }
                }
            }
        }

        private void ProcessAxes(Packet p, MappingConfig mapping, IXbox360Controller controller)
        {
            if (mapping.AxisMap == null) return;

            foreach (var axisEntry in mapping.AxisMap)
            {
                var axisConfig = axisEntry.Value;
                if (axisConfig.Mode == "tilt")
                {
                    if (!p.payload.TryGetValue("x", out var rawX) ||
                        !p.payload.TryGetValue("y", out var rawY) ||
                        !p.payload.TryGetValue("z", out var rawZ))
                    {
                        continue;
                    }

                    float ax = Convert.ToSingle(rawX);
                    float ay = Convert.ToSingle(rawY);
                    float az = Convert.ToSingle(rawZ);

                    float magnitude = MathF.Sqrt(ax * ax + ay * ay + az * az);
                    if (magnitude < 0.0001f) continue;

                    float rawSteering = 0f;
                    string steerSource = axisConfig.Source ?? "x";
                    if (steerSource == "x") rawSteering = ax / magnitude;
                    else if (steerSource == "y") rawSteering = ay / magnitude;
                    else if (steerSource == "z") rawSteering = az / magnitude;

                    float targetSteering = 0f;
                    float deadZone = (float)axisConfig.Deadzone;
                    if (deadZone >= 1.0f)
                    {
                        Log($"Warning: Deadzone for {axisEntry.Key} is {deadZone}, which is >= 1.0. This will result in no input. Clamping to 0.999f for calculation.");
                        deadZone = 0.999f;
                    }

                    float absSteering = Math.Abs(rawSteering);
                    if (absSteering > deadZone)
                    {
                        targetSteering = (absSteering - deadZone) / (1.0f - deadZone);
                        targetSteering *= Math.Sign(rawSteering);
                    }

                    float maxTilt = (float)axisConfig.Scale;
                    if (maxTilt <= 0)
                    {
                        Log($"Warning: Scale (MaxTilt) for {axisEntry.Key} is {maxTilt}. A non-positive value is invalid. Defaulting to 1.0.");
                        maxTilt = 1.0f;
                    }
                    targetSteering = Math.Clamp(targetSteering / maxTilt, -1f, 1f);

                    if (!smoothedAxisValues.ContainsKey(axisEntry.Key))
                    {
                        smoothedAxisValues[axisEntry.Key] = 0f;
                    }

                    smoothedAxisValues[axisEntry.Key] = Lerp(smoothedAxisValues[axisEntry.Key], targetSteering, (float)axisConfig.Smoothing);

                    if (axisConfig.Invert)
                    {
                        smoothedAxisValues[axisEntry.Key] *= -1;
                    }

                    float steering = smoothedAxisValues[axisEntry.Key];


                    short axisValue = (short)(smoothedAxisValues[axisEntry.Key] * 32767.0f);
                    SetControllerValue(controller, axisConfig.Target, axisValue);
                }
                else
                {
                    // Original logic for non-tilt axes
                    if (axisConfig.Source != null && p.payload.TryGetValue(axisConfig.Source, out var rawValue))
                    {
                        var value = Convert.ToDouble(rawValue);

                        if (Math.Abs(value) < axisConfig.Deadzone)
                        {
                            value = 0;
                        }

                        value *= axisConfig.Scale;

                        if (axisConfig.Invert)
                        {
                            value = -value;
                        }

                        if (axisConfig.Clamp != null && axisConfig.Clamp.Count == 2)
                        {
                            value = Math.Max(axisConfig.Clamp[0], Math.Min(axisConfig.Clamp[1], value));
                        }

                        short axisValue = (short)(value * 32767.0);
                        SetControllerValue(controller, axisConfig.Target, axisValue);
                    }
                }
            }
        }

        private static float Lerp(float a, float b, float t)
        {
            return a + (b - a) * t;
        }

        private Dictionary<string, double> lastSensorValues = new Dictionary<string, double>();

        private void ProcessSensors(Packet p, MappingConfig mapping, IXbox360Controller controller)
        {
            if (mapping.SensorMap == null) return;

            foreach (var sensorEntry in mapping.SensorMap)
            {
                var sensorKey = sensorEntry.Key;
                var sensorConfig = sensorEntry.Value;

                object? rawValue;
                bool foundInPayload = p.payload.TryGetValue(sensorKey, out rawValue);
                if (!foundInPayload)
                {
                    Log($"[SENSOR] '{sensorKey}' NOT FOUND in payload"); // <-- add this
                    rawValue = 0.0;
                }

                var value = Convert.ToDouble(rawValue);
                Log($"[SENSOR] {sensorKey} = {value}");
                //if (!p.payload.TryGetValue(sensorKey, out rawValue))
                //{
                //    // If a sensor in the map is not found in the payload,
                //    // we should treat its value as 0 to process release/off states.
                //    rawValue = 0.0;
                //}

                //var value = Convert.ToDouble(rawValue);

                if (sensorConfig.Mode == "toggle")
                {
                    Log($"[SENSOR] {sensorKey} = {value}, state = {sensorToggleStates.GetValueOrDefault(sensorKey)}");
                    if (!sensorToggleStates.ContainsKey(sensorKey))
                    {
                        sensorToggleStates[sensorKey] = false;
                    }

                    if (sensorConfig.Thresholds != null &&
                        sensorConfig.Thresholds.TryGetValue("start", out var startThreshold) &&
                        sensorConfig.Thresholds.TryGetValue("stop", out var stopThreshold))
                    {
                        if (!sensorToggleStates[sensorKey] && value >= startThreshold)
                        {
                            sensorToggleStates[sensorKey] = true;
                        }
                        else if (sensorToggleStates[sensorKey] && value < stopThreshold)
                        {
                            sensorToggleStates[sensorKey] = false;
                        }
                    }

                    byte triggerValue = sensorToggleStates[sensorKey] ? (byte)255 : (byte)0;
                    SetControllerValue(controller, sensorConfig.Target, triggerValue);
                }
                else // Default to "axis" mode
                {
                    // Apply deadzone
                    if (Math.Abs(value) < sensorConfig.Deadzone)
                    {
                        value = 0;
                    }

                    // Normalize value to 0-1 range based on min/max
                    double normalizedValue = (value - sensorConfig.MinValue) / (sensorConfig.MaxValue - sensorConfig.MinValue);
                    normalizedValue = Math.Max(0.0, Math.Min(1.0, normalizedValue)); // Clamp to 0-1

                    // Apply response curve
                    if (sensorConfig.ResponseCurve?.ToLower() == "quadratic")
                    {
                        normalizedValue = normalizedValue * normalizedValue;
                    }

                    // Scale to byte for trigger
                    byte triggerValue = (byte)(normalizedValue * 255);

                    SetControllerValue(controller, sensorConfig.Target, triggerValue);
                }
            }
        }

        private void SetControllerValue(IXbox360Controller controller, string? target, object value)
        {
            if (target == null) return;

            switch (target.ToLower())
            {
                // Axes (short) — use Convert.ToInt16 to avoid InvalidCastException on boxed type mismatch
                case "leftstickx":
                    controller.LeftThumbX = Convert.ToInt16(value);
                    break;
                case "leftsticky":
                    controller.LeftThumbY = Convert.ToInt16(value);
                    break;
                case "rightstickx":
                    controller.RightThumbX = Convert.ToInt16(value);
                    break;
                case "rightsticky":
                    controller.RightThumbY = Convert.ToInt16(value);
                    break;

                // Triggers (byte) — use Convert.ToByte to avoid InvalidCastException on boxed type mismatch
                case "lefttrigger":
                    controller.LeftTrigger = Convert.ToByte(value);
                    break;
                case "righttrigger":
                    controller.RightTrigger = Convert.ToByte(value);
                    break;

                // Buttons
                case "a":
                    controller.SetButtonState(Xbox360Button.A, Convert.ToBoolean(value));
                    break;
                case "b":
                    controller.SetButtonState(Xbox360Button.B, Convert.ToBoolean(value));
                    break;
                case "x":
                    controller.SetButtonState(Xbox360Button.X, Convert.ToBoolean(value));
                    break;
                case "y":
                    controller.SetButtonState(Xbox360Button.Y, Convert.ToBoolean(value));
                    break;
                case "leftshoulder":
                    controller.SetButtonState(Xbox360Button.LeftShoulder, Convert.ToBoolean(value));
                    break;
                case "rightshoulder":
                    controller.SetButtonState(Xbox360Button.RightShoulder, Convert.ToBoolean(value));
                    break;
                case "leftstick":
                    controller.SetButtonState(Xbox360Button.LeftThumb, Convert.ToBoolean(value));
                    break;
                case "rightstick":
                    controller.SetButtonState(Xbox360Button.RightThumb, Convert.ToBoolean(value));
                    break;
                case "start":
                    controller.SetButtonState(Xbox360Button.Start, Convert.ToBoolean(value));
                    break;
                case "back":
                    controller.SetButtonState(Xbox360Button.Back, Convert.ToBoolean(value));
                    break;
                case "up":
                    controller.SetButtonState(Xbox360Button.Up, Convert.ToBoolean(value));
                    break;
                case "down":
                    controller.SetButtonState(Xbox360Button.Down, Convert.ToBoolean(value));
                    break;
                case "left":
                    controller.SetButtonState(Xbox360Button.Left, Convert.ToBoolean(value));
                    break;
                case "right":
                    controller.SetButtonState(Xbox360Button.Right, Convert.ToBoolean(value));
                    break;
            }
        }

        private string GetJsonFromFile()
        {
            var filePath = string.Empty;

            Thread thread = new Thread(() =>
            {
                using (OpenFileDialog openFileDialog = new OpenFileDialog())
                {
                    openFileDialog.InitialDirectory = "c:";
                    openFileDialog.Filter = "json files (*.json)|*.json|All files (*.*)|*.*";
                    openFileDialog.FilterIndex = 1;
                    openFileDialog.RestoreDirectory = true;

                    if (openFileDialog.ShowDialog() == DialogResult.OK)
                    {
                        filePath = openFileDialog.FileName;
                    }
                }
            });

            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();

            if (string.IsNullOrEmpty(filePath))
            {
                return string.Empty;
            }

            return File.ReadAllText(filePath);
        }


    }
}
