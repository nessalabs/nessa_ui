import * as React from "react"

// Nucleo icon. See /THIRD_PARTY_NOTICES.md.
function ChatComposeIcon({
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
      data-nucleo-icon="chat-compose"
      className={className}
      {...props}
    >
      <path
        d="M14.429 6.535C14.077 9.272 11.818 9.762 9.41901 9.441"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
      />
      <path
        d="M7.4072 2.75H4.75C3.645 2.75 2.75 3.645 2.75 4.75V13.25C2.75 14.355 3.645 15.25 4.75 15.25H13.25C14.355 15.25 15.25 14.355 15.25 13.25V11.0266"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.25 11.75C6.25 11.75 7.3 2.533 16.25 1.75C15.802 2.531 15.791 3.834 15.493 5.142C15.074 6.75 13.625 6.95 11.85 6.95"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
      />
    </svg>
  )
}

export { ChatComposeIcon }
