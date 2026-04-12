"use client";

import { useReducer, useState, useCallback, useEffect } from "react";
import type { GamepadLayout, EditorAction } from "@/lib/types";
import { createEmptyLayout } from "@/lib/default-layout";
import { GamepadEditor } from "@/components/GamepadEditor";
import { MainMenu } from "@/components/MainMenu";
import { DeviceConnection } from "@/components/DeviceConnection";

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
          setLogs((prevLogs) => [
            ...prevLogs,
            `[ERROR] Failed to parse message: ${message}`,
          ].slice(-100));
        }
      });
    }
  }, []);

  const sendMessage = (payload: object) => {
    if (window.external && window.external.sendMessage) {
      window.external.sendMessage(JSON.stringify(payload));
    } else {
      setLogs((prevLogs) => [...prevLogs, "Photino bridge not found."].slice(-100));
    }
  };

  const handleStartServer = () => sendMessage({ action: "startServer" });
  const handleStopServer = () => sendMessage({ action: "stopServer" });
  const handleActivateMode = (mode: "vigem" | "custom") =>
    sendMessage({ action: "activateMode", mode });
  const handleDeactivateMode = () => sendMessage({ action: "deactivateMode" });
  const handleSendLayout = () => sendMessage({action: "sendLayout"});

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
    />
  );
}
