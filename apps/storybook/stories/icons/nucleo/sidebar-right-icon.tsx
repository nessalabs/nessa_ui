import * as React from "react"

// Nucleo icon. See /THIRD_PARTY_NOTICES.md.
function SidebarRightIcon({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      data-nucleo-icon="sidebar-right"
      className={className}
      {...props}
    >
      <rect
        x="1.75"
        y="2.75"
        width="14.5"
        height="12.5"
        rx="2"
        ry="2"
        transform="translate(18 18) rotate(180)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="13.25"
        y1="5.75"
        x2="13.25"
        y2="12.25"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
      />
    </svg>
  )
}

export { SidebarRightIcon }
