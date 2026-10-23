import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ToolTrace, type ToolTraceStep } from "@nessalabs/ui";
import { FileText, Globe, Pencil, Search, SquareTerminal } from "lucide-react";

import { storyDocumentation } from "./story-documentation";

/**
 * Cancels the trace's endless motion (the shimmer and the working rings) so
 * a play test leaves nothing running into the rest of the suite. Each sweep
 * starts in an effect, after paint, so it first waits until every shimmering
 * label has its sweep — not merely until something moves, which the rings
 * satisfy from the first paint — then cancels and waits for stillness. No-ops
 * outside the vitest/webdriver runner so the canvas stays live for people
 * watching.
 */
async function stopMotion(canvasElement: HTMLElement) {
  const view = canvasElement.ownerDocument.defaultView;
  if (!view?.navigator.webdriver) return;
  await waitFor(() => {
    for (const node of canvasElement.querySelectorAll<HTMLElement>(
      '[data-shimmer="true"]',
    ))
      expect(node.getAnimations().length).toBeGreaterThan(0);
  });
  canvasElement
    .getAnimations({ subtree: true })
    .forEach((animation) => animation.cancel());
  await waitFor(() =>
    expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0),
  );
}

/** A fixed clock: the stories never read the real one, so nothing keeps ticking. */
const T0 = Date.UTC(2026, 9, 23, 9, 0, 0);
const at = (seconds: number) => T0 + seconds * 1000;

const kinds = {
  read: { label: "Read", icon: <FileText /> },
  search: { label: "Searched", icon: <Search /> },
  run: { label: "Ran", icon: <SquareTerminal />, strong: true },
  fetch: { label: "Fetched", icon: <Globe /> },
  edit: { label: "Edited", icon: <Pencil />, strong: true },
} as const;

const before = `#!/usr/bin/env bash
set -euo pipefail
security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
codesign --force --sign "$SIGNING_CERT" Nessa.app
xcrun notarytool submit Nessa.zip --wait
`;
const after = `#!/usr/bin/env bash
set -euo pipefail
security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
security import "$CERT_P12" -k build.keychain -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: build.keychain
codesign --force --options runtime --sign "$SIGNING_CERT" Nessa.app
xcrun notarytool submit Nessa.zip --wait
`;

let ids = 0;
function step(
  kind: keyof typeof kinds,
  detail: string,
  start: number,
  seconds: number | null,
  extra: Partial<ToolTraceStep> = {},
): ToolTraceStep {
  const settled = seconds !== null;
  return {
    id: `step-${ids++}`,
    ...kinds[kind],
    detail,
    status: settled ? "completed" : "running",
    startedAtMs: at(start),
    ...(settled && { endedAtMs: at(start + seconds) }),
    input: JSON.stringify(
      kind === "run"
        ? { command: detail, cwd: "~/nessa-agent" }
        : kind === "search"
          ? { pattern: detail.split(" in ")[0], path: detail.split(" in ")[1] }
          : kind === "fetch"
            ? { url: `https://${detail}` }
            : { path: detail },
    ),
    ...(settled && { output: `${detail}: ok` }),
    ...extra,
  };
}

const short: ToolTraceStep[] = [
  step("read", "ci/sign.sh", 0, 0.1, {
    output: before,
  }),
  step("search", "SIGNING_CERT in .github/", 0.1, 0.3, {
    output:
      '.github/workflows/release.yml:42   SIGNING_CERT: ${{ secrets.SIGNING_CERT }}\nci/sign.sh:4                       --sign "$SIGNING_CERT" Nessa.app',
  }),
  step(
    "run",
    'security find-certificate -c "Developer ID" build.keychain',
    0.4,
    1.2,
    {
      output:
        "-----BEGIN CERTIFICATE-----\nMIIF2DCCBMCgAwIBAgIIQ2xhdWRlIE5lc3NhMA0GCSqGSIb3DQEBCwUAMHkx\n-----END CERTIFICATE-----\nnotAfter=Oct 25 23:59:59 2026 GMT",
    },
  ),
  step("fetch", "developer.apple.com/account/resources", 1.6, 0.8, {
    output: "200 OK · 48 KB\nDeveloper ID Application · expires 2026-10-25",
  }),
  step("edit", "ci/sign.sh", 2.4, 0.2, {
    added: 3,
    removed: 1,
    diff: { filename: "ci/sign.sh", from: before, to: after },
    output: "Applied 1 replacement to ci/sign.sh",
  }),
];

