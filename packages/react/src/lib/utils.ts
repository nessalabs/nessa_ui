import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The Nessa typography helpers set a font size, so they conflict with Tailwind's
 * own size utilities. Registering them in the same class group lets a caller
 * override a component's level by passing `text-lg` (or another level) through
 * `className`, exactly as it worked before components used the levels.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "nessa-text-1",
        "nessa-text-2",
        "nessa-text-3",
        "nessa-text-4",
        "nessa-text-5",
        "nessa-text-6",
        "nessa-text-7",
        "nessa-text-input",
        "nessa-text-input-2",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Whether an optional slot was given anything to show. `null`, `false`,
 * `undefined` and `""` all mean no — the forms `cond && node` and
 * `value ?? null` produce — so a component never draws an empty frame, or
 * points an ARIA reference at an empty element, for a slot left empty.
 */
export function hasContent(node: unknown): boolean {
  return node !== undefined && node !== null && node !== false && node !== ""
}
