"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, EyeOff } from "lucide-react"
import type { GamepadLayout, EditorAction } from "@/lib/types"
import { CanvasButton } from "./CanvasButton"

export interface PhoneDevice {
  id: string
  name: string
  /** Logical width in dp/pt (portrait) */
  width: number
  /** Logical height in dp/pt (portrait) */
  height: number
  /** Corner radius of the screen bezel */
  bezelRadius: number
}

export const PHONE_DEVICES: PhoneDevice[] = [
  { id: "iphone-15", name: "iPhone 15", width: 393, height: 852, bezelRadius: 48 },
  { id: "iphone-15-pro-max", name: "iPhone 15 Pro Max", width: 430, height: 932, bezelRadius: 52 },
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, bezelRadius: 0 },
  { id: "pixel-8", name: "Pixel 8", width: 412, height: 892, bezelRadius: 44 },
  { id: "pixel-8-pro", name: "Pixel 8 Pro", width: 448, height: 998, bezelRadius: 44 },
  { id: "samsung-s24", name: "Samsung Galaxy S24", width: 412, height: 915, bezelRadius: 40 },
  { id: "samsung-s24-ultra", name: "Samsung Galaxy S24 Ultra", width: 412, height: 915, bezelRadius: 12 },
  { id: "oneplus-12", name: "OnePlus 12", width: 412, height: 919, bezelRadius: 44 },
  { id: "ipad-mini", name: "iPad Mini", width: 744, height: 1133, bezelRadius: 20 },
  { id: "ipad-pro-11", name: "iPad Pro 11\"", width: 834, height: 1194, bezelRadius: 20 },
  { id: "samsung-tab-s9", name: "Samsung Galaxy Tab S9", width: 800, height: 1280, bezelRadius: 16 },
  { id: "custom-16-9", name: "Generic 16:9", width: 412, height: 732, bezelRadius: 32 },
]

interface PhoneCanvasProps {
  state: GamepadLayout
  selectedId: string | null
  onSelect: (id: string | null) => void
  dispatch: React.Dispatch<EditorAction>
  device: PhoneDevice
}

