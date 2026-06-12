import type { SyntheticEvent } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shown in place of a listing's cover image if it fails to load (e.g. a
// stale/corrupted row predating server-side image validation).
export const IMAGE_FALLBACK_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Crect width='4' height='3' fill='%230a0a0c'/%3E%3Cpath d='M1.4 1.05a.35.35 0 1 1 0 .7.35.35 0 0 1 0-.7zM.6 2.4l.8-.8.5.5.9-1 .8 1.3z' fill='%23facc15'/%3E%3C/svg%3E";

export function handleImageError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = IMAGE_FALLBACK_SRC;
}
