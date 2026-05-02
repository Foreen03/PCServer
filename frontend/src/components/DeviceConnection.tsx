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
import { ArrowLeft, Cast } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
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
interface DeviceConnectionProps {
  onBackToMenu: () => void;
  gattStatus: string;
  activeMode: string;
  logs: string[];
  connected: boolean;
  onStartServer: () => void;
  onStopServer: () => void;
  onActivateMode: (mode: "vigem" | "custom") => void;
  onDeactivateMode: () => void;
  onSendLayout: () => void;
  onExportGpx: () => void;
  onStartGpx: (lat: number, lng: number) => void;
  isGpxStarted: boolean;
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
}: DeviceConnectionProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isMapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);


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
                <div className="flex flex-wrap gap-2">
                  {gattStatus === "stopped" ? (
                    <Button onClick={onStartServer}>Start GATT Server</Button>
                  ) : (
                    <Button onClick={onStopServer} variant="destructive">
                      Stop GATT Server
                    </Button>
                  )}
                </div>

                {gattStatus === "started" && !connected && (
                  <p className="text-sm text-amber-600 animate-pulse">
                    Waiting for a BLE client to connect...
                  </p>
                )}

                {gattStatus === "started" && connected && (
                  <div className="flex flex-wrap gap-2">
                    {activeMode === "" ? (
                      <>
                        <Button
                          onClick={() => onActivateMode("vigem")}
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
                      </>
                    ) : (
                      <Button onClick={onDeactivateMode} variant="outline">
                        Deactivate Mode
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

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
      </div>
    </TooltipProvider>
  );
}
