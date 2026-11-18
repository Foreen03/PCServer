import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUniqueCommand(
  base: string,
  existingComponents: { command?: string }[]
): string {
  const existing = new Set(
    existingComponents.map((c) => c.command).filter(Boolean)
  );
  const cleanBase = base ? base.replace(/_\d+$/, "") : "button";
  let counter = 1;
  let candidate = `${cleanBase || "button"}_${counter}`;
  while (existing.has(candidate)) {
    counter++;
    candidate = `${cleanBase || "button"}_${counter}`;
  }
  return candidate;
}
