# Brand marks

The source SVGs the channel marks in
`packages/react/src/components/message-actions/` are traced from. They are kept
here as provenance, not as build inputs: a registry consumer copies component
source into their own project and cannot reference a file in this repository,
so the distributed component carries the geometry inline.

| File | Source | Status |
| --- | --- | --- |
| `imessage.svg` | [File:IMessage_logo.svg](https://commons.wikimedia.org/wiki/File:IMessage_logo.svg) | `PD-textlogo` — below the threshold of originality, plus Commons' standard trademark warning |
| `mail-ios.svg` | [File:Mail_(iOS).svg](https://commons.wikimedia.org/wiki/File:Mail_(iOS).svg) | `PD-textlogo` — same status |

Public domain for copyright purposes does not settle trademark. Both marks are
Apple's. The components badge one only when the card's own `channel` names that
service, and a consumer shipping either is responsible for their own use of it.

When a mark is corrected upstream, update the SVG here first, then retrace the
component from it so the two never drift.
