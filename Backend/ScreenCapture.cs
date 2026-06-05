using System.Drawing;
using System.Drawing.Imaging;
using System.Text;
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

        // ── P/Invoke for window capture ─────────────────────────────────
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindowW(string? lpClassName, string lpWindowName);

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowTextW(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern int GetWindowTextLengthW(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool PrintWindow(IntPtr hWnd, IntPtr hDC, uint nFlags);

        // PW_RENDERFULLCONTENT (flag 2) — captures DirectComposition / DWM content
        private const uint PW_RENDERFULLCONTENT = 2;

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left, Top, Right, Bottom;
            public int Width => Right - Left;
            public int Height => Bottom - Top;
        }

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
                    IntPtr fgWindow = GetForegroundWindow();
                    IntPtr hMonitor = (fgWindow != IntPtr.Zero)
                        ? MonitorFromWindow(fgWindow, MONITOR_DEFAULTTONEAREST)
                        : MonitorFromWindow(GetDesktopWindow(), MONITOR_DEFAULTTOPRIMARY);
                    var captureItem = CreateItemForMonitor(hMonitor);
                    if (captureItem != null)
                        return CaptureWithGraphicsCapture(captureItem);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ScreenCapture] Graphics Capture failed, falling back to GDI: {ex.Message}");
            }

            return CaptureWithGdi();
        }

        /// <summary>
        /// Captures the foreground window only (no taskbar, no other windows).
        /// Auto-detects the foreground window via GetForegroundWindow().
        /// </summary>
        public static Bitmap? CaptureWindow()
        {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero)
            {
                Console.WriteLine("[ScreenCapture] No foreground window found, falling back to monitor capture.");
                return CaptureMonitor();
            }
            return CaptureWindow(hwnd);
        }

        /// <summary>
        /// Captures a specific window by its handle (no taskbar, no other windows).
        /// </summary>
        public static Bitmap? CaptureWindow(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero)
                return CaptureMonitor();

            try
            {
                if (GraphicsCaptureSession.IsSupported())
                {
                    var captureItem = CreateItemForWindow(hwnd);
                    if (captureItem != null)
                        return CaptureWithGraphicsCapture(captureItem);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ScreenCapture] Window Graphics Capture failed, falling back to GDI: {ex.Message}");
            }

            return CaptureWindowWithGdi(hwnd);
        }

        /// <summary>
        /// Finds a visible window whose title contains the given search text
        /// (case-insensitive partial match). Returns IntPtr.Zero if not found.
        /// </summary>
        public static IntPtr FindWindowByTitle(string titlePart)
        {
            IntPtr found = IntPtr.Zero;

            EnumWindows((hWnd, _) =>
            {
                if (!IsWindowVisible(hWnd)) return true; // skip hidden windows

                int length = GetWindowTextLengthW(hWnd);
                if (length == 0) return true;

                var sb = new StringBuilder(length + 1);
                GetWindowTextW(hWnd, sb, sb.Capacity);
                string title = sb.ToString();

                if (title.IndexOf(titlePart, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    found = hWnd;
                    return false; // stop enumeration
                }
                return true; // continue
            }, IntPtr.Zero);

            return found;
        }

        // ── Windows Graphics Capture path (shared by monitor + window) ──
        private static Bitmap? CaptureWithGraphicsCapture(GraphicsCaptureItem captureItem)
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
                // 1. Create D3D11 device + WinRT wrapper
                Device d3dDevice = new Device(
                    SharpDX.Direct3D.DriverType.Hardware,
                    DeviceCreationFlags.BgraSupport);

                IDirect3DDevice winrtDevice = CreateDirect3DDeviceFromSharpDX(d3dDevice);

                // 2. Set up frame pool & session
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

                return result;
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

        private static GraphicsCaptureItem? CreateItemForWindow(IntPtr hwnd)
        {
            // Use the interop factory to create a GraphicsCaptureItem from a window handle
            var interopFactory = GraphicsCaptureItem.As<IGraphicsCaptureItemInterop>();
            Guid itemGuid = typeof(GraphicsCaptureItem).GUID;
            interopFactory.CreateForWindow(hwnd, ref itemGuid, out var rawItem);
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

        // ── GDI fallback (monitor) ──────────────────────────────────────
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

        // ── GDI fallback (window) ──────────────────────────────────────
        private static Bitmap? CaptureWindowWithGdi(IntPtr hwnd)
        {
            if (!GetWindowRect(hwnd, out RECT rect) || rect.Width <= 0 || rect.Height <= 0)
                return CaptureWithGdi(); // fallback to full monitor

            var bitmap = new Bitmap(rect.Width, rect.Height);
            using (var g = Graphics.FromImage(bitmap))
            {
                IntPtr hdc = g.GetHdc();
                try
                {
                    // PW_RENDERFULLCONTENT captures DWM-composed content
                    if (!PrintWindow(hwnd, hdc, PW_RENDERFULLCONTENT))
                    {
                        // Fallback: try without the flag (older Windows)
                        PrintWindow(hwnd, hdc, 0);
                    }
                }
                finally
                {
                    g.ReleaseHdc(hdc);
                }
            }
            return bitmap;
        }

        // ── Save screenshot to disk ────────────────────────────────────
        /// <summary>
        /// Saves the bitmap as a JPEG file (quality 80) to the given directory.
        /// Returns the full path of the saved file.
        /// </summary>
        public static string SaveScreenshot(Bitmap bitmap, string directory)
        {
            Directory.CreateDirectory(directory);
            string fileName = $"screenshot_{DateTime.Now:yyyyMMdd_HHmmss_fff}.jpg";
            string filePath = Path.Combine(directory, fileName);

            // JPEG encoder with quality 80
            var jpegEncoder = ImageCodecInfo.GetImageEncoders()
                .First(e => e.FormatID == ImageFormat.Jpeg.Guid);
            var encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(
                System.Drawing.Imaging.Encoder.Quality, 80L);

            bitmap.Save(filePath, jpegEncoder, encoderParams);
            return filePath;
        }
    }
}
