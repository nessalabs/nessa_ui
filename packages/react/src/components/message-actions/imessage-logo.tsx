"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Apple's iMessage mark: the white speech bubble on its green rounded square.
 * Geometry and colours are traced from the public-domain SVG on Wikimedia
 * Commons (File:IMessage_logo.svg, PD-textlogo — the shape is below the
 * threshold of originality).
 *
 * The two greens and the white bubble are deliberately literal rather than
 * token references: a brand mark must read as itself in every theme and
 * colour mode, so it is the one thing in the component that a theme must not
 * retint. Size it from the caller, like any other icon.
 *
 * It is a trademark. Use it for the channel it actually names — a card whose
 * message really is going over iMessage — not as generic chat decoration.
 */
export function IMessageLogo({
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "children" | "viewBox">) {
  // Scoped per instance: two marks on one page must not share a gradient id.
  const gradientId = React.useId()
  return (
    <svg
      viewBox="0 0 66.145836 66.145836"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("size-4", className)}
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="61.754"
          x2="0"
          y2="8.153"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0cbd2a" />
          <stop offset="1" stopColor="#5bf675" />
        </linearGradient>
      </defs>
      <rect
        width="66.145836"
        height="66.145836"
        rx="14.567832"
        ry="14.567832"
        fill={`url(#${gradientId})`}
      />
      {/* The bubble keeps the source's own coordinates, offset into the
          square, so its arcs stay exactly as drawn rather than re-fitted. */}
      <path
        transform="translate(59.483067,-145.8456)"
        d="m -26.410149,157.29606 a 24.278298,20.222157 0 0 0 -24.278105,20.22202 24.278298,20.222157 0 0 0 11.79463,17.31574 27.365264,20.222157 0 0 1 -4.245218,5.94228 23.85735,20.222157 0 0 0 9.86038,-3.87367 24.278298,20.222157 0 0 0 6.868313,0.83768 24.278298,20.222157 0 0 0 24.2781059,-20.22203 24.278298,20.222157 0 0 0 -24.2781059,-20.22202 z"
        fill="#ffffff"
      />
    </svg>
  )
}
