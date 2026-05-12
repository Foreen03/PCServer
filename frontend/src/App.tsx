"use client";

import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import type { GamepadLayout, EditorAction } from "@/lib/types";
import { createEmptyLayout } from "@/lib/default-layout";
import { GamepadEditor } from "@/components/GamepadEditor";
import { MainMenu } from "@/components/MainMenu";
import { DeviceConnection } from "@/components/DeviceConnection";
import { GamepadLibrary } from "@/components/GamepadLibrary";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

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

    case "ADD_SYSTEM_COMPONENT":
      return {
        ...state,
        layout: {
          ...state.layout,
          systemComponents: [
            ...(state.layout.systemComponents || []),
            action.payload,
          ],
        },
      };

    case "UPDATE_SYSTEM_COMPONENT":
      return {
        ...state,
        layout: {
          ...state.layout,
          systemComponents: (state.layout.systemComponents || []).map((sc) =>
            sc.id === action.payload.id
              ? { ...sc, ...action.payload.updates }
              : sc,
          ),
        },
      };

    case "DELETE_SYSTEM_COMPONENT":
      return {
        ...state,
        layout: {
          ...state.layout,
          systemComponents: (state.layout.systemComponents || []).filter(
            (sc) => sc.id !== action.payload,
          ),
        },
      };

    default:
      return state;
  }
}

type AppView = "menu" | "editor" | "device-connection" | "library";

