using Newtonsoft.Json;
using Fleck;
using System.Collections.Concurrent;
using Timer = System.Timers.Timer;

namespace Backend
{
    internal static class WebSocketHost
    {
        private static readonly ConcurrentDictionary<IWebSocketConnection, DateTime> _clients = new();
        private static readonly ConcurrentDictionary<IWebSocketConnection, byte> _phoneSockets = new();
        private static Timer? _pingTimer;
        private static readonly TimeSpan _pingInterval = TimeSpan.FromSeconds(5);
        private static readonly TimeSpan _pongTimeout = TimeSpan.FromSeconds(10);
        private static WebSocketServer? server;

        public static void Start(int port = 8765)
        {
            if (server != null) return; // already running

            Console.WriteLine("[WS] WebSocketHost.Start() called.");
            server = new WebSocketServer($"ws://0.0.0.0:{port}")
            {
                ListenerSocket = { NoDelay = true }
            };

            server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    _clients.TryAdd(socket, DateTime.UtcNow);
                    if (socket.ConnectionInfo.Path == "/sensor")
                        _phoneSockets.TryAdd(socket, 0);
                    Console.WriteLine($"[WS] Client connected: {socket.ConnectionInfo.ClientIpAddress} path={socket.ConnectionInfo.Path}");
                };

                socket.OnClose = () =>
                {
                    _clients.TryRemove(socket, out _);
                    Console.WriteLine($"[WS] Client disconnected: {socket.ConnectionInfo.ClientIpAddress}");
                    // Only broadcast if a phone/sensor client disconnected
                    if (_phoneSockets.TryRemove(socket, out _))
                        Broadcast(new { type = "command", value = "controller_disconnected" });
                };

                socket.OnError = ex =>
                {
                    _clients.TryRemove(socket, out _);
                    Console.WriteLine($"[WS] Client error: {socket.ConnectionInfo.ClientIpAddress}, {ex.Message}");
                    if (_phoneSockets.TryRemove(socket, out _))
                        Broadcast(new { type = "command", value = "controller_disconnected" });
                };

                socket.OnMessage = message =>
                {
                    if (_clients.ContainsKey(socket))
                        _clients[socket] = DateTime.UtcNow;
                };

                socket.OnPong = _ =>
                {
                    if (_clients.ContainsKey(socket))
                        _clients[socket] = DateTime.UtcNow;
                };
            });

            _pingTimer = new Timer(_pingInterval.TotalMilliseconds);
            _pingTimer.Elapsed += (_, _) => CheckClientsLiveness();
            _pingTimer.Start();

            Console.WriteLine($"[WS] Engine socket listening on {port}");
        }

        private static void CheckClientsLiveness()
        {
            var deadClients = _clients.Where(p => DateTime.UtcNow - p.Value > _pongTimeout).ToList();
            foreach (var dead in deadClients)
            {
                Console.WriteLine($"[WS] Client {dead.Key.ConnectionInfo.ClientIpAddress} timed out. Closing.");
                dead.Key.Close(); // triggers OnClose which handles broadcast
            }

            foreach (var client in _clients.Keys)
                client.SendPing(Array.Empty<byte>());
        }

        public static void Broadcast(object message)
        {
            string json = JsonConvert.SerializeObject(message);
            foreach (var c in _clients.Keys.ToList())
            {
                Task.Run(() =>
                {
                    try
                    {
                        c.Send(json);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[WS] Send error to {c.ConnectionInfo.ClientIpAddress}: {ex.Message}");
                        _clients.TryRemove(c, out _);
                        _phoneSockets.TryRemove(c, out _);
                    }
                });
            }
        }

        public static void Stop()
        {
            Console.WriteLine("[WS] Shutting down WebSocket server...");

            _pingTimer?.Stop();
            _pingTimer?.Dispose();
            _pingTimer = null;

            foreach (var c in _clients.Keys.ToList())
            {
                try { c.Close(); } catch { }
            }

            _clients.Clear();
            _phoneSockets.Clear();
            server?.Dispose();
            server = null;
        }
    }
}