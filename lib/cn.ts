/** Joins conditional class names, skipping falsy values. No dependency needed for this project's scale. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
