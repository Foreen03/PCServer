using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.DirectX.Direct3D11;

using SharpDX.Direct3D11;
using SharpDX.DXGI;

using Device = SharpDX.Direct3D11.Device;
using MapFlags = SharpDX.Direct3D11.MapFlags;

namespace Backend
{
    /// <summary>
    /// Captures the primary monitor using Windows Graphics Capture API,
    /// which works reliably with fullscreen DirectX / OpenGL / Vulkan games.
    /// Falls back to GDI CopyFromScreen on older Windows versions.
    /// </summary>
    public static class ScreenCapture
    {
        // ── P/Invoke for WinRT Direct3D interop ────────────────────────
        [ComImport]
        [Guid("A9B3D012-3DF2-4EE3-B8D1-8695F457D3C1")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [ComVisible(true)]
        private interface IDirect3DDxgiInterfaceAccess
        {
            IntPtr GetInterface([In] ref Guid iid);
        }

        [DllImport("d3d11.dll", EntryPoint = "CreateDirect3D11DeviceFromDXGIDevice",
            SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true,
            CallingConvention = CallingConvention.StdCall)]
        private static extern uint CreateDirect3D11DeviceFromDXGIDevice(
            IntPtr dxgiDevice, out IntPtr graphicsDevice);

        [DllImport("user32.dll")]
        private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

        [DllImport("user32.dll")]
        private static extern IntPtr GetDesktopWindow();

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        // DPI awareness – ensures we get physical pixel dimensions, not scaled ones
        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);

        private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);
        private const uint MONITOR_DEFAULTTOPRIMARY = 1;
        private const uint MONITOR_DEFAULTTONEAREST = 2;

        /// <summary>
        /// Captures the monitor where the foreground window (game) is displayed.
        /// Uses Windows.Graphics.Capture (works with fullscreen games) when
        /// available, otherwise falls back to GDI.
        /// </summary>
        public static Bitmap? CaptureMonitor()
        {
            try
            {
                if (GraphicsCaptureSession.IsSupported())
                {
                    return CaptureWithGraphicsCapture();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ScreenCapture] Graphics Capture failed, falling back to GDI: {ex.Message}");
            }

            return CaptureWithGdi();
        }

