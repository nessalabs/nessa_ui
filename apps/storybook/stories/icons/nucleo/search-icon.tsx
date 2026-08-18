import * as React from "react"

// Nucleo icon. See /THIRD_PARTY_NOTICES.md.
function SearchIcon({ ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="currentColor"
      stroke="currentColor"
      data-nucleo-icon="search"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        opacity=".4"
        d="M1.5 7.75C1.5 4.29829 4.29829 1.5 7.75 1.5C11.2017 1.5 14 4.29829 14 7.75C14 11.2017 11.2017 14 7.75 14C4.29829 14 1.5 11.2017 1.5 7.75Z"
        strokeWidth="0"
        data-color="color-2"
      />
      <path
        d="M11.6073 12.668L15.2196 16.2803C15.5125 16.5732 15.9874 16.5732 16.2803 16.2803C16.5732 15.9874 16.5732 15.5126 16.2803 15.2197L12.668 11.6073C12.3581 12.0018 12.0018 12.3581 11.6073 12.668Z"
        strokeWidth="0"
      />
    </svg>
  )
}

export { SearchIcon }
