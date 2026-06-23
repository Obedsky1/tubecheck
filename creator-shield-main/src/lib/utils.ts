import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getVideoMaxRisk(video: any): number {
  if (!video?.audits || video.audits.length === 0) return 0;
  return Math.max(...video.audits.map((a: any) => a.risk_score));
}
