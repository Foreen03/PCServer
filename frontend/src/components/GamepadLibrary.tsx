"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Gamepad2,
  AlertCircle,
  Clock,
  Smartphone,
  Monitor,
  FolderOpen,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type { GamepadLayout } from "@/lib/types";
import { validateGamepadLayout } from "@/lib/types";

interface GamepadSummary {
  Id: string;
  Name: string;
  Description: string;
  Orientation: string;
  Version: number;
  CreatedAt: string;
  UpdatedAt: string;
}

interface GamepadLibraryProps {
  onBackToMenu: () => void;
  onOpenLayout: (layout: GamepadLayout) => void;
}

export function GamepadLibrary({
  onBackToMenu,
  onOpenLayout,
}: GamepadLibraryProps) {
  const [gamepads, setGamepads] = useState<GamepadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GamepadSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingActionRef = useRef<string | null>(null);

  const sendMessage = (payload: object) => {
    if (window.external && window.external.sendMessage) {
      window.external.sendMessage(JSON.stringify(payload));
    }
  };

  const loadGamepads = () => {
    setLoading(true);
    pendingActionRef.current = "list";
    sendMessage({ action: "getAllGamepads" });
  };

  useEffect(() => {
    if (window.external && window.external.receiveMessage) {
      window.external.receiveMessage((message: string) => {
        try {
          const data = JSON.parse(message);

          if (data.type === "dbGamepadList") {
            setGamepads(data.gamepads || []);
            setLoading(false);
            if (data.error) {
              setError(data.error);
            }
          }

          if (data.type === "dbGamepadData") {
            if (data.layout) {
              try {
                const parsed = JSON.parse(data.layout);
                const validation = validateGamepadLayout(parsed);
                if (validation.valid) {
                  onOpenLayout(parsed as GamepadLayout);
                } else {
                  setError(
                    validation.error || "Invalid layout data in database"
                  );
                }
              } catch {
                setError("Failed to parse saved layout data");
              }
            } else if (data.error) {
              setError(data.error);
            }
          }

          if (data.type === "dbDeleteResult") {
            if (data.status === "success") {
              loadGamepads();
            } else if (data.error) {
              setError(data.error);
            }
          }
        } catch {
          // Ignore non-JSON messages
        }
      });
    }

    loadGamepads();
  }, []);

  const handleOpen = (id: string) => {
    setError(null);
    sendMessage({ action: "getGamepad", id });
  };

  const handleDelete = (gamepad: GamepadSummary) => {
    setDeleteTarget(gamepad);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      sendMessage({ action: "deleteGamepad", id: deleteTarget.Id });
      setDeleteTarget(null);
    }
  };

  const handleFileSelect = async (file: File) => {
    setError(null);

    if (!file.name.endsWith(".json")) {
      setError("Please select a JSON file");
      return;
    }

    try {
      const text = await file.text();
      let data: unknown;

      try {
        data = JSON.parse(text);
      } catch {
        setError("Invalid JSON format: Could not parse file");
        return;
      }

      const validation = validateGamepadLayout(data);
      if (!validation.valid) {
        setError(validation.error || "Invalid layout format");
        return;
      }

      onOpenLayout(data as GamepadLayout);
    } catch {
      setError("Failed to read file");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = "";
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "Z");
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen bg-background">
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
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground">
                Saved Layouts
              </h1>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground truncate">
              Manage your saved gamepad layouts
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  <span className="sr-only">Import JSON</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import JSON</TooltipContent>
            </Tooltip>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleInputChange}
          />
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-7xl space-y-6 px-4 pt-4 pb-8 w-full">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">
                Loading saved layouts...
              </p>
            </div>
          </div>
        ) : gamepads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Gamepad2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              No saved layouts
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create a new layout in the editor and save it, or import an
              existing JSON file.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import JSON
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gamepads.map((gp) => (
              <Card
                key={gp.Id}
                className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                onClick={() => handleOpen(gp.Id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Gamepad2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm truncate">
                          {gp.Name}
                        </CardTitle>
                        <CardDescription className="text-xs truncate mt-0.5">
                          {gp.Description || "No description"}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(gp);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {gp.Orientation === "landscape" ? (
                        <Monitor className="h-3 w-3" />
                      ) : (
                        <Smartphone className="h-3 w-3" />
                      )}
                      {gp.Orientation}
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      v{gp.Version}
                    </Badge>
                    <div className="flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {formatDate(gp.UpdatedAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.Name}"? This action
              cannot be reverted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
