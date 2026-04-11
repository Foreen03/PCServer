"use client";

import { useRef, useState } from "react";
import {
  FilePlus,
  Upload,
  Gamepad2,
  AlertCircle,
  Bluetooth,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GamepadLayout } from "@/lib/types";
import { validateGamepadLayout } from "@/lib/types";

interface MainMenuProps {
  onNewLayout: () => void;
  onImportLayout: (layout: GamepadLayout) => void;
  onConnect: () => void;
}

export function MainMenu({
  onNewLayout,
  onImportLayout,
  onConnect,
}: MainMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

      onImportLayout(data as GamepadLayout);
    } catch {
      setError("Failed to read file");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-background">
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <Gamepad2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gamepad Layout Editor
          </h1>
          <p className="text-muted-foreground max-w-md">
            Create and customize mobile game controller layouts for your Jetpack
            Compose applications
          </p>
        </div>

        {/* Menu Cards */}
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-4xl">
          {/* New Layout Card */}
          <Card
            className="flex-1 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            onClick={onNewLayout}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <FilePlus className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>New Layout</CardTitle>
            </CardHeader>
            <CardDescription className="mt-8"></CardDescription>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full cursor-pointer">
                Create New
              </Button>
            </CardContent>
          </Card>

          {/* Import Layout Card */}
          <Card
            className={`flex-1 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${
              isDragging ? "border-primary border-2 bg-primary/5" : ""
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Import Layout</CardTitle>
            </CardHeader>
            <CardDescription className="mt-8"></CardDescription>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full cursor-pointer">
                Select File
              </Button>
            </CardContent>
          </Card>

          <Card
            className={`flex-1 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5`}
            onClick={onConnect}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Bluetooth className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>PC Receiver</CardTitle>
            </CardHeader>
            <CardDescription className="mt-8"></CardDescription>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full cursor-pointer">
                Connect
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleInputChange}
        />

        {/* Error alert */}
        {error && (
          <Alert variant="destructive" className="mt-6 max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Import Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Footer info */}
        <p className="text-xs text-muted-foreground mt-12 text-center max-w-md">
          Layouts are saved as JSON files compatible with Jetpack Compose
          gamepad overlay systems
        </p>
      </div>
    </div>
  );
}
