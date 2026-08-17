function KimiModelIcon() {
  // TODO(SRC-002): move these visibility variants to the provider-scoped theme selector when it lands.
  return (
    <span
      aria-hidden="true"
      data-model-icon="kimi"
      className="inline-grid size-4 shrink-0 place-items-center"
    >
      <img
        src="/model-icons/kimi-color.svg"
        alt=""
        draggable={false}
        data-kimi-theme="light"
        className="col-start-1 row-start-1 size-4 dark:hidden"
      />
      <img
        src="/model-icons/kimi-color-dark.svg"
        alt=""
        draggable={false}
        data-kimi-theme="dark"
        className="col-start-1 row-start-1 hidden size-4 dark:block"
      />
    </span>
  )
}

export { KimiModelIcon }
