using System;
using System.Threading.Tasks;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;
using Newtonsoft.Json;
using Photino.NET;
using System.Threading;

namespace Backend
{
    public class GattManager
    {
        private PhotinoWindow? _window;
        private GattServiceProvider? serviceProvider;
        private GattLocalCharacteristic? readCharacteristic;
        private GattLocalCharacteristic? writeCharacteristic;
        private GattLocalCharacteristic? notifyCharacteristic;

        // Custom service and characteristic UUIDs
        private static readonly Guid SERVICE_UUID = Guid.Parse("12345678-1234-5678-1234-56789abcdef0");
        private static readonly Guid READ_CHAR_UUID = Guid.Parse("12345678-1234-5678-1234-56789abcdef1");
        private static readonly Guid WRITE_CHAR_UUID = Guid.Parse("12345678-1234-5678-1234-56789abcdef2");
        private static readonly Guid NOTIFY_CHAR_UUID = Guid.Parse("12345678-1234-5678-1234-56789abcdef3");

        private string currentValue = "Hello BLE";
        private volatile int connectedDeviceCount = 0;
        private readonly SemaphoreSlim _notifyLock = new SemaphoreSlim(1, 1);

        public event EventHandler<string>? OnDataReceived;

        private System.Threading.Timer? heartbeatTimer;
        private const int heartbeatDelay = 1000;
        public event Action<bool>? OnControllerConnectionChanged;

        // Reconnection detection: track whether we believe a device is connected
        private volatile bool _isConnected = false;
        // Timer to periodically poll SubscribedClients as a fallback
        private System.Threading.Timer? _connectionPollTimer;
        private const int CONNECTION_POLL_INTERVAL_MS = 2000;

        public async Task NotifyValueChanged(string value)
        {
            if (notifyCharacteristic != null && notifyCharacteristic.SubscribedClients.Count > 0)
            {
                await _notifyLock.WaitAsync();

                try
                {
                    string messageToSend = value + "\u0000";
                    const int chunkSize = 240;

                    for (int i = 0; i < messageToSend.Length; i += chunkSize)
                    {
                        string chunk = messageToSend.Substring(i, Math.Min(chunkSize, messageToSend.Length - i));

                        var writer = new DataWriter();
                        writer.WriteString(chunk);

                        await notifyCharacteristic.NotifyValueAsync(writer.DetachBuffer());

                        await Task.Delay(20);
                    }
                }
                catch (Exception ex)
                {
                    Log($"Error notifying value: {ex.Message}");
                }
                finally
                {
                    _notifyLock.Release();
                }
            }
        }


        public void SetWindow(PhotinoWindow window)
        {
            _window = window;
        }

        private void Log(string message)
        {
            _window?.SendWebMessage(JsonConvert.SerializeObject(new { type = "log", message }));
        }

