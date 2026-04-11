export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export type ComponentShape = "circle" | "rectangle"
export type Orientation = "portrait" | "landscape"
export type ScaleType = "fill" | "fit" | "crop"

export interface GamepadComponent {
  type: "button"
  id: string
  position: Position
  size: Size
  shape: ComponentShape
  label: string
  command: string
}

export interface BackgroundImage {
  enabled: boolean
  type: "url" | "base64"
  value: string
  scaleType: ScaleType
}

export interface ButtonTheme {
  color: string
  pressedAlpha: number
  textColor: string
  textSizeSp: number
}

export interface Theme {
  backgroundColor: string
  backgroundImage: BackgroundImage
  button: ButtonTheme
}

export interface SafeArea {
  top: number
  bottom: number
  left: number
  right: number
}

export interface Layout {
  safeArea: SafeArea
  components: GamepadComponent[]
}

export interface Gamepad {
  id: string
  name: string
  description: string
  orientation: Orientation
}

export interface GamepadLayout {
  version: number
  gamepad: Gamepad
  theme: Theme
  layout: Layout
}

// Type guards and validators
export function isPosition(obj: unknown): obj is Position {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Position).x === "number" &&
    typeof (obj as Position).y === "number"
  )
}

export function isSize(obj: unknown): obj is Size {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Size).width === "number" &&
    typeof (obj as Size).height === "number"
  )
}

export function isComponentShape(value: unknown): value is ComponentShape {
  return value === "circle" || value === "rectangle"
}

export function isOrientation(value: unknown): value is Orientation {
  return value === "portrait" || value === "landscape"
}

export function isScaleType(value: unknown): value is ScaleType {
  return value === "fill" || value === "fit" || value === "crop"
}

export function isGamepadComponent(obj: unknown): obj is GamepadComponent {
  if (typeof obj !== "object" || obj === null) return false
  const c = obj as GamepadComponent
  return (
    c.type === "button" &&
    typeof c.id === "string" &&
    isPosition(c.position) &&
    isSize(c.size) &&
    isComponentShape(c.shape) &&
    typeof c.label === "string" &&
    typeof c.command === "string"
  )
}

export function isBackgroundImage(obj: unknown): obj is BackgroundImage {
  if (typeof obj !== "object" || obj === null) return false
  const bg = obj as BackgroundImage
  return (
    typeof bg.enabled === "boolean" &&
    (bg.type === "url" || bg.type === "base64") &&
    typeof bg.value === "string" &&
    isScaleType(bg.scaleType)
  )
}

export function isButtonTheme(obj: unknown): obj is ButtonTheme {
  if (typeof obj !== "object" || obj === null) return false
  const bt = obj as ButtonTheme
  return (
    typeof bt.color === "string" &&
    typeof bt.pressedAlpha === "number" &&
    typeof bt.textColor === "string" &&
    typeof bt.textSizeSp === "number"
  )
}

export function isTheme(obj: unknown): obj is Theme {
  if (typeof obj !== "object" || obj === null) return false
  const t = obj as Theme
  return (
    typeof t.backgroundColor === "string" &&
    isBackgroundImage(t.backgroundImage) &&
    isButtonTheme(t.button)
  )
}

export function isSafeArea(obj: unknown): obj is SafeArea {
  if (typeof obj !== "object" || obj === null) return false
  const sa = obj as SafeArea
  return (
    typeof sa.top === "number" &&
    typeof sa.bottom === "number" &&
    typeof sa.left === "number" &&
    typeof sa.right === "number"
  )
}

export function isLayout(obj: unknown): obj is Layout {
  if (typeof obj !== "object" || obj === null) return false
  const l = obj as Layout
  return (
    isSafeArea(l.safeArea) &&
    Array.isArray(l.components) &&
    l.components.every(isGamepadComponent)
  )
}

export function isGamepad(obj: unknown): obj is Gamepad {
  if (typeof obj !== "object" || obj === null) return false
  const g = obj as Gamepad
  return (
    typeof g.id === "string" &&
    typeof g.name === "string" &&
    typeof g.description === "string" &&
    isOrientation(g.orientation)
  )
}

export function isGamepadLayout(obj: unknown): obj is GamepadLayout {
  if (typeof obj !== "object" || obj === null) return false
  const gl = obj as GamepadLayout
  return (
    typeof gl.version === "number" &&
    isGamepad(gl.gamepad) &&
    isTheme(gl.theme) &&
    isLayout(gl.layout)
  )
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateGamepadLayout(data: unknown): ValidationResult {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Invalid JSON: Expected an object" }
  }

  const obj = data as Record<string, unknown>

  if (typeof obj.version !== "number") {
    return { valid: false, error: "Missing or invalid 'version' field (expected number)" }
  }

  if (!isGamepad(obj.gamepad)) {
    return { valid: false, error: "Invalid 'gamepad' field: must have id, name, description (strings) and orientation ('portrait' or 'landscape')" }
  }

  if (!obj.theme || typeof obj.theme !== "object") {
    return { valid: false, error: "Missing or invalid 'theme' field" }
  }

  const theme = obj.theme as Record<string, unknown>
  if (typeof theme.backgroundColor !== "string") {
    return { valid: false, error: "Invalid 'theme.backgroundColor' (expected string)" }
  }
  if (!isBackgroundImage(theme.backgroundImage)) {
    return { valid: false, error: "Invalid 'theme.backgroundImage': must have enabled (boolean), type ('url'|'base64'), value (string), scaleType ('fill'|'fit'|'crop')" }
  }
  if (!isButtonTheme(theme.button)) {
    return { valid: false, error: "Invalid 'theme.button': must have color, textColor (strings), pressedAlpha, textSizeSp (numbers)" }
  }

  if (!obj.layout || typeof obj.layout !== "object") {
    return { valid: false, error: "Missing or invalid 'layout' field" }
  }

  const layout = obj.layout as Record<string, unknown>
  if (!isSafeArea(layout.safeArea)) {
    return { valid: false, error: "Invalid 'layout.safeArea': must have top, bottom, left, right (numbers)" }
  }

  if (!Array.isArray(layout.components)) {
    return { valid: false, error: "Invalid 'layout.components': expected an array" }
  }

  for (let i = 0; i < layout.components.length; i++) {
    if (!isGamepadComponent(layout.components[i])) {
      return { valid: false, error: `Invalid component at index ${i}: must have type 'button', id, label, command (strings), position {x, y}, size {width, height}, shape ('circle'|'rectangle')` }
    }
  }

  return { valid: true }
}

// Reducer action types
export type EditorAction =
  | { type: "SET_FULL_STATE"; payload: GamepadLayout }
  | { type: "SET_GAMEPAD_INFO"; payload: Partial<Gamepad> }
  | { type: "SET_ORIENTATION"; payload: Orientation }
  | { type: "SET_THEME_BG_COLOR"; payload: string }
  | { type: "SET_BACKGROUND_IMAGE"; payload: Partial<BackgroundImage> }
  | { type: "SET_BUTTON_THEME"; payload: Partial<ButtonTheme> }
  | { type: "SET_SAFE_AREA"; payload: Partial<SafeArea> }
  | { type: "ADD_COMPONENT"; payload: GamepadComponent }
  | { type: "UPDATE_COMPONENT"; payload: { id: string; updates: Partial<GamepadComponent> } }
  | { type: "DELETE_COMPONENT"; payload: string }
