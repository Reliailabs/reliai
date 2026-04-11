import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateMiddle(value: string, head = 4, tail = 4) {
  if (value.length <= head + tail) return value
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}
