import type { TourStep } from "@/components/tour";
import {
  Gamepad2,
  Sparkles,
  FolderOpen,
  Radio,
  Pencil,
  Smartphone,
  RefreshCw,
  Grid3X3,
  Save,
  Monitor,
  Settings2,
  Target,
  FileText,
  Palette,
  Ruler,
  Shield,
  Zap,
  Rocket,
  MapPin,
  Folder,
  Upload,
  Lightbulb
} from "lucide-react";

export const menuSteps: TourStep[] = [
  {
    selectorId: "tour-main-header",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" /> Welcome to BlueStep
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Welcome to the ultimate tool for mobile gamepad mapping! BlueStep lets you design custom touch controller layouts and use your phone as a Bluetooth gamepad.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-new-layout",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" /> Create Custom Layouts
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Click here to design a brand-new gamepad layout. Drag, resize, and configure buttons, joysticks, and touch areas to match your gaming style.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-saved-layouts",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" /> Saved Layouts Library
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Manage and browse your saved gamepad configurations. You can load them back into the editor or delete old layouts from the database.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-pc-receiver",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-muted-foreground shrink-0" /> PC Receiver & Server
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connect your phone over Bluetooth. Here you can start the GATT server, activate Xbox controller emulation (ViGEm), and record GPX trails for location-based games.
        </p>
      </div>
    ),
  },
];

export const editorSteps: TourStep[] = [
  {
    selectorId: "tour-editor-header",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Pencil className="w-4 h-4 text-muted-foreground shrink-0" /> Gamepad Editor
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Welcome to the editor! Here you can customize buttons and map them to standard controller axes and buttons.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-device-select",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" /> Target Device Select
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Select the model of your mobile device. The canvas size and safe areas will automatically adjust to fit the device's screen aspects.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-orientation",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" /> Toggle Orientation
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Switch the gamepad layout orientation between Portrait and Landscape to match your design requirements.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-grid",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Grid3X3 className="w-4 h-4 text-muted-foreground shrink-0" /> Grid Alignment
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enable grid snapping and select size intervals to make aligning buttons and control pads precise and clean.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-save",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Save className="w-4 h-4 text-muted-foreground shrink-0" /> Save to Library
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Save your current gamepad layout progress to the local database, allowing you to load it later or stream it directly.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-canvas",
    position: "right",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Monitor className="w-4 h-4 text-muted-foreground shrink-0" /> Interactive Canvas
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The central canvas displays your virtual touchscreen layout. You can drag and resize components freely.
        </p>
        <div className="text-xs border-t pt-1.5 mt-1.5 border-border space-y-1">
          <p className="font-medium text-foreground"><Lightbulb className="w-3.5 h-3.5 text-yellow-500 inline mr-1 shrink-0" /> Right-Click Actions:</p>
          <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
            <li>Right-click a button to Duplicate, Delete, or open Edit Properties (Quick Edit modal).</li>
            <li>Right-click the canvas background to quickly Add Button or add System Components (Screenshot, Pause).</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-properties-header",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" /> Properties Overview
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This sidebar is your command center. Its controls change dynamically: select a button on the canvas to configure individual properties, or click the canvas background to adjust global layout options.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-info",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" /> Gamepad Metadata
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure global layout details, such as layout name, author description, and orientation.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-theme",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-muted-foreground shrink-0" /> Styling & Themes
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Customize global colors, select custom background images, and set button style defaults (opacity, size).
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-safe-area",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Ruler className="w-4 h-4 text-muted-foreground shrink-0" /> Safe Area Margins
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Define safety margin scales to avoid key controls from overlapping with phone camera notches, bezels, or round screen corners.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-system",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Monitor className="w-4 h-4 text-muted-foreground shrink-0" /> System Components
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure default utility functions on your controller, such as taking screenshots or toggling the navigation bar, and define their screen shape and position.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-components-list",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Target className="w-4 h-4 text-muted-foreground shrink-0" /> Component Settings
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Use the Components list to select, inspect, or add touch buttons. When selected, configure custom sizes, labels, and color overrides here.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-conflict",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-muted-foreground shrink-0" /> Conflict Resolution
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Prioritize overlap behaviors: drag commands to order priority keys when multiple touch button zones intersect.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-mapping",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" /> Controller Mapping Rules
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Assign virtual Xbox 360 controls to screen elements. Set up <strong>Tilt-to-Steer</strong> gyroscope inputs or bind pedometer-based <strong>Steps Mapping</strong> cadences to gamepad triggers.
        </p>
      </div>
    ),
  },
];

export const connectionSteps: TourStep[] = [
  {
    selectorId: "tour-connection-status",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-muted-foreground shrink-0" /> Connection Status
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Monitor the GATT Server status, Bluetooth client connection state, active mapping mode, and GPX recording status in real time.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-connection-actions",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Rocket className="w-4 h-4 text-muted-foreground shrink-0" /> Control Actions
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Start or stop the Bluetooth server. When a client is connected, you can activate the ViGEm emulator, activate custom plugin integrations, or send layout configurations.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-connection-gpx",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" /> GPX Location Trails
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose a GPS start point using the interactive Leaflet map, start GPX recording, and export route data to simulate joystick-guided GPS movement.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-connection-logs",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" /> System Logs
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          View background system operations, Bluetooth connection events, mapping activations, and error logs for easier troubleshooting.
        </p>
      </div>
    ),
  },
];

