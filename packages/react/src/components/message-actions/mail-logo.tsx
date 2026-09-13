"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Apple's Mail mark: the white envelope on its blue rounded square. Geometry
 * and colours are traced from the public-domain SVG on Wikimedia Commons
 * (File:Mail_(iOS).svg, PD-textlogo — the shape is below the threshold of
 * originality). The repository keeps the source file under
 * `assets/brand-marks/` as provenance.
 *
 * Like the iMessage mark, the colours are deliberately literal rather than
 * token references: a brand mark must read as itself in every theme and
 * colour mode. Size it from the caller.
 *
 * It is a trademark. Use it for the channel it actually names.
 */
export function MailLogo({
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "children" | "viewBox">) {
  // Scoped per instance: two marks on one page must not share a gradient id.
  const gradientId = React.useId()
  return (
    <svg
      viewBox="0 0 602 602"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("size-4", className)}
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(0.15,0,0,0.15,0.85002387,961.21217)"
          x1="305.20093"
          y1="598.59198"
          x2="305.785"
          y2="8.2437592"
        >
          <stop offset="0" stopColor="#70efff" />
          <stop offset="1" stopColor="#5770ff" />
        </linearGradient>
      </defs>
      {/* Both marks keep their source's own coordinates and transforms, so
          the arcs and the envelope's folds stay exactly as drawn rather than
          re-fitted to a round viewBox. */}
      <g transform="translate(0,-450.36218)">
        <g transform="matrix(6.6666666,0,0,6.6666666,-5.6668106,-5957.7191)">
          <path
            fill={`url(#${gradientId})`}
            d="m 21.652659,961.36222 48.694734,0 c 11.441552,0 20.652633,9.21108 20.652633,20.65264 l 0,48.69474 c 0,11.4416 -9.211081,20.6526 -20.652633,20.6526 l -48.694734,0 c -11.441563,0 -20.6526336,-9.211 -20.6526336,-20.6526 l 0,-48.69474 c 0,-11.44156 9.2110706,-20.65264 20.6526336,-20.65264 z"
          />
          <path
            fill="#ffffff"
            transform="translate(0,450.36218)"
            d="m 20.71875,536.59375 c -0.474202,0 -0.920938,0.0818 -1.34375,0.25 l 8.46875,8.71875 8.5625,8.875 0.15625,0.1875 0.25,0.25 0.25,0.25 0.5,0.53125 7.34375,7.53125 c 0.122269,0.076 0.476602,0.4042 0.753434,0.54258 0.356583,0.17824 0.743089,0.34255 1.141484,0.3568 0.42992,0.0154 0.869334,-0.10782 1.256181,-0.29601 0.289732,-0.14096 0.418572,-0.34294 0.755151,-0.60337 l 8.5,-8.78125 8.59375,-8.84375 8.28125,-8.53125 c -0.531643,-0.28806 -1.120466,-0.4375 -1.75,-0.4375 z m -2.59375,1.0625 c -0.903115,0.85572 -1.46875,2.14217 -1.46875,3.59375 l 0,28.625 c 0,1.17535 0.377499,2.24307 1,3.0625 l 1.1875,-1.125 8.84375,-8.59375 7.84375,-7.59375 -0.15625,-0.1875 -8.59375,-8.84375 -8.59375,-8.875 z m 57.1875,0.28125 -8.375,8.65625 -8.5625,8.84375 -0.15625,0.15625 8.15625,7.90625 8.84375,8.59375 0.53125,0.5 c 0.476164,-0.76402 0.75,-1.70518 0.75,-2.71875 l 0,-28.625 c 0,-1.29428 -0.448516,-2.46795 -1.1875,-3.3125 z m -38.78125,18.71875 -7.8125,7.59375 -8.875,8.59375 -1.125,1.09375 c 0.593096,0.38196 1.268042,0.625 2,0.625 l 51.71875,0 c 0.879957,0 1.678116,-0.33853 2.34375,-0.875 l -0.5625,-0.5625 -8.875,-8.59375 -8.15625,-7.875 -7.34375,7.5625 c -0.397465,0.2635 -0.663064,0.55576 -1.051168,0.73523 -0.624615,0.28885 -1.309163,0.53321 -1.997252,0.52267 -0.689922,-0.0106 -1.366428,-0.28061 -1.985577,-0.58517 -0.310792,-0.15288 -0.476438,-0.30481 -0.841003,-0.61023 z"
          />
        </g>
      </g>
    </svg>
  )
}
