import type { PriceChartBar } from "@nessa-ui/react"

/**
 * A deterministic pseudo-random walk. Stories must render the same bars on
 * every run — a live `Math.random` series would make screenshots, docs, and
 * play-test assertions disagree between runs.
 */
function walk(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** A session's worth of trade prices, one bar every `stepMs` milliseconds. */
export function priceSeries(options: {
  seed: number
  count: number
  start: number
  startTime: number
  stepMs: number
  drift?: number
  volatility?: number
}): PriceChartBar[] {
  const {
    seed,
    count,
    start,
    startTime,
    stepMs,
    drift = 0,
    volatility = 0.006,
  } = options
  const random = walk(seed)
  let price = start
  return Array.from({ length: count }, (_, index) => {
    price = Math.max(0.5, price * (1 + drift + (random() - 0.5) * volatility))
    return {
      time: startTime + index * stepMs,
      value: Number(price.toFixed(2)),
    }
  })
}

/** The same walk expressed as open/high/low/close bars for the candle view. */
export function candleSeries(options: {
  seed: number
  count: number
  start: number
  startTime: number
  stepMs: number
  drift?: number
  volatility?: number
}): PriceChartBar[] {
  const {
    seed,
    count,
    start,
    startTime,
    stepMs,
    drift = 0,
    volatility = 0.012,
  } = options
  const random = walk(seed)
  let close = start
  return Array.from({ length: count }, (_, index) => {
    const open = close
    close = Math.max(0.5, open * (1 + drift + (random() - 0.5) * volatility))
    const spread = open * volatility * 0.6
    return {
      time: startTime + index * stepMs,
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number((Math.max(open, close) + random() * spread).toFixed(2)),
      low: Number((Math.min(open, close) - random() * spread).toFixed(2)),
      value: Number(close.toFixed(2)),
    }
  })
}

/** Fixed session start so every label and assertion stays reproducible. */
export const SESSION_START = Date.UTC(2026, 7, 27, 13, 30)
