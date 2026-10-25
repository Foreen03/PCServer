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
import { ArrowLeft, Cast, Download, FolderOpen, Gamepad2, Loader2, MapPin, X, HelpCircle } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  onExportStepLogs?: (showDialog?: boolean) => void;
  stepLogCount?: number;
  onStartGpx: (lat: number, lng: number) => void;
  isGpxStarted: boolean;
  sendMessage: (payload: object) => void;
  vigemGamepads: GamepadSummary[];
  loadingVigemGamepads: boolean;
  onRequestVigemGamepads: () => void;
  onFetchGamepadForVigem: (gamepadId: string) => Promise<string>;
  onStartTour?: () => void;
}

const GPX_START_POINT_KEY = "gpx-start-point";

function loadSavedStartPoint(): { lat: number; lng: number } | null {
  try {
    const saved = localStorage.getItem(GPX_START_POINT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
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
  onExportStepLogs,
  stepLogCount,
  onStartGpx,
  isGpxStarted,
  sendMessage,
  vigemGamepads,
  loadingVigemGamepads,
  onRequestVigemGamepads,
  onFetchGamepadForVigem,
  onStartTour,
}: DeviceConnectionProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isMapOpen, setMapOpen] = useState(false);
  const [isVigemDialogOpen, setVigemDialogOpen] = useState(false);
  const [loadingGamepadId, setLoadingGamepadId] = useState<string | null>(null);
  const [gpxStartPoint, setGpxStartPoint] = useState<{ lat: number; lng: number } | null>(loadSavedStartPoint);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSaveStartPoint = useCallback((lat: number, lng: number) => {
    const point = { lat, lng };
    setGpxStartPoint(point);
    localStorage.setItem(GPX_START_POINT_KEY, JSON.stringify(point));
    setMapOpen(false);
    toast.success(`Start point set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, {
      position: "top-center",
    });
  }, []);

  const handleStartGpxWithSaved = useCallback(() => {
    if (gpxStartPoint) {
      onStartGpx(gpxStartPoint.lat, gpxStartPoint.lng);
    }
  }, [gpxStartPoint, onStartGpx]);

  const handleOpenVigemDialog = useCallback(() => {
    setVigemDialogOpen(true);
    onRequestVigemGamepads();
  }, [onRequestVigemGamepads]);

  const handleActivateDefaultVigem = useCallback(() => {
    onActivateMode("vigem", "");
    setVigemDialogOpen(false);
    toast.success("ViGEm mode activated with default Xbox 360 mapping");
  }, [onActivateMode]);

  const handleSelectGamepad = useCallback(
    async (gamepad: GamepadSummary) => {
      const id = gamepad.Id || (gamepad as any).id;
      if (!id) {
        toast.error("Invalid gamepad ID");
        return;
      }
      setLoadingGamepadId(id);
      try {
        const layoutJson = await onFetchGamepadForVigem(id);
        if (!layoutJson) {
          onActivateMode("vigem", "");
          toast.info("No custom mapping data found. Activated ViGEm with default mapping.");
          setVigemDialogOpen(false);
          return;
        }

        try {
          const layoutObj = typeof layoutJson === "string" ? JSON.parse(layoutJson) : layoutJson;
          const controllerMapping = layoutObj.controllerMapping || layoutObj.Mapping;
          if (controllerMapping) {
            const mappingToSend = {
              controllerMapping: {
                ...controllerMapping,
                enabled: true,
              },
            };
            onActivateMode("vigem", JSON.stringify(mappingToSend));
            toast.success(`ViGEm mode activated with mapping: ${gamepad.Name || (gamepad as any).name || "Selected Layout"}`);
          } else {
            onActivateMode("vigem", "");
            toast.info("No custom controller mapping found. Activated ViGEm with default mapping.");
          }
        } catch {
          onActivateMode("vigem", "");
          toast.info("Activated ViGEm mode with default mapping.");
        }
        setVigemDialogOpen(false);
      } catch (err: any) {
        toast.error(`Error loading layout: ${err?.message || "Unknown error"}`);
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
          {onStartTour && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onStartTour}
                  >
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="sr-only">Start Tour Guide</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start Tour Guide</TooltipContent>
              </Tooltip>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-4xl space-y-6 px-4">
            {/* Status Section */}
            <div id="tour-connection-status" className="space-y-3 pt-4">
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
                    {isGpxStarted ? "Started" : "Stopped"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actions Section */}
            <div id="tour-connection-actions" className="space-y-3">
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
            <div id="tour-connection-gpx" className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Gpx Trail</h4>
              <div className="p-4 border rounded-lg bg-card space-y-4">
                {/* Saved start point display */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Start Point:</span>
                  </div>
                  {gpxStartPoint ? (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {gpxStartPoint.lat.toFixed(6)}, {gpxStartPoint.lng.toFixed(6)}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground/60 italic">Not set</span>
                  )}
                </div>

                <div id="gpx" className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setMapOpen(true)}
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    Select Start Point
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isGpxStarted || gattStatus !== "started" || !connected || !gpxStartPoint || activeMode === "custom"}
                    onClick={handleStartGpxWithSaved}
                  >
                    Start GPX Trail
                  </Button>
                  <Button
                    onClick={() => onExportGpx()}
                    variant="outline"
                    disabled={!isGpxStarted || gattStatus !== "started" || !connected}
                  >
                    Export Gpx
                  </Button>
                  <Button
                    onClick={() => sendMessage({ action: "openScreenshotFolder" })}
                    variant="outline"
                    size="default"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Screenshots
                  </Button>
                  <Button
                    onClick={() => sendMessage({ action: "openGpxFolder" })}
                    variant="outline"
                    size="default"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    GPX Files
                  </Button>
                  <Button
                    onClick={() => onExportStepLogs?.(true)}
                    variant="outline"
                    size="default"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export Step Logs
                  </Button>
                  <Button
                    onClick={() => sendMessage({ action: "openLogsFolder" })}
                    variant="outline"
                    size="default"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Step Logs
                  </Button>
                </div>
              </div>
            </div>

            {/* Logs Section */}
            <div id="tour-connection-logs" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground">Logs</h4>
                  {stepLogCount !== undefined && stepLogCount > 0 && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {stepLogCount} step {stepLogCount === 1 ? "entry" : "entries"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExportStepLogs?.(true)}
                    className="h-8 text-xs"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export Step Logs (.txt)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage({ action: "openLogsFolder" })}
                    className="h-8 text-xs"
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1" />
                    Logs Folder
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-48 w-full p-4 border rounded-lg bg-secondary/30">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {logs.length > 0 ? logs.join("\n") : "No logs yet..."}
                </pre>
                <div ref={logEndRef} />
              </ScrollArea>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-4 mb-4">
              Ensure your mobile device is discoverable and in range.
            </p>
          </div>
        </ScrollArea>

        {/* Full-screen Map Overlay for Start Point Selection */}
        {isMapOpen && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Select Starting Point
                  </h2>
                </div>
                {gpxStartPoint && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <Badge variant="secondary" className="font-mono text-xs">
                      {gpxStartPoint.lat.toFixed(6)}, {gpxStartPoint.lng.toFixed(6)}
                    </Badge>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMapOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close map</span>
              </Button>
            </header>
            <div className="flex-1">
              <MapSelector
                onLocationSelect={handleSaveStartPoint}
                initialPosition={gpxStartPoint}
                height="100%"
              />
            </div>
          </div>
        )}

        {/* Vigem Gamepad Selection Dialog */}
        <Dialog open={isVigemDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setLoadingGamepadId(null);
          }
          setVigemDialogOpen(open);
        }}>
          <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 p-6 overflow-hidden">
            <DialogHeader className="shrink-0 pb-3">
              <DialogTitle>Select Mapping for ViGEm</DialogTitle>
              <DialogDescription>
                Choose a gamepad with controller mapping enabled to use with ViGEm mode.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden py-1">
              {loadingVigemGamepads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading gamepads...</span>
                </div>
              ) : vigemGamepads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <Gamepad2 className="h-10 w-10 text-muted-foreground/50" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      No gamepads with controller mapping enabled found.
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Enable controller mapping in the gamepad editor first, or continue with standard Xbox 360 mapping.
                    </p>
                  </div>
                  <Button
                    onClick={handleActivateDefaultVigem}
                    size="sm"
                    className="mt-2"
                  >
                    Activate with Default Mapping
                  </Button>
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2">
                  {vigemGamepads.map((gp) => {
                    const id = gp.Id || (gp as any).id || "";
                    const name = gp.Name || (gp as any).name || "Untitled Layout";
                    const description = gp.Description || (gp as any).description || "";
                    const orientation = gp.Orientation || (gp as any).orientation || "landscape";
                    const version = gp.Version || (gp as any).version || 1;

                    return (
                      <button
                        key={id}
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors text-left disabled:opacity-50 overflow-hidden"
                        onClick={() => handleSelectGamepad(gp)}
                        disabled={loadingGamepadId !== null}
                      >
                        <div className="shrink-0 w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center">
                          {loadingGamepadId === id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Gamepad2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-sm font-medium text-foreground truncate">
                            {name}
                          </p>
                          {description ? (
                            <p className="text-xs text-muted-foreground truncate">
                              {description}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5 ml-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {orientation}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            v{version}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <DialogFooter className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-2 pt-4 mt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleActivateDefaultVigem}
                disabled={loadingGamepadId !== null}
              >
                Use Default Mapping
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVigemDialogOpen(false)}
                disabled={loadingGamepadId !== null}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
