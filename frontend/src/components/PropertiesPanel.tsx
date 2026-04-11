"use client"

import { useCallback, useState } from "react"
import {
  ChevronRight,
  Trash2,
  Plus,
  Circle,
  Square,
  Gamepad2,
  Palette,
  Shield,
  Layers,
  Settings2,
} from "lucide-react"
import type { GamepadLayout, GamepadComponent, EditorAction } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface PropertiesPanelProps {
  state: GamepadLayout
  selectedId: string | null
  onSelect: (id: string | null) => void
  dispatch: React.Dispatch<EditorAction>
}

function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

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
            open && "rotate-90"
          )}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ColorInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
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
  )
}

export function PropertiesPanel({
  state,
  selectedId,
  onSelect,
  dispatch,
}: PropertiesPanelProps) {
  const selectedComponent = selectedId
    ? state.layout.components.find((c) => c.id === selectedId)
    : null

  const handleAddComponent = useCallback(() => {
    const newId = `btn_${Date.now()}`
    const newComponent: GamepadComponent = {
      type: "button",
      id: newId,
      position: { x: 0.5, y: 0.5 },
      size: { width: 0.15, height: 0.15 },
      shape: "circle",
      label: "New",
      command: "new_command",
    }
    dispatch({ type: "ADD_COMPONENT", payload: newComponent })
    onSelect(newId)
  }, [dispatch, onSelect])

  const handleDeleteComponent = useCallback(
    (id: string) => {
      dispatch({ type: "DELETE_COMPONENT", payload: id })
      if (selectedId === id) onSelect(null)
    },
    [dispatch, selectedId, onSelect]
  )

  return (
    <div className="flex flex-col h-full border-l border-border bg-card">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Properties</span>
        <Badge variant="outline" className="text-xs">
          {"v" + state.version}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="pb-6">
          {/* Gamepad Info */}
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

          {/* Theme */}
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
              <FieldRow label={`Pressed Alpha (${state.theme.button.pressedAlpha.toFixed(2)})`}>
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

          {/* Safe Area */}
          <Section icon={Shield} title="Safe Area">
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

          {/* Components List */}
          <Section icon={Layers} title="Components">
            <div className="flex flex-col gap-1 px-4 pb-3">
              {state.layout.components.map((comp) => (
                <div
                  key={comp.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                    selectedId === comp.id
                      ? "bg-primary/15 border border-primary/30"
                      : "hover:bg-secondary/50 border border-transparent"
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
                      e.stopPropagation()
                      handleDeleteComponent(comp.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Delete {comp.label}</span>
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

          {/* Selected Component Properties */}
          {selectedComponent && (
            <Section
              icon={Settings2}
              title={`Edit: ${selectedComponent.label}`}
            >
              <div className="flex flex-col gap-3 px-4 pb-4">
                <FieldRow label="ID">
                  <Input
                    value={selectedComponent.id}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_COMPONENT",
                        payload: {
                          id: selectedComponent.id,
                          updates: { id: e.target.value },
                        },
                      })
                    }
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
                          updates: {
                            shape: v as "circle" | "rectangle",
                          },
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

                <Separator className="my-1" />

                <Label className="text-xs text-foreground font-medium">
                  Position
                </Label>
                <FieldRow label="X">
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selectedComponent.position.x]}
                      min={0}
                      max={1}
                      step={0.001}
                      className="flex-1"
                      onValueChange={([v]) =>
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              position: {
                                ...selectedComponent.position,
                                x: v,
                              },
                            },
                          },
                        })
                      }
                    />
                    <Input
                      type="number"
                      value={selectedComponent.position.x.toFixed(3)}
                      min={0}
                      max={1}
                      step={0.001}
                      className="h-7 w-20 text-xs font-mono"
                      onChange={(e) => {
                        const v = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0))
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              position: {
                                ...selectedComponent.position,
                                x: v,
                              },
                            },
                          },
                        })
                      }}
                    />
                  </div>
                </FieldRow>
                <FieldRow label="Y">
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selectedComponent.position.y]}
                      min={0}
                      max={1}
                      step={0.001}
                      className="flex-1"
                      onValueChange={([v]) =>
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              position: {
                                ...selectedComponent.position,
                                y: v,
                              },
                            },
                          },
                        })
                      }
                    />
                    <Input
                      type="number"
                      value={selectedComponent.position.y.toFixed(3)}
                      min={0}
                      max={1}
                      step={0.001}
                      className="h-7 w-20 text-xs font-mono"
                      onChange={(e) => {
                        const v = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0))
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              position: {
                                ...selectedComponent.position,
                                y: v,
                              },
                            },
                          },
                        })
                      }}
                    />
                  </div>
                </FieldRow>

                <Separator className="my-1" />

                <Label className="text-xs text-foreground font-medium">
                  Size
                </Label>
                <FieldRow label="Width">
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selectedComponent.size.width]}
                      min={0.02}
                      max={1}
                      step={0.001}
                      className="flex-1"
                      onValueChange={([v]) =>
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              size: {
                                ...selectedComponent.size,
                                width: v,
                              },
                            },
                          },
                        })
                      }
                    />
                    <Input
                      type="number"
                      value={selectedComponent.size.width.toFixed(3)}
                      min={0.02}
                      max={1}
                      step={0.001}
                      className="h-7 w-20 text-xs font-mono"
                      onChange={(e) => {
                        const v = Math.min(1, Math.max(0.02, parseFloat(e.target.value) || 0.02))
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              size: {
                                ...selectedComponent.size,
                                width: v,
                              },
                            },
                          },
                        })
                      }}
                    />
                  </div>
                </FieldRow>
                <FieldRow label="Height">
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selectedComponent.size.height]}
                      min={0.02}
                      max={1}
                      step={0.001}
                      className="flex-1"
                      onValueChange={([v]) =>
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              size: {
                                ...selectedComponent.size,
                                height: v,
                              },
                            },
                          },
                        })
                      }
                    />
                    <Input
                      type="number"
                      value={selectedComponent.size.height.toFixed(3)}
                      min={0.02}
                      max={1}
                      step={0.001}
                      className="h-7 w-20 text-xs font-mono"
                      onChange={(e) => {
                        const v = Math.min(1, Math.max(0.02, parseFloat(e.target.value) || 0.02))
                        dispatch({
                          type: "UPDATE_COMPONENT",
                          payload: {
                            id: selectedComponent.id,
                            updates: {
                              size: {
                                ...selectedComponent.size,
                                height: v,
                              },
                            },
                          },
                        })
                      }}
                    />
                  </div>
                </FieldRow>
              </div>
            </Section>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
