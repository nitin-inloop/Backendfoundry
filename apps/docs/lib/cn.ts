/** Tiny className joiner used by the component-page and playground modules. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
