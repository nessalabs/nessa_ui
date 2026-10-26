import * as React from "react";

import { cn } from "@/lib/utils";

/** The default paint: the Bloom palette, lifted so it reads on a dark field. */
const gradientTextColors = Object.freeze([
  "#ffc08a",
  "#ff8ab4",
  "#e3b2ff",
  "#c0a2ff",
  "#9db4ff",
] as const);

export interface GradientTextProps extends React.ComponentProps<"span"> {
  /** CSS colours spread across the text, left to right. */
  colors?: readonly string[];
}

/**
 * Text painted with one gradient that runs across all of it, standing still:
 * the wordmark look of TypeIn without the typing. It stays real text, read
 * and selected as written. Made for a word or two, such as a name in a
 * heading; it is not for running copy.
 */
function GradientText({
  colors = gradientTextColors,
  className,
  style,
  ...props
}: GradientTextProps) {
  return (
    <span
      data-slot="gradient-text"
      className={cn(
        "bg-clip-text text-transparent [-webkit-background-clip:text] [background-image:var(--nessa-gradient-text-paint)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
        className,
      )}
      style={
        {
          "--nessa-gradient-text-paint": `linear-gradient(90deg, ${colors.join(", ")})`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { GradientText, gradientTextColors };
