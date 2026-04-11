using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Threading;
using System.Windows.Forms;

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
        private int steps;
        private long lastTimestamp;
        
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
        }

        public void Deactivate()
        {
            Log("Custom Plugin Controller Deactivated");
            WebSocketHost.Stop();
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

                        WebSocketHost.Broadcast(new
                        {
                            type = "movement",
                            x = ax,
                            y = ay,
                            z = az,
                            steps = steps,
                            buttons = buttonState,
                            timestamp = ts
                        });
                        break;


                    case "command":
                        if(p.payload.TryGetValue("command", out var command) && command != null)
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
