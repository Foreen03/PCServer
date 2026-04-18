"use client";

import { useRef, useState, useEffect } from "react";
import { Upload, Download, Smartphone, Monitor, ArrowLeft } from "lucide-react";
import type { GamepadLayout, EditorAction } from "@/lib/types";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PhoneCanvas, PHONE_DEVICES } from "./PhoneCanvas";
import type { PhoneDevice } from "./PhoneCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
// import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";

interface GamepadEditorProps {
  state: GamepadLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dispatch: React.Dispatch<EditorAction>;
  onBackToMenu?: () => void;
  connected: boolean;
}

export function GamepadEditor({
  state,
  selectedId,
  onSelect,
  dispatch,
  onBackToMenu,
  connected,
}: GamepadEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<PhoneDevice>(
    PHONE_DEVICES[0],
  );
  const promiseRef = useRef<{
    resolve: () => void;
    reject: (error: string) => void;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.external) {
      const messageHandler = (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          if (parsedMessage.type === "log") {
            if (parsedMessage.message.includes("Layout sent successfully.")) {
              promiseRef.current?.resolve();
              promiseRef.current = null;
            } else if (
              parsedMessage.message.includes("Error sending layout:")
            ) {
              const errorMsg = parsedMessage.message
                .replace("Error sending layout:", "")
                .trim();
              promiseRef.current?.reject(errorMsg);
              promiseRef.current = null;
            }
          }
        } catch (e) {
          console.error("Failed to parse external message:", e);
        }
      };

      window.external.receiveMessage(messageHandler);
    }
  }, []);

  const handleExport = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.gamepad.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed && parsed.version && parsed.gamepad && parsed.layout) {
          dispatch({ type: "SET_FULL_STATE", payload: parsed });
          onSelect(null);
        }
      } catch {
        // Invalid JSON - silently ignore
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSendToPhone = () => {
    const promise = new Promise<void>((resolve, reject) => {
      promiseRef.current = { resolve, reject };
    });

    toast.promise(promise, {
      loading: "Sending layout",
      success: "Layout sent successfully",
      error: (err) => `Error sending layout: ${err}`,
      position: "top-center",
    });

    const json = JSON.stringify(state, null, 2);
    const message = {
      action: "sendLayoutWithoutWindow",
      layout: json,
    };
    window.external.sendMessage(JSON.stringify(message));
  };

  const handleDeviceChange = (deviceId: string) => {
    const dev = PHONE_DEVICES.find((d) => d.id === deviceId);
    if (dev) setSelectedDevice(dev);
  };

  const isLandscape = state.gamepad.orientation === "landscape";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen">
        {/* Top Toolbar */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            {onBackToMenu && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onBackToMenu}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to menu</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back to menu</TooltipContent>
              </Tooltip>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground">
                Gamepad Editor
              </h1>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground truncate max-w-40">
              {state.gamepad.name}
            </span>
            <div className="h-4 w-px bg-border" />

            {/* Device Selector */}
            <Select
              value={selectedDevice.id}
              onValueChange={handleDeviceChange}
            >
              <SelectTrigger className="h-8 w-56 text-xs bg-background border-border">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Apple
                </div>
                {PHONE_DEVICES.filter(
                  (d) => d.id.startsWith("iphone") || d.id.startsWith("ipad"),
                ).map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name}{" "}
                    <span className="text-muted-foreground ml-1">
                      {d.width}x{d.height}
                    </span>
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Android
                </div>
                {PHONE_DEVICES.filter(
                  (d) =>
                    d.id.startsWith("pixel") ||
                    d.id.startsWith("samsung") ||
                    d.id.startsWith("oneplus"),
                ).map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name}{" "}
                    <span className="text-muted-foreground ml-1">
                      {d.width}x{d.height}
                    </span>
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Other
                </div>
                {PHONE_DEVICES.filter((d) => d.id.startsWith("custom")).map(
                  (d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.name}{" "}
                      <span className="text-muted-foreground ml-1">
                        {d.width}x{d.height}
                      </span>
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            {/* Orientation toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={() =>
                    dispatch({
                      type: "SET_ORIENTATION",
                      payload: isLandscape ? "portrait" : "landscape",
                    })
                  }
                >
                  {isLandscape ? (
                    <Monitor className="h-3.5 w-3.5" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5" />
                  )}
                  {isLandscape ? "Landscape" : "Portrait"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle orientation</TooltipContent>
            </Tooltip>

            <div className="h-4 w-px bg-border" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleImport}
                >
                  <Upload className="h-4 w-4" />
                  <span className="sr-only">Import JSON</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Export JSON</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSendToPhone}
                    disabled={!connected}
                  >
                    <Smartphone className="h-4 w-4" />
                    <span className="sr-only">Send Layout</span>
                  </Button>
                  {!connected && (
                    <div className="absolute inset-0 bg-background/60 cursor-not-allowed" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {connected
                  ? "Send Layout"
                  : "No device connected. Go to the connection page."}
              </TooltipContent>
            </Tooltip>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </header>

        {/* Main Content */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={60} minSize={35}>
            <PhoneCanvas
              state={state}
              selectedId={selectedId}
              onSelect={onSelect}
              dispatch={dispatch}
              device={selectedDevice}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={25} maxSize={55}>
            <PropertiesPanel
              state={state}
              selectedId={selectedId}
              onSelect={onSelect}
              dispatch={dispatch}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
