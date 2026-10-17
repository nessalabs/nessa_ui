"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * What each site's icon came to, for this page's life: a link repeated down
 * a list, or redrawn while a reply streams, asks its site once, and a site
 * with no icon is not asked again.
 */
const iconStatus = new Map<string, "loaded" | "failed">()

/**
 * Where a page's site keeps its icon: `/favicon.ico` at the site's own
 * origin. Only a web page on a named host has one to ask for — not a
 * `mailto:` or `file:` link, not `localhost` or a bare address on the
 * person's network, which the icon request would otherwise reach.
 */
function faviconSource(href: string): string | undefined {
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`)
  } catch {
    return undefined
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined
  const host = url.hostname
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[")) return undefined
  return `${url.protocol}//${url.host}/favicon.ico`
}

export interface FaviconProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The page or site the icon stands for: a URL, or a bare host such as `example.com`. */
  href: string
  /**
   * Drawn until the site's icon has loaded, and kept when it cannot load —
   * no icon at the site, the site unreachable, or `href` not a web page.
   * Leave it out to draw nothing in those cases.
   */
  fallback?: React.ReactNode
}

/**
 * A site's own icon, beside a link to it. The icon is asked for lazily, from
 * the site itself and without a referrer, and shows only once it has loaded;
 * until then, and wherever it cannot load, the `fallback` stands in its
 * place. Decorative: the link's text carries the meaning, so the icon is
 * hidden from assistive technology. Size it with the host's `className`
 * (it defaults to `1em` square, so it follows the text it sits in).
 */
function Favicon({ href, fallback = null, className, ...props }: FaviconProps) {
  const source = faviconSource(href)
  const [status, setStatus] = React.useState(() =>
    source ? (iconStatus.get(source) ?? "loading") : "failed",
  )
  React.useEffect(() => {
    setStatus(source ? (iconStatus.get(source) ?? "loading") : "failed")
  }, [source])
  if (!source || status === "failed") return fallback
  const settle = (next: "loaded" | "failed") => {
    iconStatus.set(source, next)
    setStatus(next)
  }
  return (
    <span
      data-slot="favicon"
      data-state={status}
      aria-hidden="true"
      className={cn("relative inline-flex size-[1em] shrink-0 items-center justify-center", className)}
      {...props}
    >
      {status === "loading" ? fallback : null}
      <img
        src={source}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={(event) =>
          // A site answering with a 1×1 pixel or an empty image has no icon to show.
          settle(event.currentTarget.naturalWidth > 1 ? "loaded" : "failed")
        }
        onError={() => settle("failed")}
        className={cn(
          "size-full rounded-[2px] object-contain transition-opacity duration-150 ease-out motion-reduce:transition-none",
          status === "loaded" ? "opacity-100" : "absolute inset-0 opacity-0",
        )}
      />
    </span>
  )
}

export { Favicon }
