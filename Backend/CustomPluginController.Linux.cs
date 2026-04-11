#if !WINDOWS

using System.Text;
using Tmds.DBus;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace GattServer
{
    // -------------------------------------------------------------------------
    // D-Bus interface definitions
    // All [DBusInterface] interfaces MUST be public  Tmds.DBus emits proxy
    // classes at runtime and the CLR rejects implementing a non-public interface.
    // -------------------------------------------------------------------------

    // Implemented by GattApplication  BlueZ calls this to discover our objects
    [DBusInterface("org.freedesktop.DBus.ObjectManager")]
    public interface IObjectManager : IDBusObject
    {
        Task<IDictionary<ObjectPath, IDictionary<string, IDictionary<string, object>>>> GetManagedObjectsAsync();
    }

    // Implemented by our characteristic classes  BlueZ calls these over D-Bus
    [DBusInterface("org.bluez.GattCharacteristic1")]
    public interface IGattCharacteristic1 : IDBusObject
    {
        Task<byte[]> ReadValueAsync(IDictionary<string, object> options);
        Task WriteValueAsync(byte[] value, IDictionary<string, object> options);
        Task StartNotifyAsync();
        Task StopNotifyAsync();
    }

    // Implemented by LEAdvertisement  BlueZ calls Release when it unregisters us
    [DBusInterface("org.bluez.LEAdvertisement1")]
    public interface ILEAdvertisement1 : IDBusObject
    {
        Task ReleaseAsync();
    }

    // These two are only used as call targets (we call BlueZ, not the reverse),
    // so we define them purely for CreateProxy  the signature problem is worked
    // around by using ValueTuple overloads that Tmds.DBus marshals correctly.
    [DBusInterface("org.bluez.GattManager1")]
    public interface IGattManager1 : IDBusObject
    {
        // Tmds.DBus marshals (ObjectPath, ValueTuple) correctly as "oa{sv}"
        Task RegisterApplicationAsync(ObjectPath application, IDictionary<string, object> options);
    }

    [DBusInterface("org.bluez.LEAdvertisingManager1")]
    public interface ILEAdvertisingManager1 : IDBusObject
    {
        Task RegisterAdvertisementAsync(ObjectPath advertisement, IDictionary<string, object> options);
    }

    // -------------------------------------------------------------------------
    // GATT Application  root ObjectManager that BlueZ queries
    // -------------------------------------------------------------------------

    public class GattApplication : IObjectManager
    {
        private readonly GattService _service;
        public ObjectPath ObjectPath { get; } = new ObjectPath("/com/gattserver/app");

        public GattApplication(GattService service)
        {
            _service = service;
        }

        public Task<IDictionary<ObjectPath, IDictionary<string, IDictionary<string, object>>>> GetManagedObjectsAsync()
        {
            var result = new Dictionary<ObjectPath, IDictionary<string, IDictionary<string, object>>>();

            result[_service.ObjectPath] = new Dictionary<string, IDictionary<string, object>>
            {
                ["org.bluez.GattService1"] = new Dictionary<string, object>
                {
                    ["UUID"] = _service.UUID,
                    ["Primary"] = true
                }
            };

            foreach (var ch in _service.Characteristics)
            {
                result[ch.ObjectPath] = new Dictionary<string, IDictionary<string, object>>
                {
                    ["org.bluez.GattCharacteristic1"] = new Dictionary<string, object>
                    {
                        ["UUID"] = ch.UUID,
                        ["Service"] = _service.ObjectPath,
                        ["Flags"] = ch.Flags
                    }
                };
            }

            return Task.FromResult<IDictionary<ObjectPath, IDictionary<string, IDictionary<string, object>>>>(result);
        }
    }

    // -------------------------------------------------------------------------
    // GATT Service  data holder, no D-Bus interface of its own
    // -------------------------------------------------------------------------

    public class GattService
    {
        public string UUID { get; }
        public ObjectPath ObjectPath { get; } = new ObjectPath("/com/gattserver/app/service0");
        public GattCharacteristicBase[] Characteristics { get; }

        public GattService(string uuid, params GattCharacteristicBase[] characteristics)
        {
            UUID = uuid;
            Characteristics = characteristics;
        }
    }

    // -------------------------------------------------------------------------
    // Base characteristic  implements BlueZ GattCharacteristic1
    // -------------------------------------------------------------------------

    public abstract class GattCharacteristicBase : IGattCharacteristic1
    {
        public string UUID { get; }
        public string[] Flags { get; }
        public ObjectPath ObjectPath { get; }

        private bool _notifying;
        public bool IsNotifying => _notifying;

        public event Func<byte[], Task>? ValueChanged;

        protected GattCharacteristicBase(string uuid, ObjectPath objectPath, params string[] flags)
        {
            UUID = uuid;
            ObjectPath = objectPath;
            Flags = flags;
        }

        public virtual Task<byte[]> ReadValueAsync(IDictionary<string, object> options)
            => Task.FromResult(Array.Empty<byte>());

        public virtual Task WriteValueAsync(byte[] value, IDictionary<string, object> options)
            => Task.CompletedTask;

        public Task StartNotifyAsync()
        {
            _notifying = true;
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Notifications started ({UUID[^4..]})");
            return Task.CompletedTask;
        }

        public Task StopNotifyAsync()
        {
            _notifying = false;
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Notifications stopped ({UUID[^4..]})");
            return Task.CompletedTask;
        }

        public async Task NotifyValue(byte[] value)
        {
            if (_notifying && ValueChanged != null)
                await ValueChanged.Invoke(value);
        }
    }

    // -------------------------------------------------------------------------
    // Concrete characteristics
    // -------------------------------------------------------------------------

    public class ReadCharacteristic : GattCharacteristicBase
    {
        private readonly string _value = "Hello BLE";

        public ReadCharacteristic(string uuid)
            : base(uuid, new ObjectPath("/com/gattserver/app/service0/char1"), "read") { }

        public override Task<byte[]> ReadValueAsync(IDictionary<string, object> options)
        {
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Read request: Sent '{_value}'");
            return Task.FromResult(Encoding.UTF8.GetBytes(_value));
        }
    }

    public class WriteCharacteristic : GattCharacteristicBase
    {
        private readonly CustomPluginController _server;

        public WriteCharacteristic(string uuid, CustomPluginController server)
            : base(uuid, new ObjectPath("/com/gattserver/app/service0/char2"), "write", "write-without-response")
        {
            _server = server;
        }

        public override Task WriteValueAsync(byte[] value, IDictionary<string, object> options)
        {
            var received = Encoding.UTF8.GetString(value);
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] MESSAGE RECEIVED");
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Content: '{received}'");
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Length: {received.Length} bytes");
            _server.HandleWrite(received);
            return Task.CompletedTask;
        }
    }

    public class NotifyCharacteristic : GattCharacteristicBase
    {
        public NotifyCharacteristic(string uuid)
            : base(uuid, new ObjectPath("/com/gattserver/app/service0/char3"), "notify") { }
    }

    // -------------------------------------------------------------------------
    // BLE Advertisement
    // -------------------------------------------------------------------------

    public class LEAdvertisement : ILEAdvertisement1
    {
        public ObjectPath ObjectPath { get; } = new ObjectPath("/com/gattserver/advertisement0");
        private readonly string _serviceUUID;

        public LEAdvertisement(string serviceUUID)
        {
            _serviceUUID = serviceUUID;
        }

        public Task ReleaseAsync()
        {
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Advertisement released by BlueZ.");
            return Task.CompletedTask;
        }

        public IDictionary<string, object> GetProperties() => new Dictionary<string, object>
        {
            ["Type"] = "peripheral",
            ["LocalName"] = "GattServer",
            ["ServiceUUIDs"] = new[] { _serviceUUID },
            ["Discoverable"] = true
        };
    }

    // -------------------------------------------------------------------------
    // Main server
    // -------------------------------------------------------------------------

    public class CustomPluginController : IController
    {
        private static readonly string SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
        private static readonly string READ_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef1";
        private static readonly string WRITE_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef2";
        private static readonly string NOTIFY_CHAR_UUID = "12345678-1234-5678-1234-56789abcdef3";

        private static readonly string BLUEZ_SERVICE = "org.bluez";
        private static readonly string ADAPTER_PATH = "/org/bluez/hci0";

        private Connection? _dbusConnection;
        private System.Threading.Timer? _heartbeatTimer;
        private const int HeartbeatDelay = 1000;

        private readonly SemaphoreSlim _notifyLock = new SemaphoreSlim(1, 1);

        private readonly NotifyCharacteristic _notifyCharacteristic;
        private readonly ReadCharacteristic _readCharacteristic;
        private readonly WriteCharacteristic _writeCharacteristic;

        public CustomPluginController()
        {
            _notifyCharacteristic = new NotifyCharacteristic(NOTIFY_CHAR_UUID);
            _readCharacteristic = new ReadCharacteristic(READ_CHAR_UUID);
            _writeCharacteristic = new WriteCharacteristic(WRITE_CHAR_UUID, this);
        }

        public async Task StartServerAsync()
        {
            try
            {
                _dbusConnection = new Connection(Address.System);
                await _dbusConnection.ConnectAsync();

                // Export GATT application  BlueZ calls GetManagedObjects on it
                var gattService = new GattService(SERVICE_UUID, _readCharacteristic, _writeCharacteristic, _notifyCharacteristic);
                var gattApplication = new GattApplication(gattService);
                await _dbusConnection.RegisterObjectAsync(gattApplication);
                await _dbusConnection.RegisterObjectAsync(_readCharacteristic);
                await _dbusConnection.RegisterObjectAsync(_writeCharacteristic);
                await _dbusConnection.RegisterObjectAsync(_notifyCharacteristic);

                // Call RegisterApplication on the SAME connection so BlueZ can trace
                // the caller's D-Bus unique name back to the exported object paths.
                // We use CreateProxy here but pass an empty Dictionary<string,object>
                // which Tmds.DBus correctly marshals as a{sv} with 0 entries.
                var gattManager = _dbusConnection.CreateProxy<IGattManager1>(BLUEZ_SERVICE, ADAPTER_PATH);
                await gattManager.RegisterApplicationAsync(
                    gattApplication.ObjectPath,
                    new Dictionary<string, object>());

                Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] GATT application registered.");

                // Export and register advertisement on the same connection
                var advertisement = new LEAdvertisement(SERVICE_UUID);
                await _dbusConnection.RegisterObjectAsync(advertisement);

                var advManager = _dbusConnection.CreateProxy<ILEAdvertisingManager1>(BLUEZ_SERVICE, ADAPTER_PATH);
                await advManager.RegisterAdvertisementAsync(
                    advertisement.ObjectPath,
                    new Dictionary<string, object>());

                Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Advertisement registered.");

                _heartbeatTimer = new System.Threading.Timer(async _ =>
                {
                    await SendHeartbeat();
                }, null, 0, HeartbeatDelay);

                Console.WriteLine("GATT Server started and advertising...");
                Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Server is ready for connections");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error starting server: {ex.Message}");
                Console.WriteLine($"Stack: {ex.StackTrace}");
            }
        }

        private async Task SendHeartbeat()
        {
            if (!_notifyCharacteristic.IsNotifying)
                return;

            var packet = new
            {
                type = "PC_HEARTBEAT",
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            byte[] bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(packet) + "\u0000");

            if (await _notifyLock.WaitAsync(100))
            {
                try { await _notifyCharacteristic.NotifyValue(bytes); }
                catch { }
                finally { _notifyLock.Release(); }
            }
        }

        private async Task NotifyValueChanged(string value)
        {
            if (!_notifyCharacteristic.IsNotifying)
                return;

            await _notifyLock.WaitAsync();
            try
            {
                string msg = value + "\u0000";
                const int chunkSize = 240;

                for (int i = 0; i < msg.Length; i += chunkSize)
                {
                    string chunk = msg.Substring(i, Math.Min(chunkSize, msg.Length - i));
                    await _notifyCharacteristic.NotifyValue(Encoding.UTF8.GetBytes(chunk));
                    await Task.Delay(20);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error notifying: {ex.Message}");
            }
            finally
            {
                _notifyLock.Release();
            }
        }

        public async Task sendLayout(string? filePath)
        {
            if (string.IsNullOrEmpty(filePath))
            {
                Console.WriteLine("Please provide the file path for the layout JSON file.");
                Console.Write("File path: ");
                filePath = Console.ReadLine();
            }

            if (string.IsNullOrEmpty(filePath) || !System.IO.File.Exists(filePath))
            {
                Console.WriteLine("Invalid file path or file does not exist.");
                return;
            }

            try
            {
                if (_heartbeatTimer != null)
                {
                    Console.WriteLine("Pausing Heartbeat for transfer...");
                    _heartbeatTimer.Change(Timeout.Infinite, Timeout.Infinite);
                }

                string json = System.IO.File.ReadAllText(filePath);
                JObject obj = JObject.Parse(json);

                var layoutPacket = new PCPacket
                {
                    type = "GAMEPAD_LAYOUT",
                    timeStamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    data = obj.ToString()
                };

                string layoutJson = JsonConvert.SerializeObject(layoutPacket);

                var headerPacket = new
                {
                    type = "TRANSFER_START",
                    totalLength = layoutJson.Length
                };

                Console.WriteLine($"Sending Layout... Size: {layoutJson.Length} bytes");
                await NotifyValueChanged(JsonConvert.SerializeObject(headerPacket));
                await Task.Delay(100);
                await NotifyValueChanged(layoutJson);
                Console.WriteLine("Layout sent successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error reading/sending layout: {ex.Message}");
            }
            finally
            {
                if (_heartbeatTimer != null)
                {
                    Console.WriteLine("Resuming Heartbeat...");
                    _heartbeatTimer.Change(0, HeartbeatDelay);
                }
            }
        }

        public Task StopServer()
        {
            _heartbeatTimer?.Dispose();
            _heartbeatTimer = null;
            _dbusConnection?.Dispose();
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] GATT Server stopped.");
            return Task.CompletedTask;
        }

        internal void HandleWrite(string receivedValue)
        {
            receivedValue = receivedValue.TrimEnd('\u0000');

            PCPacket? p = JsonConvert.DeserializeObject<PCPacket>(receivedValue);
            if (p == null) return;

            long ts = p.timeStamp;

            switch (p.type)
            {
                case "movement":
                    if (p.data == null) return;
                    var payload = JObject.Parse(p.data);
                    var steps = Convert.ToInt32(payload["steps"]);
                    var ax = Convert.ToSingle(payload["x"]);
                    var ay = Convert.ToSingle(payload["y"]);
                    var az = Convert.ToSingle(payload["z"]);

                    var buttonState = new Dictionary<string, bool>();
                    if (payload.ContainsKey("buttons") && payload["buttons"] is JObject jBtn)
                    {
                        var buttons = jBtn.ToObject<Dictionary<string, bool>>();
                        if (buttons != null)
                            foreach (var kv in buttons)
                                buttonState[kv.Key] = kv.Value;
                    }

                    WebSocketHost.Broadcast(new { type = "movement", x = ax, y = ay, z = az, steps, buttons = buttonState, timestamp = ts });
                    break;

                case "command":
                    if (p.data == null) return;
                    var commandPayload = JObject.Parse(p.data);
                    if (commandPayload["command"] != null)
                        WebSocketHost.Broadcast(new { type = "command", value = commandPayload["command"]!.ToString(), timestamp = ts });
                    break;
            }
        }
    }
}

#endif