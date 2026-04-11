"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bluetooth, ChevronLeft } from "lucide-react";

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
}: DeviceConnectionProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <Button
          onClick={onBackToMenu}
          variant="ghost"
          className="mb-4 text-muted-foreground"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Menu
        </Button>
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Bluetooth className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>PC Receiver</CardTitle>
                <CardDescription>
                  Manage GATT server and BLE device connections
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Status</h4>
              <div className="p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              </div>
            </div>

            {/* Actions Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Actions</h4>
              <div className="p-4 border rounded-lg space-y-4">
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
              </ScrollArea>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Ensure your mobile device is discoverable and in range.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
