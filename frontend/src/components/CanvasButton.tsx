"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import type { GamepadComponent, ButtonTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface CanvasButtonProps {
  component: GamepadComponent;
  buttonTheme: ButtonTheme;
  isSelected: boolean;
  canvasRect: DOMRect | null;
  /** Logical device dimensions in dp (already orientation-adjusted) */
  deviceWidth: number;
  deviceHeight: number;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSizeAndPositionChange: (
    id: string,
    newPosition: { x: number; y: number },
    newSize: { width: number; height: number },
  ) => void;
}

export const CanvasButton = React.memo(function CanvasButton({
  component,
  buttonTheme,
  isSelected,
  canvasRect,
  deviceWidth,
  deviceHeight,
  onSelect,
  onPositionChange,
  onSizeAndPositionChange,
}: CanvasButtonProps) {
  const isDragging = useRef(false);
  const isResizing = useRef<ResizeCorner | false>(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startNorm = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  const HANDLE_SIZE = 12;
  const OFFSET = HANDLE_SIZE / 2; // 6

  // Start geometry for resize is stored in a ref
  const startGeom = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Unified local state for smooth drag and resize
  const [localGeom, setLocalGeom] = useState({
    x: component.position.x,
    y: component.position.y,
    w: component.size.width,
    h: component.size.height,
  });

  // Sync local state when prop changes (e.g., from undo/redo)
  useEffect(() => {
    setLocalGeom({
      x: component.position.x,
      y: component.position.y,
      w: component.size.width,
      h: component.size.height,
    });
  }, [component.position, component.size]);

  // ─── Drag ────────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).dataset.corner) return;

      e.preventDefault();
      e.stopPropagation();
      onSelect(component.id);
      isDragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      // Start position is from the local state
      startNorm.current = { x: localGeom.x, y: localGeom.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [component.id, onSelect, localGeom.x, localGeom.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!canvasRect) return;
      e.preventDefault();

      if (frame.current) return; // Already a frame requested

      frame.current = requestAnimationFrame(() => {
        frame.current = null;

        // ── Drag ──────────────────────────────────────────────────────────
        if (isDragging.current) {
          const deltaX = (e.clientX - startPos.current.x) / canvasRect.width;
          const deltaY = (e.clientY - startPos.current.y) / canvasRect.height;
          const newX = Math.max(0, Math.min(1, startNorm.current.x + deltaX));
          const newY = Math.max(0, Math.min(1, startNorm.current.y + deltaY));
          setLocalGeom((g) => ({ ...g, x: newX, y: newY })); // Update local state
          return;
        }

        // ── Resize ────────────────────────────────────────────────────────
        if (!isResizing.current) return;

        const corner = isResizing.current;
        const start = startGeom.current;

        const startCX = start.x * deviceWidth;
        const startCY = start.y * deviceHeight;
        const startPxW = start.w * deviceWidth;
        const startPxH = start.h * deviceHeight;

        const halfW = startPxW / 2;
        const halfH = startPxH / 2;

        const fixedLeft = startCX - halfW;
        const fixedRight = startCX + halfW;
        const fixedTop = startCY - halfH;
        const fixedBottom = startCY + halfH;

        const curPxX =
          ((e.clientX - canvasRect.left) / canvasRect.width) * deviceWidth;
        const curPxY =
          ((e.clientY - canvasRect.top) / canvasRect.height) * deviceHeight;

        const minPx = 0.05 * Math.min(deviceWidth, deviceHeight);

        let newLeft = fixedLeft;
        let newRight = fixedRight;
        let newTop = fixedTop;
        let newBottom = fixedBottom;

        if (corner.includes("right"))
          newRight = Math.max(fixedLeft + minPx, curPxX);
        else if (corner.includes("left"))
          newLeft = Math.min(fixedRight - minPx, curPxX);

        if (corner.includes("bottom"))
          newBottom = Math.max(fixedTop + minPx, curPxY);
        else if (corner.includes("top"))
          newTop = Math.min(fixedBottom - minPx, curPxY);

        let newPxW = newRight - newLeft;
        let newPxH = newBottom - newTop;
        let newCX = newLeft + newPxW / 2;
        let newCY = newTop + newPxH / 2;

        if (component.shape === "circle") {
          const d = Math.min(newPxW, newPxH);
          if (corner.includes("right")) newCX = fixedLeft + d / 2;
          else if (corner.includes("left")) newCX = fixedRight - d / 2;
          if (corner.includes("bottom")) newCY = fixedTop + d / 2;
          else if (corner.includes("top")) newCY = fixedBottom - d / 2;
          newPxW = d;
          newPxH = d;
        }

        setLocalGeom({
          x: newCX / deviceWidth,
          y: newCY / deviceHeight,
          w: newPxW / deviceWidth,
          h: newPxH / deviceHeight,
        });
      });
    },
    [canvasRect, component.shape, deviceWidth, deviceHeight],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      if (frame.current) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }

      if (isDragging.current) {
        isDragging.current = false;
        onPositionChange(component.id, localGeom.x, localGeom.y);
      }

      if (isResizing.current) {
        isResizing.current = false;
        onSizeAndPositionChange(
          component.id,
          { x: localGeom.x, y: localGeom.y },
          { width: localGeom.w, height: localGeom.h },
        );
      }
    },
    [component.id, onPositionChange, onSizeAndPositionChange, localGeom],
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const corner = (e.target as HTMLElement).dataset.corner as ResizeCorner;
      isResizing.current = corner;

      let w = localGeom.w;
      let h = localGeom.h;
      if (component.shape === "circle") {
        const pxW = w * deviceWidth;
        const pxH = h * deviceHeight;
        const diameterPx = Math.min(pxW, pxH);
        w = diameterPx / deviceWidth;
        h = diameterPx / deviceHeight;
      }

      // Use the current local state as the starting point for the resize
      startGeom.current = { x: localGeom.x, y: localGeom.y, w, h };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [component.shape, deviceWidth, deviceHeight, localGeom],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const isCircle = component.shape === "circle";
  let pxW = localGeom.w * deviceWidth;
  let pxH = localGeom.h * deviceHeight;

  if (isCircle) {
    const diameter = Math.min(pxW, pxH);
    pxW = diameter;
    pxH = diameter;
  }

  const leftPx = localGeom.x * deviceWidth;
  const topPx = localGeom.y * deviceHeight;
  const fontSize = Math.max(8, buttonTheme.textSizeSp * (deviceHeight / 800));
  const rectRadius = Math.min(pxW, pxH) * 0.3;

  const cornerHandles: { corner: ResizeCorner; style: React.CSSProperties }[] =
    [
      {
        corner: "top-left",
        style: { top: -10, left: -10, cursor: "nwse-resize" },
      },
      {
        corner: "top-right",
        style: { top: -10, right: -10, cursor: "nesw-resize" },
      },
      {
        corner: "bottom-left",
        style: { bottom: -10, left: -10, cursor: "nesw-resize" },
      },
      {
        corner: "bottom-right",
        style: { bottom: -10, right: -10, cursor: "nwse-resize" },
      },
    ];

  return (
    <div
      className={cn(
        "absolute flex items-center justify-center cursor-grab select-none touch-none",
        isSelected && "z-10",
      )}
      style={{
        width: pxW,
        height: pxH,
        transform: `translate(calc(${leftPx}px - 50%), calc(${topPx}px - 50%))`,
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

      {isSelected && (
        <div
          className="pointer-events-none absolute"
          style={{
            top: -OFFSET,
            left: -OFFSET,
            right: -OFFSET,
            bottom: -OFFSET,
            border: "2px dashed rgba(255,255,255,0.6)",
          }}
        />
      )}

      {/* Resize handles — only shown when selected */}
      {isSelected &&
        cornerHandles.map(({ corner, style }) => (
          <div
            key={corner}
            data-corner={corner}
            onPointerDown={handleResizePointerDown}
            style={{
              position: "absolute",
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "white",
              border: "2px solid hsl(258 55% 58%)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              ...style,
            }}
          />
        ))}
    </div>
  );
});
