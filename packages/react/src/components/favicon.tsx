"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * What each site's icon came to, for this page's life: a link repeated down
 * a list, or redrawn while a reply streams, asks its site once. A site with
 * no icon is asked again only after `retryFailedMs`, so a brief network
 * error does not hide its icon until the page reloads.
 */
const iconStatus = new Map<string, { status: "loaded" | "failed"; at: number }>()
const retryFailedMs = 5 * 60_000

function cachedStatus(source: string): "loading" | "loaded" | "failed" {
  const known = iconStatus.get(source)
  if (!known) return "loading"
  if (known.status === "failed" && Date.now() - known.at > retryFailedMs) {
    iconStatus.delete(source)
    return "loading"
  }
  return known.status
}

/** Names that only ever reach the person's own machine or network. */
const localSuffixes = [".localhost", ".local", ".home.arpa", ".internal", ".lan"]

/**
 * Where a web page's site keeps its icon: `/favicon.ico` at the site's own
 * origin, always over HTTPS. Only an absolute `http:` or `https:` URL on a
 * public, named host has one to ask for — not a relative link, a `mailto:`
 * or `file:` link, `localhost`, an IP address, or a name that resolves on
 * the person's own network, which the request would otherwise reach.
 */
function faviconSource(href: string): string | undefined {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return undefined
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined
  const host = url.hostname.replace(/\.$/, "").toLowerCase()
  if (!host.includes(".") || host.startsWith("[") || /^[\d.]+$/.test(host)) return undefined
  if (host === "localhost" || localSuffixes.some((suffix) => host.endsWith(suffix)))
    return undefined
  return `https://${host}/favicon.ico`
}

export interface FaviconProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The web page the icon stands for, as an absolute URL (`https://example.com/a`). */
  href: string
  /**
   * Drawn until the site's icon has loaded, and kept when it cannot load —
   * no icon at the site, the site unreachable, or `href` not a public web
   * page. With none, nothing is drawn and no room is kept until the icon
   * has loaded, so text beside it moves only when there is an icon to show.
   */
  fallback?: React.ReactNode
}

/**
 * A site's own icon, beside a link to it. The icon is asked for from the
 * site itself, without a referrer — lazily where a fallback holds its place
 * — and shows only once it has loaded; until then, and wherever it cannot
 * load, the `fallback` stands in. Decorative: the link's text carries the
 * meaning, so the icon is hidden from assistive technology. Size it with
 * `className`; it defaults to `1em` square, so it follows the text it sits in.
 */
function Favicon({ href, fallback = null, className, ...props }: FaviconProps) {
  const source = faviconSource(href)
  const [settled, setSettled] = React.useState<{
    source: string
    status: "loaded" | "failed"
  }>()
  // Read in render, so a new `href` never shows the last one's outcome.
  const status = !source
    ? "failed"
    : settled?.source === source
      ? settled.status
      : cachedStatus(source)
  const settle = React.useCallback(
    (image: HTMLImageElement, next: "loaded" | "failed") => {
      if (!source) return
      // A site answering with a 1×1 pixel or an empty image has no icon to show.
      const outcome = next === "loaded" && image.naturalWidth <= 1 ? "failed" : next
      iconStatus.set(source, { status: outcome, at: Date.now() })
      setSettled({ source, status: outcome })
    },
    [source],
  )
  // An image that finished before its handlers were attached (a server-rendered
  // page hydrating, a cached icon) has no load event left to send.
  const image = React.useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) settle(node, "loaded")
    },
    [settle],
  )
  if (status === "failed" && fallback === null) return null
  const reserves = fallback !== null || status === "loaded"
  return (
    <span
      data-slot="favicon"
      data-state={status}
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-[1em] shrink-0 items-center justify-center",
        className,
        !reserves && "w-0 overflow-hidden",
      )}
      {...props}
    >
      {status === "loaded" ? null : fallback}
      {source && status !== "failed" ? (
        <img
          key={source}
          ref={image}
          src={source}
          alt=""
          loading={fallback === null ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={(event) => settle(event.currentTarget, "loaded")}
          onError={(event) => settle(event.currentTarget, "failed")}
          className={cn(
            // Icons are drawn for a light tab; a hairline of the text colour keeps a
            // dark one (a black logo on nothing) visible on a dark surface, and a
            // light one on a light surface.
            "size-full object-contain transition-opacity duration-150 ease-out motion-reduce:transition-none [filter:drop-shadow(0_0_0.75px_color-mix(in_oklab,var(--foreground)_60%,transparent))]",
            status === "loaded" ? "opacity-100" : "absolute inset-0 size-[1em] opacity-0",
          )}
        />
      ) : null}
    </span>
  )
}

export { Favicon }
