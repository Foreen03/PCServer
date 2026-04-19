import type { GamepadLayout } from "./types"

// Empty layout for "New Layout"
export const emptyLayout: GamepadLayout = {
  version: 1,
  gamepad: {
    id: crypto.randomUUID?.() || `layout_${Date.now()}`,
    name: "New Layout",
    description: "",
    orientation: "landscape",
  },
  theme: {
    backgroundColor: "#1a1a2e",
    backgroundImage: {
      enabled: false,
      type: "url",
      value: "",
      scaleType: "fill",
    },
    button: {
      color: "#6750A4",
      pressedAlpha: 0.8,
      textColor: "#FFFFFF",
      textSizeSp: 24,
    },
  },
  layout: {
    safeArea: {
      top: 0.05,
      bottom: 0.05,
      left: 0.04,
      right: 0.04,
    },
    components: [],
  },
  conflictsResolution: [
    
  ],
}

// Create a fresh empty layout with a new ID
export function createEmptyLayout(): GamepadLayout {
  return {
    ...emptyLayout,
    gamepad: {
      ...emptyLayout.gamepad,
      id: crypto.randomUUID?.() || `layout_${Date.now()}`,
    },
  }
}

// Sample layout (from NewLayout.json)
export const defaultLayout: GamepadLayout = {
  version: 1,
  gamepad: {
    id: "123456",
    name: "New Controller 2",
    description: "Controller layout sent by pc 2",
    orientation: "landscape",
  },
  theme: {
    backgroundColor: "#CAE7D3",
    backgroundImage: {
      enabled: true,
      type: "url",
      value:
        "https://i.postimg.cc/65MnP8Fj/plufow-le-studio-5Q6y-ZN8cku-Y-unsplash.jpg",
      scaleType: "fill",
    },
    button: {
      color: "#6750A4",
      pressedAlpha: 0.6,
      textColor: "#FFFFFF",
      textSizeSp: 32,
    },
  },
  layout: {
    safeArea: {
      top: 0.05,
      bottom: 0.05,
      left: 0.04,
      right: 0.04,
    },
    components: [
      {
        type: "button",
        id: "btn_jump",
        position: { x: 0.25, y: 0.6 },
        size: { width: 0.36, height: 0.36 },
        shape: "circle",
        label: "Jumps",
        command: "jump",
      },
      {
        type: "button",
        id: "btn_fire",
        position: { x: 0.75, y: 0.6 },
        size: { width: 0.36, height: 0.36 },
        shape: "circle",
        label: "Fires",
        command: "fire",
      },
    ],
  },
  conflictsResolution: [],
  controllerMapping: {
    enabled: false,
    buttonMap: {},
    axisMap: {},
    sensorMap: {},
  }
}

