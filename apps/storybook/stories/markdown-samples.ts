/** Markdown replies shared by the MessageMarkdown and ReplyMarkdown stories. */

export const richMarkdown = `## Reconciling the Q3 numbers

The dashboard and the report agree through August, then diverge for **one
reason**: pending invoices. The dashboard counts them at *issue time*, the
report defers them to Q4.

### What I checked

1. Exported both series with \`revenue --granularity month\`
2. Diffed the monthly totals
3. Traced every mismatch to an invoice

| Month | Dashboard | Report |
| --- | --- | --- |
| July | 118k | 118k |
| August | 126k | 126k |
| September | 141k | 128k |

> Only September differs, and the 13k gap is exactly the sum of the three
> pending invoices.

The fix is a one-line filter:

\`\`\`sql
SELECT SUM(amount) FROM invoices WHERE status != 'pending';
\`\`\`

More detail in the [reconciliation notes](https://example.com/notes).

---

Ping me if October should use the same rule.`

export const mathMarkdown = `The savings follow from compound growth. Monthly
contributions $c$ at rate $r$ grow to

$$
FV = c \\cdot \\frac{(1 + r)^{n} - 1}{r}
$$

so with $r = 0.05/12$ and $n = 120$ months the multiplier is about
$155.3$, and the classic identity $e^{i\\pi} + 1 = 0$ still holds.`

// Content headings start at h2: the docs page owns the h1, and the docs
// gate asserts the page's last h1 sits inside the initial viewport.
export const streamedMarkdown = `## Streaming markdown, smoothly

The pacing that drives the letter-by-letter reveal feeds this document too: the smoothed text streams through MessageMarkdown with \`streaming\` set, so newly arrived prose fades in with the very same animation while headings, lists, code, tables, diagrams, and math render as their blocks complete.

## Why the cushion matters

1. Bursty chunks stop looking like bursts — the reveal velocity eases instead of surging.
2. A stalled network drains the buffer gracefully before pausing.
3. Fast streams are never rate-capped; the display just trails by the same cushion.

## Some code on the way through

\`\`\`tsx
function StreamedReply({ received }: { received: string }) {
  // The same smoothing hook feeds every display.
  const { text, done } = useMessageStreamText(received)
  return <MessageMarkdown streaming={!done}>{text}</MessageMarkdown>
}
\`\`\`

Inline code like \`useMessageStreamText(received)\` streams through unharmed, as does emphasis, ~~strikethrough~~, and [links](https://example.com).

## Diagrams stream too

A flowchart drawn from a \`\`\`mermaid fence:

\`\`\`mermaid
graph LR
  A[Chunks arrive] --> B[Smooth the pacing]
  B --> C{Buffer empty?}
  C -- no --> D[Keep revealing]
  C -- yes --> E[Pause at the edge]
  D --> C
\`\`\`

And a sequence diagram from the same component:

\`\`\`mermaid
sequenceDiagram
  participant H as Host
  participant M as MessageMarkdown
  H->>M: partial markdown
  M->>M: render latest complete blocks
  M-->>H: smooth streaming UI
\`\`\`

## And some math

Inline math such as $e^{i\\pi} + 1 = 0$ renders once its delimiters close, and display math arrives as a block:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

The reveal rate follows the token arrival rate $r(t)$ with a target backlog of $r(t) \\cdot \\tau$ characters — the trail cushion.

## Tables and the rest

| Knob | Unit | What it shapes |
| --- | --- | --- |
| speed | chars/sec | Floor rate that finishes the tail |
| trail | seconds | Cushion behind the stream edge |
| adapt | seconds | How hard chunk boundaries are smoothed |

> Blockquotes, horizontal rules, and everything else GitHub-flavored markdown ships stream the same way: the latest complete blocks render, and partial syntax at the tail resolves as its closing characters arrive.

---

That's the whole trick: one smoothing hook, one animation, every display.`

export const tableMarkdown = `### Prices & passes

| Option | Price | Includes | Availability |
| --- | --- | --- | --- |
| Single ticket | $16.99 CAD | One screening, general admission (unassigned seating) | On sale since Sept 29; no evidence single tickets overall are sold out, but per-screening status unconfirmed |
| Cine-Maniac Pass | $150 CAD | All Scotiabank screenings, rush priority, social events | |

### Screenings by venue

| Film | Venue | Date | Time | Runtime | Format | Language | Seats left |
| --- | --- | --- | --- | ---: | --- | --- | ---: |
| The Last Projectionist | Cineplex Scotiabank Theatre | Sat Oct 17 | 12:30 pm | 104 min | DCP | English | 42 |
| Night Shift at the Lighthouse | CineCycle | Sat Oct 17 | 11:59 pm | 88 min | 16 mm | French, English subtitles | 9 |
| Cardboard Kingdoms | Cineplex Scotiabank Theatre | Sun Oct 18 | 3:15 pm | 97 min | DCP | English | 120 |`
