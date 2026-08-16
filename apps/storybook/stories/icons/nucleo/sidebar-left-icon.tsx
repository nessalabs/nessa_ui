import * as React from "react"

// Nucleo icon. See /THIRD_PARTY_NOTICES.md.
function SidebarLeftIcon({
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
      data-nucleo-icon="sidebar-left"
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
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="4.75"
        y1="5.75"
        x2="4.75"
        y2="12.25"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
      />
    </svg>
  )
}

export { SidebarLeftIcon }
