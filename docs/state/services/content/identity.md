---
id: "ui-identity"
title: "Identity and pairing"
kind: "contract"
status: "implemented"
summary: "PairingCode, KeyFingerprint, DeviceFigure and orb visuals help a host present another computer or agent. They do not authenticate that computer or establish a remote link."
parent: "ui-content"
sources:
  [
    "packages/react/src/components/pairing-code.tsx",
    "packages/react/src/components/key-fingerprint.tsx",
    "packages/react/src/components/qr-orb.tsx",
    "packages/react/src/components/signal-orb.tsx",
    "packages/react/src/lib/orb-code.ts",
    "packages/react/src/components/favicon.tsx",
    "packages/react/src/components/random-avatar.tsx",
    "packages/react/src/components/bloom-field.tsx",
    "packages/react/src/components/type-in.tsx",
  ]
sourceRevision: "a32191c26ee27c2d8159ab6498a0f0530a93e3ea"
diagramLinks: {}
---

# Show identity and pairing progress

PairingCode, KeyFingerprint, DeviceFigure and orb visuals help a host present another computer or agent. They do not authenticate that computer or establish a remote link.

PairingCode displays the supplied one-use code and status. An open code can expire locally as its expiry time passes; the host supplies other outcomes. A countdown reaching zero is a display decision, while a server can independently reject a stale or revoked code. KeyFingerprint normalizes separators for grouping; visual grouping does not cryptographically verify a key.

QrOrb and SignalOrb render code/art surfaces. The framework-free orb-code helpers encode/decode their visual representation and have unit tests. A successful decode recovers a code, not approval from a remote device. Camera capture, peer verification and submission are host responsibilities.

RandomAvatar, AvatarStack, AgentFigure, AgentCard and DeviceFigure show supplied identity. BloomField, GradientSurface, GradientText, MorphingMeshGradient, TypeIn, StepDots and loading/progress visuals provide artwork or local motion. Their reduced-motion behavior and deterministic seeds are presentation concerns; they are not agent execution states. Favicon can fetch/cache a site's icon and fail independently from the referenced resource. Do not infer site availability or identity verification from whether its icon rendered.
