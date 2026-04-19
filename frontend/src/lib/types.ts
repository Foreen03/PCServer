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

export interface ConflictResolution {
  name: string;
  mode: "priority";
  commands: string[];
  priority: string[];
}

export function isConflictResolution(obj: unknown): obj is ConflictResolution {
  if (typeof obj !== "object" || obj === null) return false;
  const cr = obj as ConflictResolution;
  return (
    typeof cr.name === "string" &&
    cr.mode === "priority" &&
    Array.isArray(cr.commands) &&
    cr.commands.every((c) => typeof c === "string") &&
    Array.isArray(cr.priority) &&
    cr.priority.every((p) => typeof p === "string")
  );
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
  conflictsResolution?: ConflictResolution[]
  controllerMapping?: ControllerMapping
}

export interface ButtonMap {
  [command: string]: string;
}

export interface AxisConfig {
  target: string;
  mode: "tilt";
  source: "x" | "y" | "z";
  deadzone: number;
  scale: number;
  smoothing: number;
  invert: boolean;
}

export interface AxisMap {
  [command: string]: AxisConfig;
}

export interface SensorThresholds {
  start?: number;
  stop?: number;
}

export interface SensorConfig {
  target: string;
  mode: "toggle";
  thresholds: SensorThresholds;
}

export interface SensorMap {
  [command: string]: SensorConfig;
}

export interface ControllerMapping {
  enabled: boolean;
  buttonMap: ButtonMap;
  axisMap: AxisMap;
  sensorMap: SensorMap;
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
  const baseValidation =
    typeof gl.version === "number" &&
    isGamepad(gl.gamepad) &&
    isTheme(gl.theme) &&
    isLayout(gl.layout)

  if (!baseValidation) return false

  // Optional conflictsResolution
  if (gl.conflictsResolution !== undefined) {
    if (!Array.isArray(gl.conflictsResolution)) return false
    if (!gl.conflictsResolution.every(isConflictResolution)) return false
  }

  if (gl.controllerMapping !== undefined) {
    if (!isControllerMapping(gl.controllerMapping)) return false
  }

  return true
}

export function isControllerMapping(obj: unknown): obj is ControllerMapping {
    if (typeof obj !== "object" || obj === null) return false;
    const cm = obj as ControllerMapping;
    return (
        typeof cm.enabled === "boolean" &&
        isButtonMap(cm.buttonMap) &&
        isAxisMap(cm.axisMap) &&
        isSensorMap(cm.sensorMap)
    );
}

export function isButtonMap(obj: unknown): obj is ButtonMap {
    if (typeof obj !== "object" || obj === null) return false;
    for (const key in obj) {
        if (typeof (obj as ButtonMap)[key] !== 'string') return false;
    }
    return true;
}

export function isAxisMap(obj: unknown): obj is AxisMap {
    if (typeof obj !== "object" || obj === null) return false;
    for (const key in obj) {
        if (!isAxisConfig((obj as AxisMap)[key])) return false;
    }
    return true;
}

export function isAxisConfig(obj: unknown): obj is AxisConfig {
    if (typeof obj !== "object" || obj === null) return false;
    const ac = obj as AxisConfig;
    return (
        typeof ac.target === "string" &&
        ac.mode === "tilt" &&
        (ac.source === "x" || ac.source === "y" || ac.source === "z") &&
        typeof ac.deadzone === "number" &&
        typeof ac.scale === "number" &&
        typeof ac.smoothing === "number" &&
        typeof ac.invert === "boolean"
    );
}

export function isSensorMap(obj: unknown): obj is SensorMap {
    if (typeof obj !== "object" || obj === null) return false;
    for (const key in obj) {
        if (!isSensorConfig((obj as SensorMap)[key])) return false;
    }
    return true;
}

export function isSensorConfig(obj: unknown): obj is SensorConfig {
    if (typeof obj !== "object" || obj === null) return false;
    const sc = obj as SensorConfig;
    return (
        typeof sc.target === "string" &&
        sc.mode === "toggle" &&
        isSensorThresholds(sc.thresholds)
    );
}

export function isSensorThresholds(obj: unknown): obj is SensorThresholds {
    if (typeof obj !== "object" || obj === null) return false;
    const st = obj as SensorThresholds;
    return typeof st.start === "number" && typeof st.stop === "number";
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

  if (obj.conflictsResolution !== undefined) {
    if (!Array.isArray(obj.conflictsResolution)) {
        return { valid: false, error: "Invalid 'conflictsResolution': expected an array" };
    }
    for (let i = 0; i < obj.conflictsResolution.length; i++) {
        if (!isConflictResolution(obj.conflictsResolution[i])) {
            return { valid: false, error: `Invalid item at index ${i} in 'conflictsResolution'` };
        }
    }
  }

  if (obj.controllerMapping !== undefined) {
    if (!isControllerMapping(obj.controllerMapping)) {
        return { valid: false, error: "Invalid 'controllerMapping' object." };
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
  | { type: "ADD_CONFLICT_RESOLUTION"; payload: ConflictResolution }
  | { type: "UPDATE_CONFLICT_RESOLUTION"; payload: { index: number; updates: Partial<ConflictResolution> } }
  | { type: "DELETE_CONFLICT_RESOLUTION"; payload: number }
  | { type: "SET_CONFLICT_RESOLUTIONS"; payload: ConflictResolution[] }
  | { type: "SET_CONTROLLER_MAPPING"; payload: ControllerMapping }
  | { type: "UPDATE_CONTROLLER_MAPPING"; payload: Partial<ControllerMapping> }
