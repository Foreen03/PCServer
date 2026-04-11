"use client"

import { useCallback, useRef } from "react"
import type { GamepadComponent, ButtonTheme } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CanvasButtonProps {
  component: GamepadComponent
  buttonTheme: ButtonTheme
  isSelected: boolean
  canvasRect: DOMRect | null
  /** Logical device dimensions in dp (already orientation-adjusted) */
  deviceWidth: number
  deviceHeight: number
  onSelect: (id: string) => void
  onPositionChange: (id: string, x: number, y: number) => void
}

export function CanvasButton({
  component,
  buttonTheme,
  isSelected,
  canvasRect,
  deviceWidth,
  deviceHeight,
  onSelect,
  onPositionChange,
}: CanvasButtonProps) {
  const isDragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const startNorm = useRef({ x: 0, y: 0 })

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect(component.id)
      isDragging.current = true
      startPos.current = { x: e.clientX, y: e.clientY }
      startNorm.current = { x: component.position.x, y: component.position.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [component.id, component.position.x, component.position.y, onSelect]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !canvasRect) return
      e.preventDefault()

      const deltaX = (e.clientX - startPos.current.x) / canvasRect.width
      const deltaY = (e.clientY - startPos.current.y) / canvasRect.height

      const newX = Math.max(0, Math.min(1, startNorm.current.x + deltaX))
      const newY = Math.max(0, Math.min(1, startNorm.current.y + deltaY))

      onPositionChange(component.id, newX, newY)
    },
    [canvasRect, component.id, onPositionChange]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  const isCircle = component.shape === "circle"

  // Convert size ratios to pixel values within the device coordinate space
  // width/height ratios are relative to the screen dimensions
  let pxW = component.size.width * deviceWidth
  let pxH = component.size.height * deviceHeight

  // For circles, use the smaller dimension to keep it perfectly round
  if (isCircle) {
    const diameter = Math.min(pxW, pxH)
    pxW = diameter
    pxH = diameter
  }

  // Position is center-based (0-1 normalized)
  const leftPx = component.position.x * deviceWidth
  const topPx = component.position.y * deviceHeight

  // Font size: scale textSizeSp relative to device density
  // Assume ~2.5x density, so 32sp -> about 13px in our coordinate space
  const fontSize = Math.max(8, buttonTheme.textSizeSp * (deviceHeight / 800))

  // Border radius for rectangles - use a proportion of the smaller dimension
  const rectRadius = Math.min(pxW, pxH) * 0.3

  return (
    <div
      className={cn(
        "absolute flex items-center justify-center cursor-grab select-none touch-none",
        isSelected && "z-10"
      )}
      style={{
        left: leftPx,
        top: topPx,
        width: pxW,
        height: pxH,
        transform: "translate(-50%, -50%)",
        borderRadius: isCircle ? "50%" : `${rectRadius}px`,
        backgroundColor: buttonTheme.color,
        color: buttonTheme.textColor,
        fontSize,
        boxShadow: isSelected
          ? "0 0 0 3px hsl(258 55% 58% / 0.8), 0 4px 16px rgba(0,0,0,0.4)"
          : "0 2px 8px rgba(0,0,0,0.25)",
        outline: isSelected ? "2px solid rgba(255,255,255,0.3)" : "none",
        outlineOffset: "4px",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="button"
      tabIndex={0}
      aria-label={`${component.label} button`}
    >
      <span className="pointer-events-none font-semibold text-center leading-tight truncate px-1">
        {component.label}
      </span>
    </div>
  )
}
