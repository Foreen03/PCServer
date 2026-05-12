import type { GamepadLayout } from "./types"

// Empty layout for "New Layout"
export const emptyLayout: GamepadLayout = {
  version: 2,
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
      backgroundColor: "#6750A4",
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
    systemComponents: [
      {
        type: "pause",
        id: "pause_button",
        position: { x: 0.5, y: 0.048 },
        size: { width: 0.15, height: 0.15 },
        shape: "circle",
        style: {
          backgroundColor: "#6750A4",
          textColor: "#FFFFFF",
        },
      },
      {
        type: "screenshot",
        id: "screenshot_button",
        position: { x: 0.024, y: 0.048 },
        size: { width: 0.15, height: 0.15 },
        shape: "circle",
        style: {
          backgroundColor: "#FF9800",
          textColor: "#FFFFFF",
        },
      },
      {
        type: "toggle_system_bar",
        id: "toggle_system_bar",
        position: { x: 0.112, y: 0.048 },
        size: { width: 0.15, height: 0.15 },
        shape: "circle",
        style: {
          backgroundColor: "#2196F3",
          textColor: "#0000FF",
        },
      },
    ],
  },
  conflictsResolution: [],
}

// Create a fresh empty layout with a new ID
export function createEmptyLayout(): GamepadLayout {
  return {
    ...emptyLayout,
    gamepad: {
      ...emptyLayout.gamepad,
      id: crypto.randomUUID?.() || `layout_${Date.now()}`,
    },
    layout: {
      ...emptyLayout.layout,
      systemComponents: emptyLayout.layout.systemComponents?.map((sc) => ({
        ...sc,
      })),
    },
  }
}

// Sample layout (from NewLayout.json)
export const defaultLayout: GamepadLayout = {
  version: 2,
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
      backgroundColor: "#6750A4",
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
        command: "jump",
        content: {
          type: "text",
          text: "Jump",
        },
        style: {
          backgroundColor: "#4CAF50",
          textColor: "#FFFFFF",
          pressedAlpha: 0.4,
          textSizeSp: 28,
          showBackground: true,
        },
      },
      {
        type: "button",
        id: "btn_fire",
        position: { x: 0.75, y: 0.6 },
        size: { width: 0.36, height: 0.36 },
        shape: "circle",
        command: "fire",
        content: {
          type: "image",
          image: {
            type: "url",
            value:
              "https://i.postimg.cc/65MnP8Fj/plufow-le-studio-5Q6y-ZN8cku-Y-unsplash.jpg",
            scaleType: "fill",
          },
        },
        style: {
          showBackground: false,
          pressedAlpha: 0.5,
        },
      },
    ],
    systemComponents: [
      {
        type: "pause",
        id: "pause_button",
        position: { x: 0.5, y: 0.048 },
        size: { width: 0.1, height: 0.1 },
        shape: "circle",
        style: {
          backgroundColor: "#6750A4",
          textColor: "#FFFF00",
        },
      },
      {
        type: "screenshot",
        id: "screenshot_button",
        position: { x: 0.024, y: 0.048 },
        size: { width: 0.1, height: 0.1 },
        shape: "circle",
        style: {
          backgroundColor: "#FF9800",
          textColor: "#FFFF00",
        },
      },
      {
        type: "toggle_system_bar",
        id: "toggle_system_bar",
        position: { x: 0.072, y: 0.048 },
        size: { width: 0.1, height: 0.1 },
        shape: "circle",
        style: {
          backgroundColor: "#2196F3",
          textColor: "#0000FF",
        },
      },
    ],
  },
  conflictsResolution: [
    {
      name: "testing",
      mode: "priority",
      commands: ["fire", "jump"],
      priority: ["fire", "jump"],
    },
  ],
  controllerMapping: {
    enabled: false,
    buttonMap: {},
    axisMap: {},
    sensorMap: {},
  },
}