const failed: ToolTraceStep[] = [
  ...short.slice(0, 3),
  step("run", "codesign --verify --deep Nessa.app", 2.6, 0.4, {
    status: "failed",
    output:
      "Nessa.app: code object is not signed at all\nIn architecture: arm64\nexit status 1",
  }),
];

const long: ToolTraceStep[] = (() => {
  const plan: [keyof typeof kinds, string, number, Partial<ToolTraceStep>?][] =
    [
      ["read", "README.md", 0.1],
      ["read", "ci/sign.sh", 0.1],
      ["search", "SIGNING_CERT in .github/", 0.3],
      ["run", "security list-keychains", 0.4],
      ["fetch", "developer.apple.com/account/resources", 0.8],
      ["run", "security import cert.p12 -k build.keychain", 2.1],
      ["edit", "ci/sign.sh", 0.2, { added: 6, removed: 1 }],
      ["run", "bash ci/sign.sh", 38],
      ["read", "build/sign.log", 0.1],
      ["run", "bash ci/sign.sh", 41],
      ["run", "pnpm test --watch", 130, { status: "stopped" }],
      ["run", "pnpm test --filter release", 184],
      ["edit", "src/release/notarize.ts", 0.3, { added: 18, removed: 6 }],
      ["run", "pnpm typecheck", 21],
      ["run", "pnpm test --filter release", 96],
      ["edit", "CHANGELOG.md", 0.1, { added: 4 }],
      ["run", "just release --dry-run", 52],
      ["run", "gh run watch", 33],
    ];
  let t = 0;
  return plan.map(([kind, detail, seconds, extra]) => {
    const made = step(kind, detail, t, seconds, extra);
    t += seconds + 4;
    return made;
  });
})();

const liveNow = at(31);
const live: ToolTraceStep[] = [
  step("read", "ci/sign.sh", 0, 3),
  step("search", "SIGNING_CERT in .github/", 3, 4.2),
  step("search", "keychain in scripts/", 3, 5.4),
  step("read", ".github/workflows/release.yml", 8.4, 2.4),
  step(
    "run",
    'security find-certificate -c "Developer ID" build.keychain',
    10.8,
    9.6,
  ),
  step("fetch", "developer.apple.com/account/resources", 10.8, 7.2),
  step("run", "security import cert.p12 -k build.keychain", 22.8, 7.2),
  step("run", "codesign --verify --deep Nessa.app", 30, null),
  step("read", "scripts/import-cert.sh", 30.2, null),
];

const untimed: ToolTraceStep[] = short.map(
  ({ startedAtMs: _start, endedAtMs: _end, ...rest }) => rest,
);

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[min(36rem,calc(100vw-2rem))] rounded-2xl bg-background p-4">
      {children}
    </div>
  );
}

const meta = {
  title: "Agents/ToolTrace",
  component: ToolTrace,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A run of an agent's tool calls as one quiet line that opens into a waterfall. The line shows one tools glyph, the summary, a small bar of the whole run and how long it took. Opened, each call sits on a shared time axis; earlier calls fold into one row once there are more than a few, and the axis covers only what is shown. Clicking a call opens its card in place, at the row's width: Diff for an edit, then Input and Output, at a fixed height. One card is open at a time.",
      },
    },
  },
  args: { steps: short, now: T0 },
  render: (args) => (
    <Frame>
      <ToolTrace {...args} />
    </Frame>
  ),
} satisfies Meta<typeof ToolTrace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  parameters: storyDocumentation(
    "A settled run, closed: the line alone. Clicking it opens the waterfall.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const line = canvas.getByRole("button", { name: /Ran 5 tools/ });
    await expect(line).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(line);
    await expect(line).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("button", { name: /Edited ci\/sign\.sh/ }),
    ).toBeVisible();
    await userEvent.click(line);
    await expect(line).toHaveAttribute("aria-expanded", "false");
  },
};