        public async Task StartServerAsync()
        {
            try
            {
                var serviceResult = await GattServiceProvider.CreateAsync(SERVICE_UUID);

                if (serviceResult.Error != BluetoothError.Success)
                {
                    Log($"Failed to create service: {serviceResult.Error}");
                    return;
                }

                serviceProvider = serviceResult.ServiceProvider;

                var readParams = new GattLocalCharacteristicParameters
                {
                    CharacteristicProperties = GattCharacteristicProperties.Read,
                    ReadProtectionLevel = GattProtectionLevel.Plain
                };

                var readCharResult = await serviceProvider.Service.CreateCharacteristicAsync(
                    READ_CHAR_UUID,
                    readParams
                );

                if (readCharResult.Error != BluetoothError.Success)
                {
                    Log($"Failed to create read characteristic: {readCharResult.Error}");
                    return;
                }

                readCharacteristic = readCharResult.Characteristic;
                readCharacteristic.ReadRequested += OnReadRequested;

                var writeParams = new GattLocalCharacteristicParameters
                {
                    CharacteristicProperties = GattCharacteristicProperties.WriteWithoutResponse,
                    WriteProtectionLevel = GattProtectionLevel.Plain
                };

                var writeCharResult = await serviceProvider.Service.CreateCharacteristicAsync(
                    WRITE_CHAR_UUID,
                    writeParams
                );

                if (writeCharResult.Error != BluetoothError.Success)
                {
                    Log($"Failed to create write characteristic: {writeCharResult.Error}");
                    return;
                }

                writeCharacteristic = writeCharResult.Characteristic;
                writeCharacteristic.WriteRequested += OnWriteRequested;

                var notifyParams = new GattLocalCharacteristicParameters
                {
                    CharacteristicProperties = GattCharacteristicProperties.Notify,
                    ReadProtectionLevel = GattProtectionLevel.Plain
                };

                var notifyCharResult = await serviceProvider.Service.CreateCharacteristicAsync(
                    NOTIFY_CHAR_UUID, notifyParams);

                if (notifyCharResult.Error != BluetoothError.Success)
                {
                    Log($"Failed to create notify characteristic: {notifyCharResult.Error}");
                    return;
                }

                notifyCharacteristic = notifyCharResult.Characteristic;
                notifyCharacteristic.SubscribedClientsChanged += OnSubscribedClientsChanged;

                StartAdvertising();

                // Start polling SubscribedClients.Count as a fallback for missed events
                _connectionPollTimer = new System.Threading.Timer(_ => PollConnectionState(), null,
                    CONNECTION_POLL_INTERVAL_MS, CONNECTION_POLL_INTERVAL_MS);

                Log("GATT Server started and advertising...");
                Log("Please connect a BLE client from your device.");
            }
            catch (Exception ex)
            {
                Log($"Error starting server: {ex.Message}");
            }
        }

        /// <summary>
        /// Start or restart BLE advertising so clients can discover and connect.
        /// </summary>
        private void StartAdvertising()
        {
            if (serviceProvider == null) return;

            try
            {
                // Stop first if already advertising (required before restarting)
                if (serviceProvider.AdvertisementStatus == GattServiceProviderAdvertisementStatus.Started)
                {
                    serviceProvider.StopAdvertising();
                }

                var advParams = new GattServiceProviderAdvertisingParameters
                {
                    IsDiscoverable = true,
                    IsConnectable = true
                };

                serviceProvider.StartAdvertising(advParams);
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Advertising started/restarted.");
            }
            catch (Exception ex)
            {
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Error starting advertising: {ex.Message}");
            }
        }

        /// <summary>
        /// Periodically polls SubscribedClients.Count to catch connection/disconnection
        /// events that the OnSubscribedClientsChanged callback may have missed.
        /// </summary>
        private void PollConnectionState()
        {
            if (notifyCharacteristic == null) return;

            try
            {
                int currentCount = notifyCharacteristic.SubscribedClients.Count;
                bool wasConnected = _isConnected;
                bool nowConnected = currentCount > 0;

                if (nowConnected && !wasConnected)
                {
                    // Missed a connection event — handle reconnection
                    Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [POLL] Detected reconnection (subscribers: {currentCount})");
                    HandleDeviceConnected(currentCount);
                }
                else if (!nowConnected && wasConnected)
                {
                    // Missed a disconnection event
                    Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [POLL] Detected disconnection (subscribers: {currentCount})");
                    HandleDeviceDisconnected(currentCount);
                }
            }
            catch (Exception ex)
            {
                // Polling should never crash the app
                Console.WriteLine($"[GattManager] Poll error: {ex.Message}");
            }
        }

        private async void OnReadRequested(
            GattLocalCharacteristic sender,
            GattReadRequestedEventArgs args
        )
        {
            var deferral = args.GetDeferral();

            try
            {
                var request = await args.GetRequestAsync();
                var writer = new DataWriter();
                writer.WriteString(currentValue);

                request.RespondWithValue(writer.DetachBuffer());
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Read request: Sent '{currentValue}'");
            }
            catch (Exception ex)
            {
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Error handling read: {ex.Message}");
            }
            finally
            {
                deferral.Complete();
            }
        }

