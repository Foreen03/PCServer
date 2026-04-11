using Newtonsoft.Json;
using Fleck;

namespace Backend
{
    internal static class WebSocketHost
    {
        private static readonly List<IWebSocketConnection> clients = new();
        private static readonly object clientsLock = new();

        private static WebSocketServer? server;

        public static void Start(int port = 8765)
        {
            Console.WriteLine("[WS] WebSocketHost.Start() called.");
            server = new WebSocketServer($"ws://0.0.0.0:{port}");
            server.ListenerSocket.NoDelay = true;

            server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    lock (clientsLock)
                    {
                        clients.Add(socket);
                        Console.WriteLine($"[WS] Client connected: {socket.ConnectionInfo.ClientIpAddress}");
                    }
                };

                socket.OnClose = () =>
                {
                    lock (clientsLock)
                    {
                        clients.Remove(socket);
                        Console.WriteLine($"[WS] Client disconnected: {socket.ConnectionInfo.ClientIpAddress}");
                    }
                };

                socket.OnError = ex =>
                {
                    lock (clientsLock)
                    {
                        clients.Remove(socket);
                        Console.WriteLine($"[WS] Client error: {socket.ConnectionInfo.ClientIpAddress}, {ex.Message}");
                    }
                };
            });

            Console.WriteLine($"[WS] Engine socket listening on {port}");
        }

        public static void Broadcast(object message)
        {
            string json = JsonConvert.SerializeObject(message);

            List<IWebSocketConnection> snapshot;

            lock (clientsLock)
                snapshot = clients.ToList();

            Console.WriteLine($"[WS] Broadcasting message to {snapshot.Count} clients.");

            foreach (var c in snapshot)
            {
                Task.Run(() =>
                {
                    try
                    {
                        c.Send(json);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[WS] Error sending message to client {c.ConnectionInfo.ClientIpAddress}: {ex.Message}");
                        lock (clientsLock)
                            clients.Remove(c);
                    }
                });
            }
        }


        public static void Stop()
        {
            Console.WriteLine("[WS] Shutting down WebSocket server...");

            lock (clientsLock)
            {
                foreach (var c in clients.ToArray())
                {
                    try
                    {
                        c.Close();
                    }
                    catch { }
                }
                clients.Clear();
            }

            server?.Dispose();
            server = null;
        }
    }
}
