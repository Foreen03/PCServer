"use client";

import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import type { GamepadLayout, EditorAction } from "@/lib/types";
import { createEmptyLayout } from "@/lib/default-layout";
import { GamepadEditor } from "@/components/GamepadEditor";
import { MainMenu } from "@/components/MainMenu";
import { DeviceConnection } from "@/components/DeviceConnection";
import { toast } from "sonner";

function editorReducer(
  state: GamepadLayout,
  action: EditorAction,
): GamepadLayout {
  switch (action.type) {
    case "SET_FULL_STATE":
      return action.payload;

    case "SET_GAMEPAD_INFO":
      return {
        ...state,
        gamepad: { ...state.gamepad, ...action.payload },
      };

    case "SET_ORIENTATION":
      return {
        ...state,
        gamepad: { ...state.gamepad, orientation: action.payload },
      };

    case "SET_THEME_BG_COLOR":
      return {
        ...state,
        theme: { ...state.theme, backgroundColor: action.payload },
      };

    case "SET_BACKGROUND_IMAGE":
      return {
        ...state,
        theme: {
          ...state.theme,
          backgroundImage: {
            ...state.theme.backgroundImage,
            ...action.payload,
          },
        },
      };

    case "SET_BUTTON_THEME":
      return {
        ...state,
        theme: {
          ...state.theme,
          button: { ...state.theme.button, ...action.payload },
        },
      };

    case "SET_SAFE_AREA":
      return {
        ...state,
        layout: {
          ...state.layout,
          safeArea: { ...state.layout.safeArea, ...action.payload },
        },
      };

    case "ADD_COMPONENT":
      return {
        ...state,
        layout: {
          ...state.layout,
          components: [...state.layout.components, action.payload],
        },
      };

    case "UPDATE_COMPONENT":
      return {
        ...state,
        layout: {
          ...state.layout,
          components: state.layout.components.map((c) =>
            c.id === action.payload.id
              ? { ...c, ...action.payload.updates }
              : c,
          ),
        },
      };

    case "DELETE_COMPONENT":
      return {
        ...state,
        layout: {
          ...state.layout,
          components: state.layout.components.filter(
            (c) => c.id !== action.payload,
          ),
        },
      };

    case "ADD_CONFLICT_RESOLUTION":
      return {
        ...state,
        conflictsResolution: [
          ...(state.conflictsResolution || []),
          action.payload,
        ],
      };

    case "UPDATE_CONFLICT_RESOLUTION":
      return {
        ...state,
        conflictsResolution: (state.conflictsResolution || []).map(
          (cr, index) =>
            index === action.payload.index
              ? { ...cr, ...action.payload.updates }
              : cr,
        ),
      };

    case "DELETE_CONFLICT_RESOLUTION":
      return {
        ...state,
        conflictsResolution: (state.conflictsResolution || []).filter(
          (_, index) => index !== action.payload,
        ),
      };

    case "SET_CONFLICT_RESOLUTIONS":
      return {
        ...state,
        conflictsResolution: action.payload,
      };

    case "SET_CONTROLLER_MAPPING":
      return {
        ...state,
        controllerMapping: action.payload,
      };

    case "UPDATE_CONTROLLER_MAPPING":
      return {
        ...state,
        controllerMapping: {
          ...(state.controllerMapping || {
            enabled: false,
            buttonMap: {},
            axisMap: {},
            sensorMap: {},
          }),
          ...action.payload,
        },
      };

    default:
      return state;
  }
}

type AppView = "menu" | "editor" | "device-connection";

