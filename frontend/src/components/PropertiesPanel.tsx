"use client";

import { useCallback, useState } from "react";
import {
  ChevronRight,
  Trash2,
  Plus,
  Circle,
  Square,
  Gamepad2,
  Palette,
  Handshake,
  Layers,
  Settings2,
  GripVertical,
  Gamepad,
  ShieldCheck,
} from "lucide-react";
import type {
  GamepadLayout,
  GamepadComponent,
  EditorAction,
  ControllerMapping,
  AxisConfig,
  SensorConfig,
} from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { InfoTooltip } from "./InfoTooltip";

const XBOX_BUTTONS = [
  "A",
  "B",
  "X",
  "Y",
  "LeftShoulder",
  "RightShoulder",
  "LeftTrigger",
  "RightTrigger",
  "LeftStick",
  "RightStick",
  "Start",
  "Back",
  "Up",
  "Down",
  "Left",
  "Right",
];
const XBOX_AXES = ["LeftStickX", "LeftStickY", "RightStickX", "RightStickY"];

interface SortableCommandProps {
  id: string; // This is the command
  onRemove: (id: string) => void;
  buttonLabel: string; // The label to display
}

export function SortableCommand({
  id,
  onRemove,
  buttonLabel,
}: SortableCommandProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center justify-between p-2 bg-secondary/50 rounded-md"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-grab"
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Badge variant="outline">{buttonLabel}</Badge>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface PropertiesPanelProps {
  state: GamepadLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dispatch: React.Dispatch<EditorAction>;
}

function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function FieldRow({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      {children}
    </div>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div
          className="w-8 h-8 rounded-md border border-border cursor-pointer"
          style={{ backgroundColor: value }}
        />
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}

export function PropertiesPanel({
  state,
  selectedId,
  onSelect,
  dispatch,
}: PropertiesPanelProps) {
  const selectedComponent = selectedId
    ? state.layout.components.find((c) => c.id === selectedId)
    : null;

  const commandToLabelMap = new Map<string, string>();
  state.layout.components.forEach((c) => {
    commandToLabelMap.set(c.command, c.label);
  });

  const availableCommandOptions = state.layout.components.reduce(
    (acc, comp) => {
      if (!acc.some((option) => option.command === comp.command)) {
        acc.push({ command: comp.command, label: comp.label });
      }
      return acc;
    },
    [] as { command: string; label: string }[],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const activeRuleIndex = state.conflictsResolution?.findIndex((rule) =>
        rule.priority.includes(active.id as string),
      );
      if (activeRuleIndex === undefined || activeRuleIndex === -1) return;

      const oldIndex = state.conflictsResolution![
        activeRuleIndex
      ].priority.indexOf(active.id as string);
      const newIndex = state.conflictsResolution![
        activeRuleIndex
      ].priority.indexOf(over!.id as string);

      const newPriority = arrayMove(
        state.conflictsResolution![activeRuleIndex].priority,
        oldIndex,
        newIndex,
      );

      dispatch({
        type: "UPDATE_CONFLICT_RESOLUTION",
        payload: {
          index: activeRuleIndex,
          updates: { priority: newPriority },
        },
      });
    }
  };

  const handleAddCommandToRule = (ruleIndex: number, command: string) => {
    const rule = state.conflictsResolution?.[ruleIndex];
    if (rule && !rule.commands.includes(command)) {
      const updates = {
        commands: [...rule.commands, command],
        priority: [...rule.priority, command],
      };
      dispatch({
        type: "UPDATE_CONFLICT_RESOLUTION",
        payload: { index: ruleIndex, updates },
      });
    }
  };

  const handleRemoveCommandFromRule = (ruleIndex: number, command: string) => {
    const rule = state.conflictsResolution?.[ruleIndex];
    if (rule) {
      const updates = {
        commands: rule.commands.filter((c) => c !== command),
        priority: rule.priority.filter((p) => p !== command),
      };
      dispatch({
        type: "UPDATE_CONFLICT_RESOLUTION",
        payload: { index: ruleIndex, updates },
      });
    }
  };

  const handleAddComponent = useCallback(() => {
    const newId = `btn_${Date.now()}`;
    const newComponent: GamepadComponent = {
      type: "button",
      id: newId,
      position: { x: 0.5, y: 0.5 },
      size: { width: 0.15, height: 0.15 },
      shape: "circle",
      label: "New",
      command: "new_command",
    };
    dispatch({ type: "ADD_COMPONENT", payload: newComponent });
    onSelect(newId);
  }, [dispatch, onSelect]);

  const handleDeleteComponent = useCallback(
    (id: string) => {
      dispatch({ type: "DELETE_COMPONENT", payload: id });
      if (selectedId === id) onSelect(null);
    },
    [dispatch, selectedId, onSelect],
  );

  const handleMappingUpdate = (mapping: Partial<ControllerMapping>) => {
    dispatch({ type: "UPDATE_CONTROLLER_MAPPING", payload: mapping });
  };

  const handleAxisMapUpdate = (
    command: string,
    config: Partial<AxisConfig>,
  ) => {
    const existingConfig = state.controllerMapping?.axisMap?.[command];
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config };
      const newAxisMap = {
        ...(state.controllerMapping?.axisMap || {}),
        [command]: updatedConfig,
      };
      handleMappingUpdate({ axisMap: newAxisMap });
    }
  };

  const handleSensorMapUpdate = (
    command: string,
    config: Partial<SensorConfig>,
  ) => {
    const existingConfig = state.controllerMapping?.sensorMap?.[command];
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config };
      if ("thresholds" in config) {
        const existingThresholds =
          state.controllerMapping?.sensorMap?.[command]?.thresholds;
        updatedConfig.thresholds = {
          ...(existingThresholds || { start: 0, stop: 0 }),
          ...config.thresholds,
        };
      }
      const newSensorMap = {
        ...(state.controllerMapping?.sensorMap || {}),
        [command]: updatedConfig,
      };
      handleMappingUpdate({ sensorMap: newSensorMap });
    }
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">
          Properties
        </span>
        <Badge variant="outline" className="text-xs">
          {"v" + state.version}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="pb-6">
          <Section icon={Gamepad2} title="Gamepad Info">
            <div className="flex flex-col gap-3 px-4 pb-4">
              <FieldRow label="Name">
                <Input
                  value={state.gamepad.name}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_GAMEPAD_INFO",
                      payload: { name: e.target.value },
                    })
                  }
                  className="h-8 text-xs"
                />
              </FieldRow>
              <FieldRow label="Description">
                <Input
                  value={state.gamepad.description}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_GAMEPAD_INFO",
                      payload: { description: e.target.value },
                    })
                  }
                  className="h-8 text-xs"
                />
              </FieldRow>
              <FieldRow label="ID">
                <Input
                  value={state.gamepad.id}
                  readOnly
                  className="h-8 text-xs opacity-60"
                />
              </FieldRow>
              <FieldRow label="Orientation">
                <Select
                  value={state.gamepad.orientation}
                  onValueChange={(v) =>
                    dispatch({
                      type: "SET_ORIENTATION",
                      payload: v as "portrait" | "landscape",
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>
          </Section>
          <Separator />
          <Section icon={Palette} title="Theme">
            <div className="flex flex-col gap-3 px-4 pb-4">
              <FieldRow label="Background Color">
                <ColorInput
                  value={state.theme.backgroundColor}
                  onChange={(v) =>
                    dispatch({ type: "SET_THEME_BG_COLOR", payload: v })
                  }
                />
              </FieldRow>

              <Separator className="my-1" />

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Background Image
                </Label>
                <Switch
                  checked={state.theme.backgroundImage.enabled}
                  onCheckedChange={(v) =>
                    dispatch({
                      type: "SET_BACKGROUND_IMAGE",
                      payload: { enabled: v },
                    })
                  }
                />
              </div>

              {state.theme.backgroundImage.enabled && (
                <>
                  <FieldRow label="Image URL">
                    <Input
                      value={state.theme.backgroundImage.value}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_BACKGROUND_IMAGE",
                          payload: { value: e.target.value },
                        })
                      }
                      className="h-8 text-xs"
                      placeholder="https://..."
                    />
                  </FieldRow>
                  <FieldRow label="Scale Type">
                    <Select
                      value={state.theme.backgroundImage.scaleType}
                      onValueChange={(v) =>
                        dispatch({
                          type: "SET_BACKGROUND_IMAGE",
                          payload: {
                            scaleType: v as "fill" | "fit" | "crop",
                          },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fill">Fill</SelectItem>
                        <SelectItem value="fit">Fit</SelectItem>
                        <SelectItem value="crop">Crop</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </>
              )}

              <Separator className="my-1" />

              <Label className="text-xs text-foreground font-medium">
                Button Defaults
              </Label>
              <FieldRow label="Button Color">
                <ColorInput
                  value={state.theme.button.color}
                  onChange={(v) =>
                    dispatch({
                      type: "SET_BUTTON_THEME",
                      payload: { color: v },
                    })
                  }
                />
              </FieldRow>
              <FieldRow label="Text Color">
                <ColorInput
                  value={state.theme.button.textColor}
                  onChange={(v) =>
                    dispatch({
                      type: "SET_BUTTON_THEME",
                      payload: { textColor: v },
                    })
                  }
                />
              </FieldRow>
              <FieldRow
                label={`Pressed Alpha (${state.theme.button.pressedAlpha.toFixed(2)})`}
              >
                <Slider
                  value={[state.theme.button.pressedAlpha]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) =>
                    dispatch({
                      type: "SET_BUTTON_THEME",
                      payload: { pressedAlpha: v },
                    })
                  }
                />
              </FieldRow>
              <FieldRow label="Text Size (sp)">
                <Input
                  type="number"
                  value={state.theme.button.textSizeSp}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_BUTTON_THEME",
                      payload: {
                        textSizeSp: Number(e.target.value) || 14,
                      },
                    })
                  }
                  className="h-8 text-xs"
                  min={8}
                  max={72}
                />
              </FieldRow>
            </div>
          </Section>
          <Separator />
          <Section icon={ShieldCheck} title="Safe Area">
            <div className="flex flex-col gap-3 px-4 pb-4">
              {(["top", "bottom", "left", "right"] as const).map((side) => (
                <FieldRow
                  key={side}
                  label={`${side.charAt(0).toUpperCase() + side.slice(1)} (${state.layout.safeArea[side].toFixed(2)})`}
                >
                  <Slider
                    value={[state.layout.safeArea[side]]}
                    min={0}
                    max={0.5}
                    step={0.01}
                    onValueChange={([v]) =>
                      dispatch({
                        type: "SET_SAFE_AREA",
                        payload: { [side]: v },
                      })
                    }
                  />
                </FieldRow>
              ))}
            </div>
          </Section>
          <Separator />
          <Section icon={Layers} title="Components">
            <div className="flex flex-col gap-1 px-4 pb-3">
              {state.layout.components.map((comp) => (
                <div
                  key={comp.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                    selectedId === comp.id
                      ? "bg-primary/15 border border-primary/30"
                      : "hover:bg-secondary/50 border border-transparent",
                  )}
                  onClick={() => onSelect(comp.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {comp.shape === "circle" ? (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium text-foreground truncate">
                      {comp.label}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {comp.id}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteComponent(comp.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={handleAddComponent}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Button
              </Button>
            </div>
          </Section>
          <Separator />
          <Section icon={Handshake} title="Conflict Resolution">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col gap-3 px-4 pb-4">
                {(state.conflictsResolution || []).map((conflict, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 p-2 border rounded-md"
                  >
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-medium">
                        Rule: {conflict.name}
                      </Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          dispatch({
                            type: "DELETE_CONFLICT_RESOLUTION",
                            payload: index,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <FieldRow label="Name">
                      <Input
                        value={conflict.name}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_CONFLICT_RESOLUTION",
                            payload: {
                              index,
                              updates: { name: e.target.value },
                            },
                          })
                        }
                        className="h-8 text-xs"
                      />
                    </FieldRow>
                    <FieldRow label="Mode">
                      <Select
                        value={conflict.mode}
                        onValueChange={(value) =>
                          dispatch({
                            type: "UPDATE_CONFLICT_RESOLUTION",
                            payload: {
                              index,
                              updates: { mode: value as "priority" },
                            },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="priority">Priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label="Add Command">
                      <Select
                        onValueChange={(command) =>
                          handleAddCommandToRule(index, command)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Add a command..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCommandOptions
                            .filter(
                              (option) =>
                                !conflict.commands.includes(option.command),
                            )
                            .map((option) => (
                              <SelectItem
                                key={option.command}
                                value={option.command}
                              >
                                {option.label} ({option.command})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label="Priority (drag to reorder)">
                      <SortableContext
                        items={conflict.priority}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="flex flex-col gap-2">
                          {conflict.priority.map((cmd) => (
                            <SortableCommand
                              key={cmd}
                              id={cmd}
                              onRemove={() =>
                                handleRemoveCommandFromRule(index, cmd)
                              }
                              buttonLabel={commandToLabelMap.get(cmd) || cmd}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </FieldRow>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full text-xs"
                  onClick={() =>
                    dispatch({
                      type: "ADD_CONFLICT_RESOLUTION",
                      payload: {
                        name: "New Rule",
                        mode: "priority",
                        commands: [],
                        priority: [],
                      },
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Rule
                </Button>
              </div>
            </DndContext>
          </Section>
          <Separator />
          <Section icon={Gamepad} title="Controller Mapping">
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Enable Mapping
                </Label>
                <Switch
                  checked={!!state.controllerMapping?.enabled}
                  onCheckedChange={(v) => {
                    if (v && !state.controllerMapping) {
                      handleMappingUpdate({
                        enabled: true,
                        buttonMap: {},
                        axisMap: {},
                        sensorMap: {},
                      });
                    } else {
                      handleMappingUpdate({ enabled: v });
                    }
                  }}
                />
              </div>
              {state.controllerMapping?.enabled && (
                <>
                  <Separator className="my-1" />
                  <Label className="text-xs text-foreground font-medium">
                    Button Map
                  </Label>
                  {state.layout.components.map((c) => (
                    <FieldRow key={c.id} label={c.label}>
                      <Select
                        value={
                          state.controllerMapping?.buttonMap?.[c.command] ||
                          "NONE"
                        }
                        onValueChange={(v) => {
                          const newButtonMap = {
                            ...(state.controllerMapping?.buttonMap || {}),
                          };
                          if (v === "NONE") {
                            delete newButtonMap[c.command];
                          } else {
                            newButtonMap[c.command] = v;
                          }
                          handleMappingUpdate({ buttonMap: newButtonMap });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Not Mapped" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Not Mapped</SelectItem>
                          {XBOX_BUTTONS.map((btn) => (
                            <SelectItem key={btn} value={btn}>
                              {btn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>
                  ))}

                  <Separator className="my-1" />
                  <Label className="text-xs text-foreground font-medium">
                    Axis: Tilt-to-Steer
                  </Label>
                  <div className="p-2 border rounded-md">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">
                        Enable Tilt Steering
                      </Label>
                      <Switch
                        checked={!!state.controllerMapping?.axisMap?.steer}
                        onCheckedChange={(v) => {
                          const newAxisMap = {
                            ...(state.controllerMapping?.axisMap || {}),
                          };
                          if (v) {
                            newAxisMap.steer = {
                              target: "LeftStickX",
                              mode: "tilt",
                              source: "x",
                              deadzone: 0.1,
                              scale: 1,
                              smoothing: 0,
                              invert: false,
                            };
                          } else {
                            delete newAxisMap.steer;
                          }
                          handleMappingUpdate({ axisMap: newAxisMap });
                        }}
                      />
                    </div>
                    {state.controllerMapping?.axisMap?.steer && (
                      <div className="mt-2 flex flex-col gap-3">
                        <FieldRow label="Mode">
                          <Select
                            value={state.controllerMapping.axisMap.steer.mode}
                            onValueChange={(v) =>
                              handleAxisMapUpdate("steer", {
                                mode: v as "tilt",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tilt">Tilt</SelectItem>
                            </SelectContent>
                          </Select>
                        </FieldRow>
                        <FieldRow label="Target">
                          <Select
                            value={state.controllerMapping.axisMap.steer.target}
                            onValueChange={(v) =>
                              handleAxisMapUpdate("steer", { target: v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {XBOX_AXES.map((ax) => (
                                <SelectItem key={ax} value={ax}>
                                  {ax}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldRow>
                        <FieldRow label="Source">
                          <Select
                            value={state.controllerMapping.axisMap.steer.source}
                            onValueChange={(v) =>
                              handleAxisMapUpdate("steer", {
                                source: v as "x" | "y" | "z",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="x">x</SelectItem>
                              <SelectItem value="y">y</SelectItem>
                              <SelectItem value="z">z</SelectItem>
                            </SelectContent>
                          </Select>
                        </FieldRow>
                        <FieldRow
                          label="Deadzone"
                          tooltip="Tilt angle below this is ignored, preventing drift when the phone is resting still"
                        >
                          <Input
                            type="number"
                            value={
                              state.controllerMapping.axisMap.steer.deadzone
                            }
                            onChange={(e) =>
                              handleAxisMapUpdate("steer", {
                                deadzone: +e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </FieldRow>
                        <FieldRow
                          label="Scale"
                          tooltip="Value to tilt to reach full deflection. Lower the value higher the sensitivity of tilting"
                        >
                          <Input
                            type="number"
                            value={state.controllerMapping.axisMap.steer.scale}
                            onChange={(e) =>
                              handleAxisMapUpdate("steer", {
                                scale: +e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </FieldRow>
                        <FieldRow
                          label="Smoothing"
                          tooltip="Blends between frames to reduce jitter, higher value will become smoother but slightly more lag"
                        >
                          <Input
                            type="number"
                            value={
                              state.controllerMapping.axisMap.steer.smoothing
                            }
                            onChange={(e) =>
                              handleAxisMapUpdate("steer", {
                                smoothing: +e.target.value,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </FieldRow>
                        <FieldRow label="Invert">
                          <Switch
                            checked={
                              state.controllerMapping.axisMap.steer.invert
                            }
                            onCheckedChange={(v) =>
                              handleAxisMapUpdate("steer", { invert: v })
                            }
                          />
                        </FieldRow>
                      </div>
                    )}
                  </div>

                  <Separator className="my-1" />
                  <Label className="text-xs text-foreground font-medium">
                    Steps Mapping
                  </Label>
                  <div className="p-2 border rounded-md">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Enable</Label>
                      <Switch
                        checked={
                          !!state.controllerMapping?.sensorMap?.stepsCadence
                        }
                        onCheckedChange={(v) => {
                          const newSensorMap = {
                            ...(state.controllerMapping?.sensorMap || {}),
                          };
                          if (v) {
                            newSensorMap.stepsCadence = {
                              target: "RightTrigger",
                              mode: "toggle",
                              thresholds: { start: 40, stop: 20 },
                            };
                          } else {
                            delete newSensorMap.stepsCadence;
                          }
                          handleMappingUpdate({ sensorMap: newSensorMap });
                        }}
                      />
                    </div>
                    {state.controllerMapping?.sensorMap?.stepsCadence && (
                      <div className="mt-2 flex flex-col gap-3">
                        <FieldRow label="Mode">
                          <Select
                            value={
                              state.controllerMapping.sensorMap.stepsCadence
                                .mode
                            }
                            onValueChange={(v) =>
                              handleSensorMapUpdate("stepsCadence", {
                                mode: v as "toggle",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="toggle">Toggle</SelectItem>
                            </SelectContent>
                          </Select>
                        </FieldRow>
                        <FieldRow label="Target">
                          <Select
                            value={
                              state.controllerMapping.sensorMap.stepsCadence
                                .target
                            }
                            onValueChange={(v) =>
                              handleSensorMapUpdate("stepsCadence", {
                                target: v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {XBOX_BUTTONS.map((ax) => (
                                <SelectItem key={ax} value={ax}>
                                  {ax}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldRow>
                        <FieldRow
                          label="Start Threshold"
                          tooltip="Steps cadence (steps per minute) to start trigger the button"
                        >
                          <Input
                            type="number"
                            value={
                              state.controllerMapping.sensorMap.stepsCadence
                                .thresholds.start
                            }
                            onChange={(e) =>
                              handleSensorMapUpdate("stepsCadence", {
                                thresholds: {
                                  ...state.controllerMapping?.sensorMap
                                    ?.stepsCadence?.thresholds,
                                  start: +e.target.value,
                                },
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </FieldRow>
                        <FieldRow
                          label="Stop Threshold"
                          tooltip="Steps cadence (steps per minute) to stop trigger the button"
                        >
                          <Input
                            type="number"
                            value={
                              state.controllerMapping.sensorMap.stepsCadence
                                .thresholds.stop
                            }
                            onChange={(e) =>
                              handleSensorMapUpdate("stepsCadence", {
                                thresholds: {
                                  ...state.controllerMapping?.sensorMap
                                    ?.stepsCadence?.thresholds,
                                  stop: +e.target.value,
                                },
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </FieldRow>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Section>
          <Separator />
          {selectedComponent && (
            <Section
              icon={Settings2}
              title={`Edit: ${selectedComponent.label}`}
            >
              <div className="flex flex-col gap-3 px-4 pb-4">
                <FieldRow label="ID">
                  <Input
                    value={selectedComponent.id}
                    readOnly
                    className="h-8 text-xs font-mono"
                  />
                </FieldRow>
                <FieldRow label="Label">
                  <Input
                    value={selectedComponent.label}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_COMPONENT",
                        payload: {
                          id: selectedComponent.id,
                          updates: { label: e.target.value },
                        },
                      })
                    }
                    className="h-8 text-xs"
                  />
                </FieldRow>
                <FieldRow label="Command">
                  <Input
                    value={selectedComponent.command}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_COMPONENT",
                        payload: {
                          id: selectedComponent.id,
                          updates: { command: e.target.value },
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </FieldRow>
                <FieldRow label="Shape">
                  <Select
                    value={selectedComponent.shape}
                    onValueChange={(v) =>
                      dispatch({
                        type: "UPDATE_COMPONENT",
                        payload: {
                          id: selectedComponent.id,
                          updates: { shape: v as "circle" | "rectangle" },
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            </Section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
