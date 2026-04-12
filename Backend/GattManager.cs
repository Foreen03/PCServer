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
        private int connectedDeviceCount = 0;
        private readonly SemaphoreSlim _notifyLock = new SemaphoreSlim(1, 1);
        
        public event EventHandler<string>? OnDataReceived;

        private System.Threading.Timer? heartbeatTimer;
        private const int heartbeatDelay = 1000;


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

                var advParams = new GattServiceProviderAdvertisingParameters
                {
                    IsDiscoverable = true,
                    IsConnectable = true
                };

                serviceProvider.StartAdvertising(advParams);
                
                Log("GATT Server started and advertising...");
                Log("Please connect a BLE client from your device.");
            }
            catch (Exception ex)
            {
                Log($"Error starting server: {ex.Message}");
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
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] DEVICE CONNECTED. Total: {currentCount}");
                if (currentCount > 0 && heartbeatTimer == null)
                {
                    Log("Starting heartbeat...");
                    heartbeatTimer = new System.Threading.Timer(async _ =>
                    {
                        await SendHeartbeat();
                    }, null, 0, heartbeatDelay);
                }
            }
            else if (currentCount < connectedDeviceCount)
            {
                Log($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] DEVICE DISCONNECTED. Total: {currentCount}");
                if (currentCount == 0 && heartbeatTimer != null)
                {
                    Log("Stopping heartbeat...");
                    heartbeatTimer.Dispose();
                    heartbeatTimer = null;
                }
            }

            connectedDeviceCount = currentCount;
            _window?.SendWebMessage(JsonConvert.SerializeObject(new { type = "status", connected = currentCount > 0, count = currentCount }));
        }

        public Task StopServer()
        {
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
