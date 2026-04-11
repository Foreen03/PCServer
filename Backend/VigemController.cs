using Nefarius.ViGEm.Client;
using Nefarius.ViGEm.Client.Targets;
using Nefarius.ViGEm.Client.Targets.Xbox360;
using Newtonsoft.Json;
using System.IO;
using System.Windows.Forms;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Threading;
using Photino.NET;

namespace Backend
{
    public class VigemController : IController
    {
        private PhotinoWindow? _window;
        private ViGEmClient? vigemClient;
        private IXbox360Controller? controller;
        private ControllerMapping? controllerMapping;
        
        private Dictionary<string, bool> sensorToggleStates = new Dictionary<string, bool>();

        private static readonly object _processingLock = new object();

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
                Log($"Error initializing ViGEm client: {ex.Message}");
                return;
            }
        }

        public void Deactivate()
        {
            Log("Vigem Controller Deactivated");
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
                            }

                            controller.SubmitReport();
                        }
                        catch (Exception ex)
                        {
                            Log($"!!---- ERROR processing packet ----!!");
                            Log($"Error: {ex.Message}");
                            Log($"Stack Trace: {ex.StackTrace}");
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
                if (axisConfig.Source == null) continue;

                if (p.payload.TryGetValue(axisConfig.Source, out var rawValue))
                {
                    var value = Convert.ToDouble(rawValue);

                    // 1. Apply deadzone
                    if (Math.Abs(value) < axisConfig.Deadzone)
                    {
                        value = 0;
                    }

                    // 2. Apply scale
                    value *= axisConfig.Scale;

                    // 3. Apply inversion
                    if (axisConfig.Invert)
                    {
                        value = -value;
                    }

                    // 4. Clamp value
                    if (axisConfig.Clamp != null && axisConfig.Clamp.Count == 2)
                    {
                        value = Math.Max(axisConfig.Clamp[0], Math.Min(axisConfig.Clamp[1], value));
                    }

                    // 5. Convert to short for controller axis
                    short axisValue = (short)(value * 32767.0);

                    SetControllerValue(controller, axisConfig.Target, axisValue);
                }
            }
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
            
            switch (target)
            {
                // Axes (short)
                case "LeftStickX":
                    controller.LeftThumbX = (short)value;
                    break;
                case "LeftStickY":
                    controller.LeftThumbY = (short)value;
                    break;
                case "RightStickX":
                    controller.RightThumbX = (short)value;
                    break;
                case "RightStickY":
                    controller.RightThumbY = (short)value;
                    break;

                // Triggers (byte)
                case "LeftTrigger":
                    controller.LeftTrigger = (byte)value;
                    break;
                case "RightTrigger":
                    controller.RightTrigger = (byte)value;
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
