import * as React from "react"

// Nucleo icon. See /THIRD_PARTY_NOTICES.md.
function FolderClosedIcon({
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
      data-nucleo-icon="folder-closed"
      className={className}
      {...props}
    >
      <path
        d="M2.25,8.75V4.75c0-1.105,.895-2,2-2h1.951c.607,0,1.18,.275,1.56,.748l.603,.752h5.386c1.105,0,2,.895,2,2v2.844"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
      />
      <path
        d="M4.25,6.75H13.75c1.105,0,2,.895,2,2v4.5c0,1.105-.895,2-2,2H4.25c-1.105,0-2-.895-2-2v-4.5c0-1.105,.895-2,2-2Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export { FolderClosedIcon }
