"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GamepadLayout, EditorAction, GamepadComponent, SystemComponentType } from "@/lib/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PropertiesPanel } from "./PropertiesPanel"
import { CanvasButton } from "./CanvasButton"
import type { PhoneDevice } from "@/lib/devices"

// ─── Phone Canvas ───────────────────────────────────────────────────────────

interface PhoneCanvasProps {
  state: GamepadLayout
  selectedId: string | null
  onSelect: (id: string | null) => void
  dispatch: React.Dispatch<EditorAction>
  device: PhoneDevice
  snapToGrid?: boolean
  gridSize?: number
}

export function PhoneCanvas({
  state,
  selectedId,
  onSelect,
  dispatch,
  device,
  snapToGrid = false,
  gridSize = 20,
}: PhoneCanvasProps) {
  const screenRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [screenRect, setScreenRect] = useState<DOMRect | null>(null)
  const [scale, setScale] = useState(0.6)
  const [quickEditId, setQuickEditId] = useState<string | null>(null)

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
      if (rect.width < 50 || rect.height < 50) return

      const padX = 48
      const padY = 72
      const availW = rect.width - padX
      const availH = rect.height - padY

      if (availW <= 0 || availH <= 0) return

      const scaleX = availW / frameW
      const scaleY = availH / frameH
      const newScale = Math.min(scaleX, scaleY, 1)
      setScale(newScale)
    }

    const initialTimer = setTimeout(compute, 50)
    const observer = new ResizeObserver(() => requestAnimationFrame(compute))
    observer.observe(container)

    return () => {
      clearTimeout(initialTimer)
      observer.disconnect()
    }
  }, [frameW, frameH])

  // Track the screen element rect for drag/resize calculations
  useEffect(() => {
    const screen = screenRef.current
    if (!screen) return

    const updateRect = () => setScreenRect(screen.getBoundingClientRect())
    updateRect()

    const timer = setTimeout(updateRect, 50)
    const observer = new ResizeObserver(() => updateRect())
    observer.observe(screen)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
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

  const handleSizeAndPositionChange = useCallback(
    (
      id: string,
      newPosition: { x: number; y: number },
      newSize: { width: number; height: number }
    ) => {
      dispatch({
        type: "UPDATE_COMPONENT",
        payload: { id, updates: { position: newPosition, size: newSize } },
      })
    },
    [dispatch]
  )

  const handleSystemComponentSizeAndPositionChange = useCallback(
    (id: string, newPosition: { x: number; y: number }, newSize: { width: number; height: number }) => {
      dispatch({
        type: "UPDATE_SYSTEM_COMPONENT",
        payload: {
          id,
          updates: { position: newPosition, size: newSize },
        },
      })
    },
    [dispatch],
  )

  const handleSystemComponentPositionChange = useCallback(
    (id: string, x: number, y: number) => {
      dispatch({
        type: "UPDATE_SYSTEM_COMPONENT",
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

  const handleAddComponent = useCallback(() => {
    const newId = `btn_${Date.now()}`;
    const newComponent: GamepadComponent = {
      type: "button",
      id: newId,
      position: { x: 0.5, y: 0.5 },
      size: { width: 0.15, height: 0.15 },
      shape: "circle",
      command: "new_command",
      content: { type: "text", text: "New" },
    };
    dispatch({ type: "ADD_COMPONENT", payload: newComponent });
    onSelect(newId);
  }, [dispatch, onSelect]);

  const handleAddSystemComponent = useCallback((type: SystemComponentType) => {
    const newId = `${type}_${Date.now()}`;
    dispatch({
      type: "ADD_SYSTEM_COMPONENT",
      payload: {
        type: type,
        id: newId,
        position: { x: 0.5, y: 0.05 },
        size: { width: 0.1, height: 0.1 },
        shape: "circle",
        style: { backgroundColor: "#6750A4", textColor: "#FFFFFF" },
      },
    });
    onSelect(newId);
  }, [dispatch, onSelect]);

  const handleDeleteComponent = useCallback((id: string, isSystem: boolean) => {
    if (isSystem) {
      dispatch({ type: "DELETE_SYSTEM_COMPONENT", payload: id });
    } else {
      dispatch({ type: "DELETE_COMPONENT", payload: id });
    }
    if (selectedId === id) onSelect(null);
  }, [dispatch, selectedId, onSelect]);

  const handleDuplicateComponent = useCallback((comp: GamepadComponent) => {
    const newId = `btn_${Date.now()}`;
    const newComponent: GamepadComponent = {
      ...comp,
      id: newId,
      position: {
        x: Math.min(comp.position.x + 0.05, 0.95),
        y: Math.min(comp.position.y + 0.05, 0.95),
      }
    };
    dispatch({ type: "ADD_COMPONENT", payload: newComponent });
    onSelect(newId);
  }, [dispatch, onSelect]);

  const { safeArea } = state.layout
  const bgImg = state.theme.backgroundImage
  const bgSizeMap: Record<string, string> = {
    fill: "100% 100%",
    fit: "contain",
    crop: "cover",
  }

  const systemComponents = state.layout.systemComponents || []

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

      {/* Phone frame wrapper */}
      <div
        className="z-10"
        style={{
          width: frameW * scale,
          height: frameH * scale,
        }}
      >
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
          <ContextMenu>
            <ContextMenuTrigger asChild>
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
                bgImg.enabled && bgImg.value ? `url(${bgImg.value})` : undefined,
              backgroundSize: bgSizeMap[bgImg.scaleType] || "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            onClick={handleCanvasClick}
          >
            {/* Snap-to-grid overlay */}
            {snapToGrid && (
              <div
                className="absolute inset-0 pointer-events-none z-[2]"
                style={{
                  backgroundImage:
                    `linear-gradient(rgba(139,92,246,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.12) 1px, transparent 1px)`,
                  backgroundSize: `${gridSize}px ${gridSize}px`,
                  backgroundPosition: '0 0',
                }}
              />
            )}
            {/* Notch / Dynamic Island (iPhone) */}
            {device.id.startsWith("iphone") && device.bezelRadius > 10 && (
              <div
                className="absolute z-20 rounded-full"
                style={
                  isLandscape
                    ? { left: 6, top: "50%", transform: "translateY(-50%)", width: 24, height: 72, backgroundColor: "hsl(0 0% 0%)" }
                    : { top: 6, left: "50%", transform: "translateX(-50%)", width: 72, height: 24, backgroundColor: "hsl(0 0% 0%)" }
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
                    ? { left: 10, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, backgroundColor: "hsl(0 0% 0%)", border: "2px solid hsl(240 4% 20%)" }
                    : { top: 10, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, backgroundColor: "hsl(0 0% 0%)", border: "2px solid hsl(240 4% 20%)" }
                }
              />
            )}

            {/* System components */}
            {systemComponents.map((sc) => (
              <ContextMenu key={sc.id}>
                <ContextMenuTrigger asChild>
                  <CanvasButton
                    component={sc}
                    buttonTheme={state.theme.button}
                    isSelected={selectedId === sc.id}
                    canvasRect={screenRect}
                    deviceWidth={deviceW}
                    deviceHeight={deviceH}
                    safeArea={safeArea}
                    onSelect={onSelect}
                    onPositionChange={handleSystemComponentPositionChange}
                    onSizeAndPositionChange={handleSystemComponentSizeAndPositionChange}
                    snapToGrid={snapToGrid}
                    gridSize={gridSize}
                  />
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => { onSelect(sc.id); setTimeout(() => setQuickEditId(sc.id), 50); }}>Edit Properties</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem 
                    onClick={() => handleDeleteComponent(sc.id, true)}
                    disabled={sc.id === "pause_button"}
                    className="text-destructive focus:bg-red-200"
                  >
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}

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
              <ContextMenu key={comp.id}>
                <ContextMenuTrigger asChild>
                  <CanvasButton
                    component={comp}
                    buttonTheme={state.theme.button}
                    isSelected={selectedId === comp.id}
                    canvasRect={screenRect}
                    deviceWidth={deviceW}
                    deviceHeight={deviceH}
                    safeArea={safeArea}
                    onSelect={onSelect}
                    onPositionChange={handlePositionChange}
                    onSizeAndPositionChange={handleSizeAndPositionChange}
                    snapToGrid={snapToGrid}
                    gridSize={gridSize}
                  />
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => { onSelect(comp.id); setTimeout(() => setQuickEditId(comp.id), 50); }}>Edit Properties</ContextMenuItem>
                  <ContextMenuItem onClick={() => handleDuplicateComponent(comp)}>Duplicate</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleDeleteComponent(comp.id, false)} className="text-destructive focus:text-destructive">Delete</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleAddComponent}>Add Button</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Add System Component</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => handleAddSystemComponent("screenshot")}>Screenshot</ContextMenuItem>
              <ContextMenuItem onClick={() => handleAddSystemComponent("toggle_system_bar")}>Toggle System Bar</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
        </div>
      </div>

      {/* Device label */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-center z-20"
        style={{ color: "hsl(240 4% 46%)" }}
      >
        {device.name} &middot; {deviceW}&times;{deviceH}dp
        {isLandscape ? " landscape" : " portrait"}
        &middot; {Math.round(scale * 100)}%
      </div>

      <Dialog open={quickEditId !== null} onOpenChange={(open) => !open && setQuickEditId(null)}>
        <DialogContent 
          className="max-w-lg w-[90vw] p-0 overflow-hidden bg-card text-card-foreground"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-4 py-3 border-b border-border bg-muted/50">
            <DialogTitle className="text-sm font-semibold">Quick Edit</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <PropertiesPanel 
              state={state} 
              selectedId={quickEditId} 
              onSelect={onSelect} 
              dispatch={dispatch} 
              mode="component-only" 
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}