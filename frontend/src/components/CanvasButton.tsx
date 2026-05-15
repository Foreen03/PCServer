"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import type { GamepadComponent, SystemComponent, ButtonTheme, SafeArea } from "@/lib/types";
import { getComponentLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pause, Camera, EyeOff } from "lucide-react";

const SYSTEM_COMPONENT_ICON: Record<string, React.FC<any>> = {
  pause: Pause,
  screenshot: Camera,
  toggle_system_bar: EyeOff,
};

type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface CanvasButtonProps {
  component: GamepadComponent | SystemComponent;
  buttonTheme: ButtonTheme;
  isSelected: boolean;
  canvasRect: DOMRect | null;
  /** Logical device dimensions in dp (already orientation-adjusted) */
  deviceWidth: number;
  deviceHeight: number;
  safeArea: SafeArea;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSizeAndPositionChange: (
    id: string,
    newPosition: { x: number; y: number },
    newSize: { width: number; height: number },
  ) => void;
  snapToGrid?: boolean;
  gridSize?: number;
}

export const CanvasButton = React.memo(React.forwardRef<HTMLDivElement, CanvasButtonProps & Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect">>(function CanvasButton({
  component,
  buttonTheme,
  isSelected,
  canvasRect,
  deviceWidth,
  deviceHeight,
  safeArea,
  onSelect,
  onPositionChange,
  onSizeAndPositionChange,
  snapToGrid = false,
  gridSize = 20,
  ...props
}: CanvasButtonProps & Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect">, ref) {
  const isDragging = useRef(false);
  const isResizing = useRef<ResizeCorner | false>(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startNorm = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  // Start geometry for resize is stored in a ref
  const startGeom = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Safe area dimensions in device pixels
  const safeLeftPx = safeArea.left * deviceWidth;
  const safeTopPx = safeArea.top * deviceHeight;
  const safeW = deviceWidth * (1 - safeArea.left - safeArea.right);
  const safeH = deviceHeight * (1 - safeArea.top - safeArea.bottom);

  // Convert normalized safe-area position to device pixels
  const normToDevicePxX = (nx: number) => safeLeftPx + nx * safeW;
  const normToDevicePxY = (ny: number) => safeTopPx + ny * safeH;

  // Convert device pixels to normalized safe-area position
  const devicePxToNormX = (px: number) => (px - safeLeftPx) / safeW;
  const devicePxToNormY = (py: number) => (py - safeTopPx) / safeH;

  // ─── Snap helpers ──────────────────────────────────────────────────────────
  const snapPx = (valuePx: number) => {
    if (!snapToGrid) return valuePx;
    return Math.round(valuePx / gridSize) * gridSize;
  };



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

  // ─── Resolve per-component style with theme fallbacks ─────────────────────

  const resolvedBgColor =
    component.style?.backgroundColor ?? buttonTheme.backgroundColor;
  const resolvedTextColor =
    component.style?.textColor ?? buttonTheme.textColor;
  const resolvedTextSizeSp =
    component.type === "button" ? (component.style?.textSizeSp ?? buttonTheme.textSizeSp) : buttonTheme.textSizeSp;
  const showBackground = component.type === "button" ? (component.style?.showBackground !== false) : true; // default true

  // ─── Drag ────────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).dataset.corner) return;

      e.preventDefault();
      e.stopPropagation();
      onSelect(component.id);
      isDragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      startNorm.current = { x: localGeom.x, y: localGeom.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [component.id, onSelect, localGeom.x, localGeom.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!canvasRect) return;
      e.preventDefault();

      if (frame.current) return;

      frame.current = requestAnimationFrame(() => {
        frame.current = null;

        // Safe area pixel dimensions on screen (rendered)
        const screenSafeW = canvasRect.width * (1 - safeArea.left - safeArea.right);
        const screenSafeH = canvasRect.height * (1 - safeArea.top - safeArea.bottom);

        // ── Drag ──────────────────────────────────────────────────────────
        if (isDragging.current) {
          const deltaX = (e.clientX - startPos.current.x) / screenSafeW;
          const deltaY = (e.clientY - startPos.current.y) / screenSafeH;
          let newX = Math.max(0, Math.min(1, startNorm.current.x + deltaX));
          let newY = Math.max(0, Math.min(1, startNorm.current.y + deltaY));
          
          if (snapToGrid) {
            const pxW = localGeom.w * deviceWidth;
            const pxH = localGeom.h * deviceHeight;
            const rawLeftPx = normToDevicePxX(newX) - pxW / 2;
            const rawTopPx = normToDevicePxY(newY) - pxH / 2;
            const snappedLeftPx = snapPx(rawLeftPx);
            const snappedTopPx = snapPx(rawTopPx);
            newX = devicePxToNormX(snappedLeftPx + pxW / 2);
            newY = devicePxToNormY(snappedTopPx + pxH / 2);
          }

          setLocalGeom((g) => ({ ...g, x: newX, y: newY }));
          return;
        }

        // ── Resize ────────────────────────────────────────────────────────
        if (!isResizing.current) return;

        const corner = isResizing.current;
        const start = startGeom.current;

        // Start center in device pixels (within safe area coordinate system)
        const startCX = normToDevicePxX(start.x);
        const startCY = normToDevicePxY(start.y);
        const startPxW = start.w * deviceWidth;
        const startPxH = start.h * deviceHeight;

        const halfW = startPxW / 2;
        const halfH = startPxH / 2;

        const fixedLeft = startCX - halfW;
        const fixedRight = startCX + halfW;
        const fixedTop = startCY - halfH;
        const fixedBottom = startCY + halfH;

        // Current cursor in device pixels
        const curPxX =
          ((e.clientX - canvasRect.left) / canvasRect.width) * deviceWidth;
        const curPxY =
          ((e.clientY - canvasRect.top) / canvasRect.height) * deviceHeight;

        const minPx = 0.05 * Math.min(deviceWidth, deviceHeight);

        let newLeft = fixedLeft;
        let newRight = fixedRight;
        let newTop = fixedTop;
        let newBottom = fixedBottom;

        if (corner.includes("right")) {
          newRight = Math.max(fixedLeft + minPx, curPxX);
        } else if (corner.includes("left")) {
          newLeft = Math.min(fixedRight - minPx, curPxX);
        }

        if (corner.includes("bottom")) {
          newBottom = Math.max(fixedTop + minPx, curPxY);
        } else if (corner.includes("top")) {
          newTop = Math.min(fixedBottom - minPx, curPxY);
        }

        let newPxW = newRight - newLeft;
        let newPxH = newBottom - newTop;

        if (snapToGrid) {
            newPxW = Math.max(gridSize, Math.round(newPxW / gridSize) * gridSize);
            newPxH = Math.max(gridSize, Math.round(newPxH / gridSize) * gridSize);
            
            // Adjust the moving edge based on the snapped size
            if (corner.includes("right")) newRight = fixedLeft + newPxW;
            else if (corner.includes("left")) newLeft = fixedRight - newPxW;

            if (corner.includes("bottom")) newBottom = fixedTop + newPxH;
            else if (corner.includes("top")) newTop = fixedBottom - newPxH;
        }

        // Enforce minimum sizes
        if (newPxW < minPx) {
            newPxW = snapToGrid ? Math.max(snapPx(minPx), gridSize) : minPx;
            if (corner.includes("right")) newRight = fixedLeft + newPxW;
            else if (corner.includes("left")) newLeft = fixedRight - newPxW;
        }
        if (newPxH < minPx) {
            newPxH = snapToGrid ? Math.max(snapPx(minPx), gridSize) : minPx;
            if (corner.includes("bottom")) newBottom = fixedTop + newPxH;
            else if (corner.includes("top")) newTop = fixedBottom - newPxH;
        }

        if (component.shape === "circle") {
          const d = Math.min(newPxW, newPxH);
          if (corner.includes("right")) newRight = fixedLeft + d;
          else if (corner.includes("left")) newLeft = fixedRight - d;
          if (corner.includes("bottom")) newBottom = fixedTop + d;
          else if (corner.includes("top")) newTop = fixedBottom - d;
          newPxW = d;
          newPxH = d;
        }

        let newCX = newLeft + newPxW / 2;
        let newCY = newTop + newPxH / 2;

        setLocalGeom({
          x: devicePxToNormX(newCX),
          y: devicePxToNormY(newCY),
          w: newPxW / deviceWidth,
          h: newPxH / deviceHeight,
        });
      });
    },
    [canvasRect, component.shape, deviceWidth, deviceHeight, safeArea, snapToGrid, gridSize, localGeom],
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

  // Position mapped to safe area
  const leftPx = normToDevicePxX(localGeom.x);
  const topPx = normToDevicePxY(localGeom.y);
  const fontSize = Math.max(8, resolvedTextSizeSp * (deviceHeight / 800));
  const rectRadius = Math.min(pxW, pxH) * 0.3;

  const displayLabel = getComponentLabel(component);

  const cornerHandles: { corner: ResizeCorner; style: React.CSSProperties }[] =
    [
      {
        corner: "top-left",
        style: { top: -6, left: -6, cursor: "nwse-resize" },
      },
      {
        corner: "top-right",
        style: { top: -6, right: -6, cursor: "nesw-resize" },
      },
      {
        corner: "bottom-left",
        style: { bottom: -6, left: -6, cursor: "nesw-resize" },
      },
      {
        corner: "bottom-right",
        style: { bottom: -6, right: -6, cursor: "nwse-resize" },
      },
    ];

  // Determine background style
  const bgStyle: React.CSSProperties = showBackground
    ? { backgroundColor: resolvedBgColor }
    : { backgroundColor: "transparent" };

  return (
    <div
      {...props}
      ref={ref}
      className={cn(
        "absolute flex items-center justify-center cursor-grab select-none touch-none",
        isSelected && "z-10",
        props.className
      )}
      style={{
        width: pxW,
        height: pxH,
        transform: `translate(calc(${leftPx}px - 50%), calc(${topPx}px - 50%))`,
        borderRadius: isCircle ? "50%" : `${rectRadius}px`,
        ...bgStyle,
        color: resolvedTextColor,
        fontSize,
        boxShadow: showBackground
          ? "0 2px 8px rgba(0,0,0,0.25)"
          : "none",
        outline: "none",
        ...props.style
      }}
      onPointerDown={(e) => {
        props.onPointerDown?.(e);
        handlePointerDown(e);
      }}
      onPointerMove={(e) => {
        props.onPointerMove?.(e);
        handlePointerMove(e);
      }}
      onPointerUp={(e) => {
        props.onPointerUp?.(e);
        handlePointerUp(e);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        props.onContextMenu?.(e);
      }}
      role="button"
      tabIndex={props.tabIndex ?? 0}
      aria-label={`${displayLabel} button`}
    >
      {/* Render content based on type */}
      {component.type === "button" && component.content.type === "text" ? (
        <span className="pointer-events-none font-semibold text-center leading-tight truncate px-1">
          {component.content.text}
        </span>
      ) : component.type === "button" && component.content.type === "image" ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            overflow: "hidden",
            borderRadius: isCircle ? "50%" : `${rectRadius}px`,
          }}
        >
          <img
            src={component.content.image.value}
            alt={displayLabel}
            className="w-full h-full"
            style={{
              objectFit:
                component.content.image.scaleType === "fit"
                  ? "contain"
                  : component.content.image.scaleType === "crop"
                    ? "cover"
                    : "fill",
            }}
            draggable={false}
          />
        </div>
      ) : component.type !== "button" ? (() => {
        const Icon = SYSTEM_COMPONENT_ICON[component.type] || Pause;
        const minDim = Math.min(pxW, pxH);
        const iconSize = minDim * 0.5;
        return (
          <Icon
            style={{ width: iconSize, height: iconSize, color: resolvedTextColor }}
            fill={component.type === "pause" ? resolvedTextColor : "none"}
          />
        );
      })() : null}

      {isSelected && (
        <div
          className="pointer-events-none absolute"
          style={{
            top: -1,
            left: -1,
            right: -1,
            bottom: -1,
            border: "2px dashed rgba(255,255,255,0.8)",
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
}));
