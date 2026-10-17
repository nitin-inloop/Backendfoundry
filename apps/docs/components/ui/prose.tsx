/**
 * <Prose> — long-form documentation typography (h2/h3, lists, tables, inline code, links).
 * 16px Inter, 1.7 leading, 720px measure. Styles live in app/globals.css (.bf-prose).
 * Props: className?, children.
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Prose({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("bf-prose", className)}>{children}</div>;
}
