"use client"

import * as React from "react"

import { IMessageLogo } from "./imessage-logo"
import { MailLogo } from "./mail-logo"

/**
 * The channels this module ships a mark for, matched against the display name
 * the card was given. Matching is on whole words, so "Gmail" never picks up
 * Apple's Mail mark from the letters inside it, while "Apple Mail" and
 * "Mail (iCloud)" do.
 */
const builtInMarks: readonly {
  words: readonly string[]
  render: () => React.ReactElement
}[] = [
  { words: ["messages", "imessage"], render: () => <IMessageLogo /> },
  { words: ["mail"], render: () => <MailLogo /> },
]

/** Splits a channel name into lowercase word tokens. */
function channelWords(channel: string): string[] {
  return channel.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * The mark for a channel this module knows, or `null` for one it does not.
 *
 * These are trademarks, so the rule is deliberately narrow: a card badges a
 * mark only when its own `channel` names that service. Every other channel
 * shows no badge until its host passes one — a wrong logo is worse than none.
 */
export function builtInChannelMark(channel: string): React.ReactElement | null {
  const words = channelWords(channel)
  const match = builtInMarks.find((candidate) =>
    candidate.words.some((word) => words.includes(word)),
  )
  return match ? match.render() : null
}