export const librarySteps: TourStep[] = [
  {
    selectorId: "tour-library-header",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" /> Saved Layouts Library
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Welcome to your library! Here you can manage all gamepad layouts stored in your local database.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-library-import",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-muted-foreground shrink-0" /> Import Layouts
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Easily import existing layout configurations in `.bsl` format by clicking this button.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-library-content",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" /> Manage Configurations
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          View layout names, orientations, versions, and update times. Hover over a layout card to see options to edit or delete it.
        </p>
      </div>
    ),
  },
];

export const fullSteps: TourStep[] = [
  // MENU STAGE
  {
    selectorId: "tour-main-header",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" /> Welcome to BlueStep
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Let's explore BlueStep! BlueStep allows you to connect your mobile device as a Bluetooth gamepad and create custom layouts.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-new-layout",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" /> Create Layouts
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Clicking this option opens the Gamepad Editor. Let's see what that looks like!
        </p>
      </div>
    ),
  },
  // EDITOR STAGE
  {
    selectorId: "tour-editor-header",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Pencil className="w-4 h-4 text-muted-foreground shrink-0" /> Gamepad Editor View
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This is the editor. Here you can place and drag touch elements like buttons and joysticks.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-device-select",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" /> Choose Target Device
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Set your exact mobile phone model to calibrate the visual safe areas and layout size limits.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-grid",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Grid3X3 className="w-4 h-4 text-muted-foreground shrink-0" /> Grid Alignment
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Toggle grid snapping and change the grid size (dp) to position buttons with precision.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-canvas",
    position: "right",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Monitor className="w-4 h-4 text-muted-foreground shrink-0" /> Drag-and-Drop Canvas
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The central canvas displays your virtual touchscreen layout. You can drag and resize components freely.
        </p>
        <div className="text-xs border-t pt-1.5 mt-1.5 border-border space-y-1">
          <p className="font-medium text-foreground"><Lightbulb className="w-3.5 h-3.5 text-yellow-500 inline mr-1 shrink-0" /> Right-Click Actions:</p>
          <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
            <li>Right-click a button to Duplicate, Delete, or open Edit Properties (Quick Edit modal).</li>
            <li>Right-click the canvas background to quickly Add Button or add System Components (Screenshot, Pause).</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-properties",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" /> Properties Overview
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This sidebar is your command center. Its controls change dynamically: select a button on the canvas to configure individual properties, or click the canvas background to adjust global layout options.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-info",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" /> Gamepad Metadata
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure global layout details, such as layout name, author description, and orientation.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-theme",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-muted-foreground shrink-0" /> Styling & Themes
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Customize global colors, select custom background images, and set button style defaults (opacity, size).
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-safe-area",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Ruler className="w-4 h-4 text-muted-foreground shrink-0" /> Safe Area Margins
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Define safety margin scales to avoid key controls from overlapping with phone camera notches, bezels, or round screen corners.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-system",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Monitor className="w-4 h-4 text-muted-foreground shrink-0" /> System Components
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure default utility functions on your controller, such as taking screenshots or toggling the navigation bar, and define their screen shape and position.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-components-list",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Target className="w-4 h-4 text-muted-foreground shrink-0" /> Component Settings
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Use the Components list to select, inspect, or add touch buttons. When selected, configure custom sizes, labels, and color overrides here.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-conflict",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-muted-foreground shrink-0" /> Conflict Resolution
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Prioritize overlap behaviors: drag commands to order priority keys when multiple touch button zones intersect.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-properties-mapping",
    position: "left",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" /> Controller Mapping Rules
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Assign virtual Xbox 360 controls to screen elements. Set up <strong>Tilt-to-Steer</strong> gyroscope inputs or bind pedometer-based <strong>Steps Mapping</strong> cadences to gamepad triggers.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-editor-save",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Save className="w-4 h-4 text-muted-foreground shrink-0" /> Save Layout
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Once your design is ready, save it to your local library. Next, let's look at how to connect a device.
        </p>
      </div>
    ),
  },
  // BACK TO MENU / PC RECEIVER STAGE
  {
    selectorId: "tour-pc-receiver",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-muted-foreground shrink-0" /> PC Receiver Panel
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Let's jump into the PC Receiver page, which sets up the Bluetooth server to link your mobile client to the PC.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-connection-status",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-muted-foreground shrink-0" /> BLE Connection Status
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Monitor your GATT Server activity, phone connection indicators, active plugin mappings, and GPX status in one view.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-connection-actions",
    position: "bottom",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Rocket className="w-4 h-4 text-muted-foreground shrink-0" /> Start & Emulate
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Activate GATT server, hook up ViGEm controller drivers to emulate a physical Xbox 360 controller, or write custom plugin events.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-connection-gpx",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" /> GPX Simulation
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Start GPX movement logs, choose custom start locations via the map, and record or export route paths.
        </p>
      </div>
    ),
  },
  // BACK TO MENU / LIBRARY STAGE
  {
    selectorId: "tour-saved-layouts",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" /> Saved Layouts Card
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Finally, let's explore how saved files are displayed in the Saved Layouts Library.
        </p>
      </div>
    ),
  },
  {
    selectorId: "tour-library-content",
    position: "top",
    content: (
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Folder className="w-4 h-4 text-muted-foreground shrink-0" /> Saved layouts Grid
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          All layout files are listed here. You can click them to open, import .bsl layouts, or delete unwanted configs.
        </p>
      </div>
    ),
  },
];