export function PhoneCanvas({
  state,
  selectedId,
  onSelect,
  dispatch,
  device,
}: PhoneCanvasProps) {
  const screenRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [screenRect, setScreenRect] = useState<DOMRect | null>(null)
  const [scale, setScale] = useState(0.6)

  const isLandscape = state.gamepad.orientation === "landscape"

  // Real device dp dimensions based on orientation
  const deviceW = isLandscape ? device.height : device.width
  const deviceH = isLandscape ? device.width : device.height

  // Bezel thickness
  const bezel = 14
  const outerRadius = device.bezelRadius > 0 ? device.bezelRadius + 8 : 6
  const innerRadius = device.bezelRadius > 0 ? Math.max(device.bezelRadius - 4, 0) : 2

  // Frame dimensions (screen + bezel on all sides)
  const frameW = deviceW + bezel * 2
  const frameH = deviceH + bezel * 2

  // Compute scale to fit within the container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const compute = () => {
      const rect = container.getBoundingClientRect()
      // Skip if container hasn't rendered with proper dimensions yet
      if (rect.width < 50 || rect.height < 50) {
        return
      }
      
      // Reserve space for padding and label
      const padX = 48
      const padY = 72
      const availW = rect.width - padX
      const availH = rect.height - padY

      if (availW <= 0 || availH <= 0) return

      const scaleX = availW / frameW
      const scaleY = availH / frameH
      // Use the smaller scale to fit, cap at 1 (don't enlarge beyond native)
      const newScale = Math.min(scaleX, scaleY, 1)
      setScale(newScale)
    }

    // Initial compute after a short delay to ensure layout
    const initialTimer = setTimeout(compute, 50)
    
    // Also compute on any resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(compute)
    })
    observer.observe(container)
    
    return () => {
      clearTimeout(initialTimer)
      observer.disconnect()
    }
  }, [frameW, frameH])

  // Track the screen element rect for drag calculations
  useEffect(() => {
    const screen = screenRef.current
    if (!screen) return

    const updateRect = () => setScreenRect(screen.getBoundingClientRect())
    updateRect()

    const timer = setTimeout(updateRect, 50)
    const observer = new ResizeObserver(() => updateRect())
    observer.observe(screen)
    window.addEventListener("scroll", updateRect, true)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener("scroll", updateRect, true)
    }
  }, [scale, deviceW, deviceH])

  const handlePositionChange = useCallback(
    (id: string, x: number, y: number) => {
      dispatch({
        type: "UPDATE_COMPONENT",
        payload: { id, updates: { position: { x, y } } },
      })
    },
    [dispatch]
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === screenRef.current) {
        onSelect(null)
      }
    },
    [onSelect]
  )

  const { safeArea } = state.layout
  const bgImg = state.theme.backgroundImage
  const bgSizeMap: Record<string, string> = {
    fill: "cover",
    fit: "contain",
    crop: "cover",
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center relative overflow-hidden h-full"
      style={{ background: "hsl(240 6% 7%)" }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Phone frame wrapper - sized to the scaled dimensions for proper layout */}
      <div
        className="z-10"
        style={{
          width: frameW * scale,
          height: frameH * scale,
        }}
      >
        {/* Phone frame - actual size, scaled via transform from top-left */}
        <div
          style={{
            width: frameW,
            height: frameH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
            {/* Outer bezel */}
            <div
              className="absolute inset-0 border-[3px]"
              style={{
                borderColor: "hsl(240 4% 28%)",
                borderRadius: outerRadius,
                background: "linear-gradient(145deg, hsl(240 5% 14%), hsl(240 5% 8%))",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            />

            {/* Side button (power) */}
            {device.bezelRadius > 10 && (
              <div
                className="absolute rounded-sm"
                style={
                  isLandscape
                    ? {
                        bottom: -2,
                        right: frameW * 0.3,
                        width: 48,
                        height: 4,
                        background: "hsl(240 4% 22%)",
                      }
                    : {
                        right: -2,
                        top: frameH * 0.25,
                        width: 4,
                        height: 48,
                        background: "hsl(240 4% 22%)",
                      }
                }
              />
            )}

            {/* Screen */}
            <div
              ref={screenRef}
              className="absolute overflow-hidden"
              style={{
                top: bezel,
                left: bezel,
                width: deviceW,
                height: deviceH,
                borderRadius: innerRadius,
                backgroundColor: state.theme.backgroundColor,
                backgroundImage:
                  bgImg.enabled && bgImg.value
                    ? `url(${bgImg.value})`
                    : undefined,
                backgroundSize: bgSizeMap[bgImg.scaleType] || "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
              onClick={handleCanvasClick}
            >
              {/* Notch / Dynamic Island (iPhone) */}
              {device.id.startsWith("iphone") && device.bezelRadius > 10 && (
                <div
                  className="absolute z-20 rounded-full"
                  style={
                    isLandscape
                      ? {
                          left: 6,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 24,
                          height: 72,
                          backgroundColor: "hsl(0 0% 0%)",
                        }
                      : {
                          top: 6,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 72,
                          height: 24,
                          backgroundColor: "hsl(0 0% 0%)",
                        }
                  }
                />
              )}

              {/* Camera punch-hole (Android) */}
              {(device.id.startsWith("pixel") ||
                device.id.startsWith("samsung-s") ||
                device.id.startsWith("oneplus")) && (
                <div
                  className="absolute z-20 rounded-full"
                  style={
                    isLandscape
                      ? {
                          left: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 12,
                          height: 12,
                          backgroundColor: "hsl(0 0% 0%)",
                          border: "2px solid hsl(240 4% 20%)",
                        }
                      : {
                          top: 10,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 12,
                          height: 12,
                          backgroundColor: "hsl(0 0% 0%)",
                          border: "2px solid hsl(240 4% 20%)",
                        }
                  }
                />
              )}

              {/* Default pause button - top center (themed from button defaults) */}
              <div
                className="absolute z-30 flex items-center justify-center rounded-full pointer-events-none"
                style={{
                  top: Math.max(safeArea.top * deviceH + 8, 16),
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: Math.max(deviceW * 0.06, 28),
                  height: Math.max(deviceW * 0.06, 28),
                  backgroundColor: state.theme.button.color,
                  opacity: state.theme.button.pressedAlpha,
                }}
              >
                <Pause
                  style={{
                    width: Math.max(deviceW * 0.03, 14),
                    height: Math.max(deviceW * 0.03, 14),
                    color: state.theme.button.textColor,
                  }}
                  fill={state.theme.button.textColor}
                />
              </div>

              {/* Default eye-off icon - top left (not part of JSON) */}
              <div
                className="absolute z-30 flex items-center justify-center pointer-events-none"
                style={{
                  top: Math.max(safeArea.top * deviceH + 8, 16),
                  left: Math.max(safeArea.left * deviceW + 12, 16),
                  opacity: 0.6,
                }}
              >
                <EyeOff
                  style={{
                    width: Math.max(deviceW * 0.04, 18),
                    height: Math.max(deviceW * 0.04, 18),
                    color: "hsl(0 0% 20%)",
                  }}
                />
              </div>

              {/* Safe area guide */}
              <div
                className="absolute border border-dashed pointer-events-none z-[5]"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  top: safeArea.top * deviceH,
                  left: safeArea.left * deviceW,
                  width: deviceW * (1 - safeArea.left - safeArea.right),
                  height: deviceH * (1 - safeArea.top - safeArea.bottom),
                }}
              />

              {/* Gamepad components */}
              {state.layout.components.map((comp) => (
                <CanvasButton
                  key={comp.id}
                  component={comp}
                  buttonTheme={state.theme.button}
                  isSelected={selectedId === comp.id}
                  canvasRect={screenRect}
                  deviceWidth={deviceW}
                  deviceHeight={deviceH}
                  onSelect={onSelect}
                  onPositionChange={handlePositionChange}
                />
              ))}
            </div>
          </div>
        </div>
      
      {/* Device label - absolutely positioned at bottom */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-center z-20"
        style={{ color: "hsl(240 4% 46%)" }}
      >
        {device.name} &middot; {deviceW}&times;{deviceH}dp
        {isLandscape ? " landscape" : " portrait"}
        &middot; {Math.round(scale * 100)}%
      </div>
    </div>
  )
}
