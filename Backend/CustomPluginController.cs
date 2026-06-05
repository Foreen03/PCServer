using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using RedCorners.ExifLibrary;

namespace Backend
{
    public class CustomPluginController : IController
    {
        private Photino.NET.PhotinoWindow? _window;
        private GattManager _gattManager;

        public CustomPluginController(GattManager gattManager)
        {
            _gattManager = gattManager;
        }

        // Semaphore for thread-safe writing to the Notify Characteristic
        private readonly SemaphoreSlim _notifyLock = new SemaphoreSlim(1, 1);

        private Dictionary<string, bool> buttonState = new();
        private float ax, ay, az;
        private float stepsCadence;
        private int steps;
        private long lastTimestamp;

        private GpxTrail gpxTrail = new GpxTrail();

        public void SetWindow(Photino.NET.PhotinoWindow window)
        {
            _window = window;
        }

        private void Log(string message)
        {
            _window?.SendWebMessage(Newtonsoft.Json.JsonConvert.SerializeObject(new { type = "log", message }));
        }

        public void Activate()
        {
            Log("Custom Plugin Controller Activated");
            WebSocketHost.Start();
            WebSocketHost.OnMessageReceived += HandleWebSocketMessage;
        }

        public void Deactivate()
        {
            Log("Custom Plugin Controller Deactivated");
            WebSocketHost.OnMessageReceived -= HandleWebSocketMessage;
            WebSocketHost.Stop();
        }