export const OpenedWithDetails: Story = {
  args: { defaultOpen: true },
  parameters: storyDocumentation(
    "Clicking a call opens its card in place. An edit opens on its diff; Input shows the call's arguments, one row each. Opening another call closes the first.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const command = canvas.getByRole("button", { name: /Ran security find/ });
    await userEvent.click(command);
    await expect(command).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(canvas.getByRole("tab", { name: "Input" }));
    await expect(canvas.getByText("cwd")).toBeVisible();
    // One card at a time: the edit's opens and the command's closes.
    const edit = canvas.getByRole("button", { name: /Edited ci\/sign\.sh/ });
    await userEvent.click(edit);
    await expect(edit).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("button", { name: /Ran security find/ }),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.getByRole("tab", { name: "Diff" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.getAllByRole("tabpanel")).toHaveLength(1);
    // The diff is drawn once Pierre's engine arrives; wait for its lines.
    const diff = canvasElement.querySelector('[data-slot="tool-call-diff"]');
    await expect(diff).not.toBeNull();
    await waitFor(
      () =>
        expect(diff!.firstElementChild?.shadowRoot?.textContent).toContain(
          "set-key-partition-list",
        ),
      { timeout: 15000 },
    );
  },
};

export const LongRun: Story = {
  args: { steps: long, defaultOpen: true },
  parameters: storyDocumentation(
    "A twelve-minute run of 18 calls. The last four show; the rest fold into one row with the time they span. The axis covers only the calls shown, so the long commands still read.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Past a minute, the axis counts minutes.
    await expect(
      canvasElement.querySelector("[data-slot=tool-trace-axis]")?.textContent,
    ).toMatch(/^\d+:\d\d/);
    const earlier = canvas.getByRole("button", { name: /14 earlier/ });
    await expect(
      canvasElement.querySelectorAll("[data-slot=tool-trace-step]"),
    ).toHaveLength(4);
    await userEvent.click(earlier);
    await expect(earlier).toHaveAccessibleName(/Hide 14 earlier/);
    const rows = () =>
      canvasElement.querySelectorAll<HTMLElement>(
        "[data-slot=tool-trace-step]",
      );
    await expect(rows()).toHaveLength(18);
    // Opening an earlier call's card leaves the fold as it was ...
    await userEvent.click(rows()[2]!);
    await expect(rows()[2]).toHaveAttribute("aria-expanded", "true");
    await expect(earlier).toHaveAccessibleName(/Hide 14 earlier/);
    // ... and hiding the earlier calls closes it with them.
    await userEvent.click(earlier);
    await expect(rows()).toHaveLength(4);
    await expect(earlier).toHaveFocus();
    await userEvent.click(earlier);
    await expect(rows()).toHaveLength(18);
    await expect(rows()[2]).toHaveAttribute("aria-expanded", "false");
  },
};

export const Instant: Story = {
  args: {
    steps: [
      step("read", "package.json", 0, 0.02),
      step("search", "TODO in src/", 0.4, 0.01),
      step("read", "src/main.ts", 0.8, 0.03),
    ],
    defaultOpen: true,
  },
  parameters: storyDocumentation(
    "A second-long run of calls that each took a few milliseconds. Each reads under a tenth of a second rather than none, and the axis counts seconds, since minutes would read 0:00 at every mark.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("<0.1s")).toHaveLength(3);
    const marks = [
      ...canvasElement.querySelectorAll(
        "[data-slot=tool-trace-axis] span span",
      ),
    ].map((mark) => mark.textContent);
    await expect(marks).toEqual(["0s", "0.4s", "0.8s"]);
  },
};

export const Failed: Story = {
  args: { steps: failed, status: "error", defaultOpen: true },
  parameters: storyDocumentation(
    "A run that ended on a failure: the line says how many failed, the failed call is drawn in the destructive tone, and its card shows what it printed.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 failed")).toBeVisible();
    // The failure is in the row's name, not only its colour.
    const bad = canvas.getByRole("button", { name: /Ran codesign.*, failed/ });
    await expect(bad).toHaveAttribute("data-status", "failed");
    await userEvent.click(bad);
    await expect(canvas.getByText(/not signed at all/)).toBeVisible();
  },
};

export const Working: Story = {
  args: { steps: live, status: "running", now: liveNow, defaultOpen: true },
  parameters: storyDocumentation(
    "While the agent works the line reads Working and the running calls' bars reach to now. Running calls always show; here three settled ones stay beside them and the rest fold. The story pins the clock; a host without `now` gets a trace that keeps time on its own.",
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /Working/ }),
    ).toHaveAttribute("aria-expanded", "true");
    const running = canvasElement.querySelectorAll(
      "[data-slot=tool-trace-step][data-status=running]",
    );
    await expect(running).toHaveLength(2);
    for (const row of running)
      await expect(row).toHaveAccessibleName(/, running/);
    await expect(
      canvas.getByRole("button", { name: /4 earlier/ }),
    ).toBeVisible();
    await stopMotion(canvasElement);
  },
};

export const WithoutTimes: Story = {
  args: { steps: untimed, defaultOpen: true },
  parameters: storyDocumentation(
    "Calls saved before their times were kept: no bars, no axis and no total, and an edit shows its line counts instead.",
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-slot=tool-trace-axis]"),
      ).toBeNull(),
    );
    await expect(
      canvasElement.querySelector("[data-slot=tool-trace-mini-bar]"),
    ).toBeNull();
  },
};
