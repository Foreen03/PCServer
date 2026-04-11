import type { GamepadLayout } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useState, useRef, type MouseEvent } from "react";

interface DevicePreviewProps {
    layout: GamepadLayout;
    setLayout: React.Dispatch<React.SetStateAction<GamepadLayout>>;
    selectedComponentId: string | null;
    setSelectedComponentId: (id: string | null) => void;
}

const DEVICES = {
    "iPhone 15": { width: 393, height: 852 },
    "iPhone 15 Pro Max": { width: 430, height: 932 },
    "Pixel 8 Pro": { width: 412, height: 915 },
    "Galaxy S24": { width: 360, height: 780 },
    "iPad Pro 11": { width: 834, height: 1194 },
};
type DeviceKey = keyof typeof DEVICES;

export function DevicePreview({ layout, setLayout, selectedComponentId, setSelectedComponentId }: DevicePreviewProps) {
    const [selectedDevice, setSelectedDevice] = useState<DeviceKey>("iPhone 15 Pro Max");
    const [draggingComponentId, setDraggingComponentId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const isLandscape = layout.gamepad.orientation === 'landscape';
    const device = DEVICES[selectedDevice];
    const aspectRatio = isLandscape ? `${device.height}/${device.width}` : `${device.width}/${device.height}`;

    const handleMouseDown = (e: MouseEvent, componentId: string) => {
        e.stopPropagation();
        setDraggingComponentId(componentId);
        setSelectedComponentId(componentId);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!draggingComponentId || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - containerRect.left) / containerRect.width;
        const y = (e.clientY - containerRect.top) / containerRect.height;

        setLayout(prevLayout => {
            const newComponents = prevLayout.layout.components.map(c => {
                if (c.id === draggingComponentId) {
                    return { ...c, position: { x, y } };
                }
                return c;
            });
            return { ...prevLayout, layout: { ...prevLayout.layout, components: newComponents } };
        });
    };

    const handleMouseUp = () => {
        setDraggingComponentId(null);
    };

    return (
        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-4 gap-4">
             <div className="w-1/2">
                <Select value={selectedDevice} onValueChange={(value: DeviceKey) => setSelectedDevice(value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a device" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.keys(DEVICES).map(key => (
                            <SelectItem key={key} value={key}>{key}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className={cn(
                "bg-black border-8 border-slate-800 rounded-3xl shadow-2xl w-full h-full",
            )} style={{aspectRatio}}>
                <div 
                    ref={containerRef}
                    className="w-full h-full relative"
                    style={{ backgroundColor: layout.theme.backgroundColor }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Safe Area */}
                    <div
                        className="absolute bg-blue-500/20"
                        style={{
                            top: `${layout.layout.safeArea.top * 100}%`,
                            bottom: `${layout.layout.safeArea.bottom * 100}%`,
                            left: `${layout.layout.safeArea.left * 100}%`,
                            right: `${layout.layout.safeArea.right * 100}%`,
                        }}
                    />

                    {layout.layout.components.map(component => (
                        <div
                            key={component.id}
                            onMouseDown={(e) => handleMouseDown(e, component.id)}
                            className={cn(
                                "absolute flex items-center justify-center text-white cursor-grab",
                                component.shape === 'circle' && 'rounded-full',
                                selectedComponentId === component.id && 'ring-2 ring-blue-500'
                            )}
                            style={{
                                left: `${component.position.x * 100}%`,
                                top: `${component.position.y * 100}%`,
                                width: `${component.size.width * 100}%`,
                                height: `${component.size.height * 100}%`,
                                backgroundColor: layout.theme.button.color,
                                color: layout.theme.button.textColor,
                                fontSize: `${layout.theme.button.textSizeSp}px`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {component.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