        private void HandleWebSocketMessage(string rawJson)
        {
            try
            {
                Packet? p = JsonConvert.DeserializeObject<Packet>(rawJson);
                if (p == null || p.packetType != "captureScreen") return;

                // Run on a background thread to avoid blocking the WebSocket message loop
                Task.Run(() =>
                {
                    try
                    {
                        // Determine capture mode: "monitor" (default) or "window"
                        string mode = "monitor";
                        string? windowTitle = null;

                        if (p.payload != null)
                        {
                            if (p.payload.TryGetValue("mode", out var modeObj) && modeObj != null)
                                mode = modeObj.ToString() ?? "monitor";

                            if (p.payload.TryGetValue("title", out var titleObj) && titleObj != null)
                                windowTitle = titleObj.ToString();
                        }

                        System.Drawing.Bitmap? screenshot;

                        if (mode == "window")
                        {
                            if (!string.IsNullOrEmpty(windowTitle))
                            {
                                // Find window by title (partial, case-insensitive match)
                                IntPtr hwnd = ScreenCapture.FindWindowByTitle(windowTitle);
                                if (hwnd != IntPtr.Zero)
                                {
                                    screenshot = ScreenCapture.CaptureWindow(hwnd);
                                }
                                else
                                {
                                    Log($"[ScreenCapture] Window '{windowTitle}' not found, falling back to foreground window.");
                                    screenshot = ScreenCapture.CaptureWindow();
                                }
                            }
                            else
                            {
                                // Auto-detect foreground window
                                screenshot = ScreenCapture.CaptureWindow();
                            }
                        }
                        else
                        {
                            // Full monitor capture (default)
                            screenshot = ScreenCapture.CaptureMonitor();
                        }

                        if (screenshot != null)
                        {
                            // Save to screenshots directory
                            string screenshotDir = System.IO.Path.Combine(
                                AppContext.BaseDirectory, "screenshots");
                            string filePath = ScreenCapture.SaveScreenshot(screenshot, screenshotDir);

                            // Write GPS EXIF directly into the saved JPEG
                            var (lat, lon) = gpxTrail.CurrentPosition;
                            WriteGpsToImage(filePath, lat, lon);

                            // Register waypoint in GPX
                            gpxTrail.AddScreenshot(filePath);

                            // Broadcast a tiny notification (~100 bytes, no image data)
                            WebSocketHost.Broadcast(new
                            {
                                type = "screenshot",
                                path = filePath,
                                width = screenshot.Width,
                                height = screenshot.Height
                            });

                            screenshot.Dispose();
                            Log($"[ScreenCapture] Saved: {filePath}");
                        }
                        else
                        {
                            Log("[ScreenCapture] Capture returned null.");
                        }
                    }
                    catch (Exception captureEx)
                    {
                        Log($"[ScreenCapture] Error: {captureEx.Message}");
                    }
                });
            }
            catch (Exception ex)
            {
                Log($"[ScreenCapture] Error parsing WebSocket message: {ex.Message}");
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

        public void ProcessData(string data)
        {
            try
            {
                // convert json string to object
                Packet? p = JsonConvert.DeserializeObject<Packet>(data);
                if (p == null) return;
                long ts = p.timeStamp;

                switch (p.packetType)
                {
                    case "movement":
                        lock (this)
                        {
                            steps = Convert.ToInt32(p.payload["steps"]);
                            ax = Convert.ToSingle(p.payload["x"]);
                            ay = Convert.ToSingle(p.payload["y"]);
                            az = Convert.ToSingle(p.payload["z"]);
                            stepsCadence = Convert.ToSingle(p.payload["stepsCadence"]);
                            lastTimestamp = ts;

                            if (p.payload.ContainsKey("buttons"))
                            {
                                var buttonsObj = p.payload["buttons"];
                                Dictionary<string, bool> buttons;

                                if (buttonsObj is JObject jObj)
                                {
                                    buttons = jObj.ToObject<Dictionary<string, bool>>() ?? new Dictionary<string, bool>();
                                }
                                else if (buttonsObj is Dictionary<string, bool> dict)
                                {
                                    buttons = dict;
                                }
                                else
                                {
                                    // Try to deserialize as a fallback
                                    buttons = JsonConvert.DeserializeObject<Dictionary<string, bool>>(
                                        JsonConvert.SerializeObject(buttonsObj)) ?? new Dictionary<string, bool>();
                                }

                                if (buttons != null)
                                {
                                    foreach (var kv in buttons)
                                    {
                                        buttonState[kv.Key] = kv.Value;
                                    }
                                }
                            }
                        }

                        gpxTrail.Update(p);

                        WebSocketHost.Broadcast(new
                        {
                            type = "movement",
                            x = ax,
                            y = ay,
                            z = az,
                            steps = steps,
                            stepsCadence = stepsCadence,
                            buttons = buttonState,
                            timestamp = ts
                        });
                        break;


                    case "command":
                        if (p.payload.TryGetValue("command", out var command) && command != null)
                        {
                            WebSocketHost.Broadcast(new
                            {
                                type = "command",
                                value = command.ToString(),
                                timestamp = ts
                            });
                        }
                        break;


                }
            }
            catch (Exception ex)
            {
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Error processing data: {ex.Message}");
            }
        }

        public async void SendLayout()
        {
            var filePath = GetJsonFromFile();
            if (string.IsNullOrEmpty(filePath))
            {
                Log("Error sending layout: File selection cancelled.");
                return;
            }

            try
            {
                string json = System.IO.File.ReadAllText(filePath);
                JObject obj = JObject.Parse(json);

                // ... [Validation logic] ...

                var layoutPacket = new PCPacket
                {
                    type = "GAMEPAD_LAYOUT",
                    timeStamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    data = obj.ToString() // The large JSON content
                };

                string layoutJsonToSend = JsonConvert.SerializeObject(layoutPacket);

                // 2. Prepare the Header Packet (Tell phone how big the data is)
                var headerPacket = new
                {
                    type = "TRANSFER_START",
                    totalLength = layoutJsonToSend.Length
                };

                Log($"Sending Layout... Size: {layoutJsonToSend.Length} bytes");

                // 3. Send Header First
                await _gattManager.NotifyValueChanged(JsonConvert.SerializeObject(headerPacket));

                // 4. Brief pause to ensure phone processes the header
                await System.Threading.Tasks.Task.Delay(100);

                // 5. Send the Actual Data
                await _gattManager.NotifyValueChanged(layoutJsonToSend);

                Log("Layout sent successfully.");
            }
            catch (Exception ex)
            {
                Log($"Error reading/sending layout: {ex.Message}");
            }
        }

        public async void SendLayoutWithoutWindow(string layout)
        {
            if (string.IsNullOrEmpty(layout))
            {
                Log("Layout data is empty.");
                return;
            }

            try
            {
                JObject obj = JObject.Parse(layout);

                var layoutPacket = new PCPacket
                {
                    type = "GAMEPAD_LAYOUT",
                    timeStamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    data = obj.ToString()
                };

                string layoutJsonToSend = JsonConvert.SerializeObject(layoutPacket);

                var headerPacket = new
                {
                    type = "TRANSFER_START",
                    totalLength = layoutJsonToSend.Length
                };

                Log($"Sending Layout... Size: {layoutJsonToSend.Length} bytes");

                await _gattManager.NotifyValueChanged(JsonConvert.SerializeObject(headerPacket));
                await System.Threading.Tasks.Task.Delay(100);
                await _gattManager.NotifyValueChanged(layoutJsonToSend);

                Log("Layout sent successfully.");
            }
            catch (Exception ex)
            {
                Log($"Error sending layout: {ex.Message}");
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

            return filePath;
        }
    }
}
