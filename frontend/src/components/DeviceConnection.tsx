"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Cast, Gamepad2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import MapSelector from "./MapSelector";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// To fix the issue with the marker icon
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface GamepadSummary {
  Id: string;
  Name: string;
  Description: string;
  Orientation: string;
  Version: number;
  CreatedAt: string;
  UpdatedAt: string;
}

interface DeviceConnectionProps {
  onBackToMenu: () => void;
  gattStatus: string;
  activeMode: string;
  logs: string[];
  connected: boolean;
  onStartServer: () => void;
  onStopServer: () => void;
  onActivateMode: (mode: "vigem" | "custom", controllerMappingJson?: string) => void;
  onDeactivateMode: () => void;
  onSendLayout: () => void;
  onExportGpx: () => void;
  onStartGpx: (lat: number, lng: number) => void;
  isGpxStarted: boolean;
  sendMessage: (payload: object) => void;
  vigemGamepads: GamepadSummary[];
  loadingVigemGamepads: boolean;
  onRequestVigemGamepads: () => void;
  onFetchGamepadForVigem: (gamepadId: string) => Promise<string>;
}

export function DeviceConnection({
  onBackToMenu,
  gattStatus,
  activeMode,
  logs,
  connected,
  onStartServer,
  onStopServer,
  onActivateMode,
  onDeactivateMode,
  onSendLayout,
  onExportGpx,
  onStartGpx,
  isGpxStarted,
  vigemGamepads,
  loadingVigemGamepads,
  onRequestVigemGamepads,
  onFetchGamepadForVigem,
}: DeviceConnectionProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isMapOpen, setMapOpen] = useState(false);
  const [isVigemDialogOpen, setVigemDialogOpen] = useState(false);
  const [loadingGamepadId, setLoadingGamepadId] = useState<string | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleOpenVigemDialog = useCallback(() => {
    setVigemDialogOpen(true);
    onRequestVigemGamepads();
  }, [onRequestVigemGamepads]);

  const handleSelectGamepad = useCallback(
    async (gamepad: GamepadSummary) => {
      setLoadingGamepadId(gamepad.Id);
      try {
        const layoutJson = await onFetchGamepadForVigem(gamepad.Id);
        // Parse the layout JSON to extract controllerMapping
        try {
          const layoutObj = JSON.parse(layoutJson);
          const controllerMapping = layoutObj.controllerMapping;
          if (controllerMapping) {
            const mappingJson = JSON.stringify({ controllerMapping });
            onActivateMode("vigem", mappingJson);
          } else {
            onActivateMode("vigem", "");
          }
        } catch {
          onActivateMode("vigem", "");
        }
        setVigemDialogOpen(false);
      } finally {
        setLoadingGamepadId(null);
      }
    },
    [onFetchGamepadForVigem, onActivateMode],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen">
        {/* Top Toolbar */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
                <Cast className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground">
                PC Receiver
              </h1>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground truncate">
              <p className="text-xs text-muted-foreground text-center">
                Manage GATT server and BLE device connections
              </p>
            </span>
          </div>
        </header>

        {/* Main Content Area */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-4xl space-y-6 px-4">
            {/* Status Section */}
            <div className="space-y-3 pt-4">
              <h4 className="text-sm font-medium text-foreground">Status</h4>
              <div className="p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    GATT Server:
                  </span>
                  <Badge
                    variant={
                      gattStatus === "started" ? "default" : "destructive"
                    }
                    className="capitalize"
                  >
                    {gattStatus}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Connection:
                  </span>
                  <Badge
                    variant={connected ? "default" : "outline"}
                    className="capitalize"
                  >
                    {connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Active Mode:
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {activeMode || "None"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Gpx Trail:
                  </span>
                  <Badge
                    variant={
                      isGpxStarted ? "default" : "destructive"
                    }
                    className="capitalize"
                  >
                    {isGpxStarted?"Started":"Stopped"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actions Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Actions</h4>
              <div className="p-4 border rounded-lg space-y-4 bg-card">
                <div className="flex flex-wrap items-center gap-2">
                  {gattStatus === "stopped" ? (
                    <Button onClick={onStartServer}>Start GATT Server</Button>
                  ) : (
                    <Button onClick={onStopServer} variant="destructive">
                      Stop GATT Server
                    </Button>
                  )}

                  {gattStatus === "started" && connected && (
                    <>
                      {activeMode === "" ? (
                        <>
                          <Button
                            onClick={handleOpenVigemDialog}
                            variant="outline"
                          >
                            Activate Vigem Mode
                          </Button>
                          <Button
                            onClick={() => onActivateMode("custom")}
                            variant="outline"
                          >
                            Activate Custom Plugin
                          </Button>
                          <Button
                            onClick={() => onSendLayout()}
                            variant="outline"
                          >
                            Send Layout
                          </Button>
                        </>
                      ) : (
                        <Button onClick={onDeactivateMode} variant="outline">
                          Deactivate Mode
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {gattStatus === "started" && !connected && (
                  <p className="text-sm text-amber-600 animate-pulse">
                    Waiting for a BLE client to connect...
                  </p>
                )}
              </div>
            </div>

            {/* GPX Section */}
            {gattStatus === "started" && connected && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">Gpx Trail</h4>
                <div className="p-4 border rounded-lg bg-card">
                  <div id="gpx" className="flex flex-wrap gap-2">
                    <Dialog open={isMapOpen} onOpenChange={setMapOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" disabled={isGpxStarted}>Start GPX Trail</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Select starting point</DialogTitle>
                        </DialogHeader>
                        <MapSelector
                          onLocationSelect={(lat, lng) => {
                            onStartGpx(lat, lng);
                            setMapOpen(false);
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      onClick={() => onExportGpx()}
                      variant="outline"
                      disabled={!isGpxStarted}
                    >
                      Export Gpx
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Logs Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Logs</h4>
              <ScrollArea className="h-48 w-full p-4 border rounded-lg bg-secondary/30">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {logs.length > 0 ? logs.join("\n") : "No logs yet..."}
                </pre>
                <div ref={logEndRef} />
              </ScrollArea>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-4">
              Ensure your mobile device is discoverable and in range.
            </p>
          </div>
        </ScrollArea>

        {/* Vigem Gamepad Selection Dialog */}
        <Dialog open={isVigemDialogOpen} onOpenChange={setVigemDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Mapping for ViGEm</DialogTitle>
              <DialogDescription>
                Choose a gamepad with controller mapping enabled to use with ViGEm mode.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {loadingVigemGamepads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading gamepads...</span>
                </div>
              ) : vigemGamepads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Gamepad2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No gamepads with controller mapping enabled found.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Enable controller mapping in the gamepad editor first.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {vigemGamepads.map((gp) => (
                      <button
                        key={gp.Id}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors text-left disabled:opacity-50"
                        onClick={() => handleSelectGamepad(gp)}
                        disabled={loadingGamepadId !== null}
                      >
                        <div className="flex-shrink-0 w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center">
                          {loadingGamepadId === gp.Id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Gamepad2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {gp.Name}
                          </p>
                          {gp.Description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {gp.Description}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {gp.Orientation}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            v{gp.Version}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