export default function Page() {
  const [view, setView] = useState<AppView>("menu");
  const [state, dispatch] = useReducer(editorReducer, createEmptyLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gattStatus, setGattStatus] = useState("stopped");
  const [activeMode, setActiveMode] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [isGpxStarted, setGpxStarted] = useState(false);
  const promiseRef = useRef<{
    resolve: () => void;
    reject: (error: string) => void;
  } | null>(null);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleNewLayout = useCallback(() => {
    dispatch({ type: "SET_FULL_STATE", payload: createEmptyLayout() });
    setSelectedId(null);
    setView("editor");
  }, []);

  const handleImportLayout = useCallback((layout: GamepadLayout) => {
    dispatch({ type: "SET_FULL_STATE", payload: layout });
    setSelectedId(null);
    setView("editor");
  }, []);

  const handleConnect = useCallback(() => {
    setView("device-connection");
  }, []);

  const handleBackToMenu = useCallback(() => {
    setView("menu");
  }, []);

  useEffect(() => {
    if (window.external && window.external.receiveMessage) {
      window.external.receiveMessage((message: string) => {
        try {
          const data = JSON.parse(message);
          switch (data.type) {
            case "log":
              setLogs((prevLogs) => [...prevLogs, data.message].slice(-100));
              if (data.message.includes("Layout sent successfully.")) {
                promiseRef.current?.resolve();
                promiseRef.current = null;
              } else if (data.message.includes("Error sending layout:")) {
                const errorMsg = data.message
                  .replace("Error sending layout:", "")
                  .trim();
                promiseRef.current?.reject(errorMsg);
                promiseRef.current = null;
              }
              break;
            case "status":
              if (data.gattStatus !== undefined) {
                setGattStatus(data.gattStatus);
              }
              if (data.activeMode !== undefined) {
                setActiveMode(data.activeMode);
              }
              if (data.connected !== undefined) {
                setConnected(data.connected);
              }
              break;
            case "data":
              break;
          }
        } catch (error) {
          setLogs((prevLogs) =>
            [...prevLogs, `[ERROR] Failed to parse message: ${message}`].slice(
              -100,
            ),
          );
        }
      });
    }
  }, []);

  const sendMessage = (payload: object) => {
    if (window.external && window.external.sendMessage) {
      window.external.sendMessage(JSON.stringify(payload));
    } else {
      setLogs((prevLogs) =>
        [...prevLogs, "Photino bridge not found."].slice(-100),
      );
    }
  };

  const handleStartServer = () => sendMessage({ action: "startServer" });
  const handleStopServer = () => {
    sendMessage({ action: "stopServer" });
    setGpxStarted(false);
  };
  const handleActivateMode = (mode: "vigem" | "custom") =>
    sendMessage({ action: "activateMode", mode });
  const handleDeactivateMode = () => {
    sendMessage({ action: "deactivateMode" });
  };
  const handleSendLayout = () => {
    const promise = new Promise<void>((resolve, reject) => {
      promiseRef.current = { resolve, reject };
    });

    toast.promise(promise, {
      loading: "Sending layout",
      success: "Layout sent successfully",
      error: (err) => `Error sending layout: ${err}`,
      position: "top-center",
    });

    sendMessage({ action: "sendLayout" });
  };

  const handleExportGpx = () => {
    sendMessage({ action: "exportGpx" });
    setGpxStarted(false);
  };

  const handleStartGpx = (lat: number, lng: number) => {
    sendMessage({ action: "startGpx", payload: { lat, lng } });
    setGpxStarted(true);
  };

  if (view === "menu") {
    return (
      <MainMenu
        onNewLayout={handleNewLayout}
        onImportLayout={handleImportLayout}
        onConnect={handleConnect}
      />
    );
  }

  if (view === "device-connection") {
    return (
      <DeviceConnection
        onBackToMenu={handleBackToMenu}
        gattStatus={gattStatus}
        activeMode={activeMode}
        logs={logs}
        connected={connected}
        onStartServer={handleStartServer}
        onStopServer={handleStopServer}
        onActivateMode={handleActivateMode}
        onDeactivateMode={handleDeactivateMode}
        onSendLayout={handleSendLayout}
        onExportGpx={handleExportGpx}
        onStartGpx={handleStartGpx}
        isGpxStarted={isGpxStarted}
      />
    );
  }

  return (
    <GamepadEditor
      state={state}
      selectedId={selectedId}
      onSelect={handleSelect}
      dispatch={dispatch}
      onBackToMenu={handleBackToMenu}
      connected={connected}
    />
  );
}
