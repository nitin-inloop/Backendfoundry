/**
 * cn(...classes) — joins truthy class names. Tiny, dependency-free.
 * Usage: cn("px-4", active && "text-ink", className)
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