        private async void OnWriteRequested(
            GattLocalCharacteristic sender,
            GattWriteRequestedEventArgs args)
        {
            var deferral = args.GetDeferral();

            try
            {
                var request = await args.GetRequestAsync();
                var reader = DataReader.FromBuffer(request.Value);
                var receivedValue = reader.ReadString(request.Value.Length);

                currentValue = receivedValue;
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] MESSAGE RECEIVED: {receivedValue}");

                // Reconnection detection: if we receive data but think we're disconnected,
                // the phone has reconnected and we missed the SubscribedClientsChanged event.
                if (!_isConnected)
                {
                    Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [WRITE] Detected reconnection via incoming data");
                    int subCount = notifyCharacteristic?.SubscribedClients.Count ?? 0;
                    HandleDeviceConnected(Math.Max(subCount, 1));
                }

                OnDataReceived?.Invoke(this, receivedValue);

                if (request.Option == GattWriteOption.WriteWithResponse)
                {
                    request.Respond();
                }
            }
            catch (Exception ex)
            {
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Error handling write: {ex.Message}");
            }
            finally
            {
                deferral.Complete();
            }
        }

        private void OnSubscribedClientsChanged(GattLocalCharacteristic sender, object args)
        {
            int currentCount = sender.SubscribedClients.Count;

            if (currentCount > connectedDeviceCount)
            {
                HandleDeviceConnected(currentCount);
            }
            else if (currentCount < connectedDeviceCount)
            {
                HandleDeviceDisconnected(currentCount);
            }

            connectedDeviceCount = currentCount;
        }

        /// <summary>
        /// Centralized handler for when a device connects or reconnects.
        /// Safe to call multiple times — it's a no-op if already connected.
        /// </summary>
        private void HandleDeviceConnected(int currentCount)
        {
            if (_isConnected) return; // Already connected, avoid duplicate notifications

            _isConnected = true;
            connectedDeviceCount = currentCount;

            Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] DEVICE CONNECTED. Total: {currentCount}");

            if (heartbeatTimer == null)
            {
                Log("Starting heartbeat...");
                heartbeatTimer = new System.Threading.Timer(async _ =>
                {
                    await SendHeartbeat();
                }, null, 0, heartbeatDelay);
            }

            WebSocketHost.Broadcast(new { type = "command", value = "controller_connected" });
            _window?.SendWebMessage(JsonConvert.SerializeObject(new { type = "status", connected = true, count = currentCount }));
        }

        /// <summary>
        /// Centralized handler for when a device disconnects.
        /// Safe to call multiple times — it's a no-op if already disconnected.
        /// Also restarts advertising so the phone can reconnect.
        /// </summary>
        private void HandleDeviceDisconnected(int currentCount)
        {
            if (!_isConnected) return; // Already disconnected, avoid duplicate notifications

            _isConnected = false;
            connectedDeviceCount = currentCount;

            Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] DEVICE DISCONNECTED. Total: {currentCount}");

            if (heartbeatTimer != null)
            {
                Log("Stopping heartbeat...");
                heartbeatTimer.Dispose();
                heartbeatTimer = null;
            }

            WebSocketHost.Broadcast(new { type = "command", value = "controller_disconnected" });
            _window?.SendWebMessage(JsonConvert.SerializeObject(new { type = "status", connected = false, count = currentCount }));

            // Restart advertising so the phone can discover and reconnect
            StartAdvertising();
        }

        public Task StopServer()
        {
            if (_connectionPollTimer != null)
            {
                _connectionPollTimer.Dispose();
                _connectionPollTimer = null;
            }

            if (heartbeatTimer != null)
            {
                heartbeatTimer.Dispose();
                heartbeatTimer = null;
            }

            _isConnected = false;
            connectedDeviceCount = 0;

            if (serviceProvider != null && serviceProvider.AdvertisementStatus == GattServiceProviderAdvertisementStatus.Started)
            {
                serviceProvider.StopAdvertising();
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] GATT Server stopped.");
            }
            return Task.CompletedTask;
        }

        private async Task SendHeartbeat()
        {
            var packet = new
            {
                type = "PC_HEARTBEAT",
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            string json = JsonConvert.SerializeObject(packet);
            await NotifyValueChanged(json);
        }
    }
}
