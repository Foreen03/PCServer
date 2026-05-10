"use client";

import {
  FilePlus,
  FolderOpen,
  Gamepad2,
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

interface MainMenuProps {
  onNewLayout: () => void;
  onOpenLibrary: () => void;
  onConnect: () => void;
}

export function MainMenu({
  onNewLayout,
  onOpenLibrary,
  onConnect,
}: MainMenuProps) {
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

          {/* Saved Layouts Card */}
          <Card
            className="flex-1 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            onClick={onOpenLibrary}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Saved Layouts</CardTitle>
            </CardHeader>
            <CardDescription className="mt-8"></CardDescription>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full cursor-pointer">
                Browse
              </Button>
            </CardContent>
          </Card>

          <Card
            className="flex-1 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
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

        {/* Footer info */}
        <p className="text-xs text-muted-foreground mt-12 text-center max-w-md">
          Layouts are saved as JSON files compatible with Jetpack Compose
          gamepad overlay systems
        </p>
      </div>
    </div>
  );
}