        // ── Windows Graphics Capture path ──────────────────────────────
        private static Bitmap? CaptureWithGraphicsCapture()
        {
            IntPtr previousDpiContext = IntPtr.Zero;
            try
            {
                previousDpiContext = SetThreadDpiAwarenessContext(
                    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
            }
            catch { /* ignore */ }

            try
            {
                // 1. Get the monitor where the foreground window (game) is displayed.
                //    Since CaptureScreen runs on a background thread, the game is
                //    still the foreground window at this point.
                IntPtr fgWindow = GetForegroundWindow();
                IntPtr hMonitor = (fgWindow != IntPtr.Zero)
                    ? MonitorFromWindow(fgWindow, MONITOR_DEFAULTTONEAREST)
                    : MonitorFromWindow(GetDesktopWindow(), MONITOR_DEFAULTTOPRIMARY);
                var captureItem = CreateItemForMonitor(hMonitor);
                if (captureItem == null) return CaptureWithGdi(); // fallback

                // 2. Create D3D11 device + WinRT wrapper
                Device d3dDevice = new Device(
                    SharpDX.Direct3D.DriverType.Hardware,
                    DeviceCreationFlags.BgraSupport);

                IDirect3DDevice winrtDevice = CreateDirect3DDeviceFromSharpDX(d3dDevice);

                // 3. Set up frame pool & session
                var size = captureItem.Size;
                var framePool = Direct3D11CaptureFramePool.CreateFreeThreaded(
                    winrtDevice,
                    DirectXPixelFormat.B8G8R8A8UIntNormalized,
                    1,
                    size);

                var session = framePool.CreateCaptureSession(captureItem);

                // Hide the yellow capture border (Windows 11+). Silently ignore if not available.
                try
                {
                    var sessionType = session.GetType();
                    var borderProp = sessionType.GetProperty("IsBorderRequired");
                    borderProp?.SetValue(session, false);
                }
                catch { /* Property not available on this OS version */ }

                // Don't show the cursor in the capture
                try { session.IsCursorCaptureEnabled = false; } catch { /* older OS */ }

                Bitmap? result = null;
                using var frameEvent = new ManualResetEventSlim(false);

                framePool.FrameArrived += (pool, _) =>
                {
                    using var frame = pool.TryGetNextFrame();
                    if (frame == null) { frameEvent.Set(); return; }

                    result = CopyFrameToBitmap(frame, d3dDevice);
                    frameEvent.Set();
                };

                session.StartCapture();

                // Wait up to 2 seconds for the first frame
                frameEvent.Wait(TimeSpan.FromSeconds(2));

                session.Dispose();
                framePool.Dispose();
                d3dDevice.Dispose();

                return result ?? CaptureWithGdi(); // fallback if no frame arrived
            }
            finally
            {
                // Restore the original DPI awareness context
                if (previousDpiContext != IntPtr.Zero)
                {
                    try { SetThreadDpiAwarenessContext(previousDpiContext); }
                    catch { /* ignore */ }
                }
            }
        }

        private static GraphicsCaptureItem? CreateItemForMonitor(IntPtr hMonitor)
        {
            // Use the interop factory to create a GraphicsCaptureItem from a monitor handle
            var interopFactory = GraphicsCaptureItem.As<IGraphicsCaptureItemInterop>();
            Guid itemGuid = typeof(GraphicsCaptureItem).GUID;
            interopFactory.CreateForMonitor(hMonitor, itemGuid, out var rawItem);
            return rawItem as GraphicsCaptureItem;
        }

        /// <summary>
        /// COM interop interface for creating GraphicsCaptureItem from HWND / HMONITOR.
        /// </summary>
        [ComImport]
        [Guid("3628E81B-3CAC-4C60-B7F4-23CE0E0C3356")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IGraphicsCaptureItemInterop
        {
            void CreateForWindow(
                IntPtr window,
                [In] ref Guid iid,
                [MarshalAs(UnmanagedType.IUnknown)] out object result);

            void CreateForMonitor(
                IntPtr monitor,
                [In] ref Guid iid,
                [MarshalAs(UnmanagedType.IUnknown)] out object result);
        }

        private static IDirect3DDevice CreateDirect3DDeviceFromSharpDX(Device d3dDevice)
        {
            // Get DXGI device from D3D11 device
            using var dxgiDevice = d3dDevice.QueryInterface<SharpDX.DXGI.Device>();
            uint hr = CreateDirect3D11DeviceFromDXGIDevice(
                dxgiDevice.NativePointer, out IntPtr pUnknown);
            if (hr != 0)
                throw new Exception($"CreateDirect3D11DeviceFromDXGIDevice failed: 0x{hr:X8}");

            // Marshal the IInspectable pointer to a WinRT IDirect3DDevice
            var winrtDevice = (IDirect3DDevice)Marshal.GetObjectForIUnknown(pUnknown);
            Marshal.Release(pUnknown);
            return winrtDevice;
        }

        private static Bitmap? CopyFrameToBitmap(Direct3D11CaptureFrame frame, Device d3dDevice)
        {
            // Get the D3D11 texture from the frame's surface
            var frameSurface = frame.Surface;
            var access = (IDirect3DDxgiInterfaceAccess)frameSurface;

            var texGuid = typeof(Texture2D).GUID;
            IntPtr pTexture = access.GetInterface(ref texGuid);
            using var surfaceTexture = new Texture2D(pTexture);

            // Read the actual GPU texture dimensions — these are the real
            // framebuffer size, unlike frame.ContentSize which can be smaller
            // due to DPI scaling or fullscreen game resolution mismatches.
            var desc = surfaceTexture.Description;
            int width = (int)desc.Width;
            int height = (int)desc.Height;

            // Create a CPU-readable staging texture
            desc.Usage = ResourceUsage.Staging;
            desc.BindFlags = BindFlags.None;
            desc.CpuAccessFlags = CpuAccessFlags.Read;
            desc.OptionFlags = ResourceOptionFlags.None;

            using var stagingTexture = new Texture2D(d3dDevice, desc);
            d3dDevice.ImmediateContext.CopyResource(surfaceTexture, stagingTexture);

            // Map and copy pixels to a Bitmap
            var dataBox = d3dDevice.ImmediateContext.MapSubresource(
                stagingTexture, 0, MapMode.Read, MapFlags.None);

            try
            {
                var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb);

                var bitmapData = bitmap.LockBits(
                    new Rectangle(0, 0, width, height),
                    ImageLockMode.WriteOnly,
                    PixelFormat.Format32bppArgb);

                try
                {
                    int rowBytes = width * 4;
                    for (int y = 0; y < height; y++)
                    {
                        IntPtr srcRow = IntPtr.Add(dataBox.DataPointer, y * dataBox.RowPitch);
                        IntPtr dstRow = IntPtr.Add(bitmapData.Scan0, y * bitmapData.Stride);

                        // Use Marshal.Copy via byte[] to avoid unsafe context
                        byte[] rowBuffer = new byte[rowBytes];
                        Marshal.Copy(srcRow, rowBuffer, 0, rowBytes);
                        Marshal.Copy(rowBuffer, 0, dstRow, rowBytes);
                    }
                }
                finally
                {
                    bitmap.UnlockBits(bitmapData);
                }

                return bitmap;
            }
            finally
            {
                d3dDevice.ImmediateContext.UnmapSubresource(stagingTexture, 0);
            }
        }

        // ── GDI fallback ───────────────────────────────────────────────
        private static Bitmap CaptureWithGdi()
        {
            IntPtr fgWindow = GetForegroundWindow();
            var screen = (fgWindow != IntPtr.Zero)
                ? System.Windows.Forms.Screen.FromHandle(fgWindow)
                : System.Windows.Forms.Screen.PrimaryScreen!;
            var bounds = screen.Bounds;
            var bitmap = new Bitmap(bounds.Width, bounds.Height);
            using (var g = Graphics.FromImage(bitmap))
                g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
            return bitmap;
        }
    }
}
