using Photino.NET;
using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Newtonsoft.Json.Linq;

namespace Backend
{
    class Program
    {
        private static IController? _activeController;
        private static GattManager _gattManager = new GattManager();
        private static CustomPluginController _customPluginController = new CustomPluginController(_gattManager);
        private static VigemController _vigemController = new VigemController();
        private static PhotinoWindow? _window;

        [STAThread]
        static void Main(string[] args)
        {
            _window = new PhotinoWindow()
                .SetTitle("BlueStep Connect PC Receiver")
                .SetUseOsDefaultSize(false)
                .SetSize(1024, 768)
                .Center();

            _gattManager.SetWindow(_window);
            _customPluginController.SetWindow(_window);
            _vigemController.SetWindow(_window);

            _gattManager.OnDataReceived += (sender, data) =>
            {
                _activeController?.ProcessData(data);
            };

            _gattManager.OnControllerConnectionChanged += (connected) =>
            {
                if (_activeController != _customPluginController) return;

                if (connected)
                {
                    WebSocketHost.Start();
                    WebSocketHost.Broadcast(new { type = "command", value = "controller_connected" });
                }
                else
                {
                    WebSocketHost.Broadcast(new { type = "command", value = "controller_disconnected" });
                    WebSocketHost.Stop();
                }
            };

            _window.RegisterWebMessageReceivedHandler(async (object? sender, string message) =>
            {
                var photinoWindow = sender as PhotinoWindow;
                if (photinoWindow == null) return;

                var json = JObject.Parse(message);
                var action = json["action"]?.ToString();

                switch (action)
                {
                    case "startServer":
                        await _gattManager.StartServerAsync();
                        photinoWindow.SendWebMessage(JsonSerializer.Serialize(new { type = "status", gattStatus = "started" }));
                        break;

                    case "stopServer":
                        await _gattManager.StopServer();
                        _activeController?.Deactivate();
                        _activeController = null;
                        photinoWindow.SendWebMessage(JsonSerializer.Serialize(new { type = "status", gattStatus = "stopped", activeMode = "", connected = false }));
                        break;

                    case "activateMode":
                        var mode = json["mode"]?.ToString();
                        _activeController?.Deactivate();

                        if (mode == "vigem")
                        {
                            _activeController = _vigemController;
                        }
                        else
                        {
                            _activeController = _customPluginController;
                        }
                        _activeController.Activate();
                        photinoWindow.SendWebMessage(JsonSerializer.Serialize(new { type = "status", activeMode = mode }));
                        break;

                    case "deactivateMode":
                        _activeController?.Deactivate();
                        _activeController = null;
                        photinoWindow.SendWebMessage(JsonSerializer.Serialize(new { type = "status", activeMode = "" }));
                        break;

                    case "sendLayout":
                        _customPluginController.SendLayout();
                        break;
                    
                    case "sendLayoutWithoutWindow":
                        var layout = json["layout"]?.ToString();
                        if (!string.IsNullOrEmpty(layout))
                        {
                            _customPluginController.SendLayoutWithoutWindow(layout);
                        }
                        break;
                    case "saveGamepadJson":
                        var jsonLayout = json["layout"]?.ToString();
                        var requestedFileName = json["fileName"]?.ToString() ?? "gamepad.json";
                        if (!string.IsNullOrEmpty(jsonLayout))
                        {
                            try
                            {
                                var savedPath = SaveGamepadJsonFile(jsonLayout, requestedFileName);
                                if (!string.IsNullOrEmpty(savedPath))
                                {
                                    photinoWindow.SendWebMessage(JsonSerializer.Serialize(new { type = "saveStatus", status = "success", filePath = savedPath }));
                                }
                                else
                                {
                                    photinoWindow.SendWebMessage(JsonSerializer.Serialize(new { type = "saveStatus", status = "cancelled" }));
                                }
                            }
                            catch (Exception ex)
                            {
                                photinoWindow.SendWebMessage(JsonSerializer.Serialize(new { type = "saveStatus", status = "error", error = ex.Message }));
                            }
                        }
                        break;
                    case "exportGpx":
                        _vigemController.ExportGpx();
                        break;
                    case "startGpx":
                        var payload = json["payload"];
                        if (payload != null)
                        {
                            var lat = payload["lat"]?.ToObject<double>() ?? 0.0;
                            var lng = payload["lng"]?.ToObject<double>() ?? 0.0;
                            _vigemController.StartNewTrail(lat, lng);
                        }
                        break;
                }
            });

#if DEBUG
            _window.Load("http://localhost:5173");
#else
            string exeDir = AppContext.BaseDirectory;
            string startFile = Path.Combine(exeDir, "wwwroot", "index.html");
            _window.Load(startFile);
#endif

            _window.WaitForClose();
        }

        private static string SaveGamepadJsonFile(string json, string defaultFileName)
        {
            var filePath = ShowSaveFileDialog(defaultFileName);
            if (string.IsNullOrEmpty(filePath))
            {
                return string.Empty;
            }

            File.WriteAllText(filePath, json);
            return filePath;
        }

        private static string ShowSaveFileDialog(string defaultFileName)
        {
            var filePath = string.Empty;

            var thread = new Thread(() =>
            {
                using var saveFileDialog = new SaveFileDialog
                {
                    InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
                    FilterIndex = 1,
                    RestoreDirectory = true,
                    DefaultExt = "json",
                    FileName = defaultFileName,
                };

                if (saveFileDialog.ShowDialog() == DialogResult.OK)
                {
                    filePath = saveFileDialog.FileName;
                }
            });

            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();

            return filePath;
        }
    }
}