export default function Page() {
  const [view, setView] = useState<AppView>("menu");
  const [state, dispatch] = useReducer(editorReducer, createEmptyLayout());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const previousViewRef = useRef<AppView>("menu");
  const [gattStatus, setGattStatus] = useState("stopped");
  const [activeMode, setActiveMode] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [isGpxStarted, setGpxStarted] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const promiseRef = useRef<{
    resolve: () => void;
    reject: (error: string) => void;
  } | null>(null);
  const saveDbPromiseRef = useRef<{
    resolve: () => void;
    reject: (error: string) => void;
  } | null>(null);

  // Vigem gamepad selection state
  const [vigemGamepads, setVigemGamepads] = useState<Array<{
    Id: string;
    Name: string;
    Description: string;
    Orientation: string;
    Version: number;
    CreatedAt: string;
    UpdatedAt: string;
  }>>([]);
  const [loadingVigemGamepads, setLoadingVigemGamepads] = useState(false);
  const vigemGamepadCallbackRef = useRef<((layout: string) => void) | null>(null);

  // Track dirty state: any dispatch after SET_FULL_STATE marks dirty
  const lastSavedStateRef = useRef<string>("");

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  // Check dirty state whenever state changes
  useEffect(() => {
    if (view === "editor") {
      const currentJson = JSON.stringify(state);
      setIsDirty(currentJson !== lastSavedStateRef.current);
    }
  }, [state, view]);

  const handleNewLayout = useCallback(() => {
    const newLayout = createEmptyLayout();
    dispatch({ type: "SET_FULL_STATE", payload: newLayout });
    lastSavedStateRef.current = JSON.stringify(newLayout);
    setSelectedId(null);
    setIsDirty(false);
    previousViewRef.current = view;
    setView("editor");
  }, [view]);

  const handleOpenLayout = useCallback((layout: GamepadLayout) => {
    dispatch({ type: "SET_FULL_STATE", payload: layout });
    lastSavedStateRef.current = JSON.stringify(layout);
    setSelectedId(null);
    setIsDirty(false);
    previousViewRef.current = view;
    setView("editor");
  }, [view]);

  const handleOpenLibrary = useCallback(() => {
    setView("library");
  }, []);

  const handleConnect = useCallback(() => {
    setView("device-connection");
  }, []);

  // Navigation with unsaved-changes guard
  const navigateWithGuard = useCallback(
    (action: () => void) => {
      if (isDirty) {
        pendingNavigationRef.current = action;
        setShowUnsavedDialog(true);
      } else {
        action();
      }
    },
    [isDirty],
  );

  const handleBackToMenu = useCallback(() => {
    if (view === "editor") {
      const target = previousViewRef.current === "library" ? "library" : "menu";
      navigateWithGuard(() => {
        setView(target);
      });
    } else {
      setView("menu");
    }
  }, [view, navigateWithGuard]);

  const handleUnsavedDialogSaveAndExit = useCallback(() => {
    // Save then navigate
    handleSaveToDb(() => {
      setShowUnsavedDialog(false);
      pendingNavigationRef.current?.();
      pendingNavigationRef.current = null;
    });
  }, [state]);

  const handleUnsavedDialogExit = useCallback(() => {
    setShowUnsavedDialog(false);
    setIsDirty(false);
    pendingNavigationRef.current?.();
    pendingNavigationRef.current = null;
  }, []);

  const handleUnsavedDialogCancel = useCallback(() => {
    setShowUnsavedDialog(false);
    pendingNavigationRef.current = null;
  }, []);

  // Save to SQLite
  const handleSaveToDb = useCallback(
    (onSuccess?: () => void) => {
      const sendMessage = (payload: object) => {
        if (window.external && window.external.sendMessage) {
          window.external.sendMessage(JSON.stringify(payload));
        }
      };

      const jsonLayout = JSON.stringify(state, null, 2);

      const promise = new Promise<void>((resolve, reject) => {
        saveDbPromiseRef.current = {
          resolve: () => {
            lastSavedStateRef.current = jsonLayout;
            setIsDirty(false);
            resolve();
            onSuccess?.();
          },
          reject,
        };
      });

      toast.promise(promise, {
        loading: "Saving to library...",
        success: "Saved to library",
        error: (err) => `Save failed: ${err}`,
        position: "top-center",
      });

      sendMessage({
        action: "saveGamepadToDb",
        id: state.gamepad.id,
        name: state.gamepad.name,
        description: state.gamepad.description,
        orientation: state.gamepad.orientation,
        layout: jsonLayout,
      });
    },
    [state],
  );

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
            case "dbSaveResult":
              if (data.status === "success") {
                saveDbPromiseRef.current?.resolve();
              } else {
                saveDbPromiseRef.current?.reject(
                  data.error || "Unknown save error",
                );
              }
              saveDbPromiseRef.current = null;
              break;
            case "data":
              break;
            case "vigemGamepadList":
              setVigemGamepads(data.gamepads || []);
              setLoadingVigemGamepads(false);
              break;
            case "dbGamepadData":
              // If there's a pending vigem callback, handle it
              if (vigemGamepadCallbackRef.current && data.layout) {
                vigemGamepadCallbackRef.current(data.layout);
                vigemGamepadCallbackRef.current = null;
              }
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
  const handleActivateMode = (mode: "vigem" | "custom", controllerMappingJson?: string) =>
    sendMessage({ action: "activateMode", mode, controllerMappingJson: controllerMappingJson ?? "" });
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
        onOpenLibrary={handleOpenLibrary}
        onConnect={handleConnect}
      />
    );
  }

  if (view === "library") {
    return (
      <GamepadLibrary
        onBackToMenu={handleBackToMenu}
        onOpenLayout={handleOpenLayout}
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
        sendMessage={sendMessage}
        vigemGamepads={vigemGamepads}
        loadingVigemGamepads={loadingVigemGamepads}
        onRequestVigemGamepads={() => {
          setLoadingVigemGamepads(true);
          sendMessage({ action: "getVigemGamepads" });
        }}
        onFetchGamepadForVigem={(gamepadId: string) => {
          return new Promise<string>((resolve) => {
            vigemGamepadCallbackRef.current = resolve;
            sendMessage({ action: "getGamepad", id: gamepadId });
          });
        }}
      />
    );
  }

  return (
    <>
      <GamepadEditor
        state={state}
        selectedId={selectedId}
        onSelect={handleSelect}
        dispatch={dispatch}
        onBackToMenu={handleBackToMenu}
        connected={connected}
        onSaveToDb={() => handleSaveToDb()}
        isDirty={isDirty}
      />

      {/* Unsaved Changes Dialog */}
      <AlertDialog
        open={showUnsavedDialog}
        onOpenChange={(open) => {
          if (!open) handleUnsavedDialogCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleUnsavedDialogCancel}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleUnsavedDialogExit}>
              Exit without saving
            </Button>
            <AlertDialogAction onClick={handleUnsavedDialogSaveAndExit}>
              Save and Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
