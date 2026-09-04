/**
 * Captures the Agent SDK across the same scenario matrix the CLI fixtures use.
 *
 * The point is not more captures for their own sake: the Storybook explorer
 * offers a scenario per transport, so a transport with only four recordings
 * has nothing to show for the other nine. Recording the same scenarios through
 * `query()` is what lets the two be compared on equal terms — and what would
 * expose any scenario where the SDK and the CLI genuinely differ.
 *
 * See README.md in this directory for how to run it and the traps that cost a
 * capture. In short:
 *
 *   node claude-agent-sdk.mjs <scenario> > ../claude-agent-sdk/<scenario>.jsonl
 */

import { query } from "@anthropic-ai/claude-agent-sdk"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const MODEL = process.env.CAPTURE_MODEL ?? "claude-sonnet-5"
const scenario = process.argv[2] ?? "printed"

/** A throwaway working directory, so a capture never edits the repository. */
const sandbox = mkdtempSync(join(tmpdir(), "agent-sdk-capture-"))
writeFileSync(join(sandbox, "notes.txt"), "alpha\nbravo\ncharlie\n")

/**
 * The prompts are the CLI fixtures' prompts, deliberately.
 *
 * A scenario recorded from a different prompt would compare two different
 * conversations and call the difference a property of the transport.
 */
const SCENARIOS = {
  printed: {
    prompt: "Print exactly: hello world. Do not use any tools.",
    allowedTools: [],
  },
  tools: {
    prompt:
      "Create a file notes2.txt containing three lines of text, then read it back, then run 'wc -l notes2.txt'. Keep it brief.",
    allowedTools: ["Bash", "Read", "Write"],
  },
  todos: {
    prompt:
      "Use your todo list to plan and then do these three steps: create a.txt with 'a', create b.txt with 'b', then run 'ls *.txt'. Track each step in your todos.",
    allowedTools: ["Bash", "Write", "TaskCreate", "TaskUpdate", "TodoWrite"],
  },
  subagent: {
    prompt:
      "Use the Explore subagent to find out what files are in this directory, then tell me what it found in one line.",
    allowedTools: ["Task", "Bash", "Read", "Glob", "Grep"],
  },
  workflow: {
    prompt:
      "Use a workflow to run three agents in parallel, each printing a different greeting (hello, hola, bonjour), then summarize what they returned. Keep it tiny.",
    // The tool is literally named `Workflow`; without it the run is denied and
    // the capture records a refusal rather than a workflow.
    allowedTools: ["Workflow", "Task", "Bash"],
  },
  phases: {
    prompt:
      "Use a workflow with THREE phases: 'Greet' runs two agents in parallel (hello, hola); 'Translate' runs one (bonjour); 'Summarize' lists all three.",
    allowedTools: ["Workflow", "Task", "Bash"],
  },
  failing: {
    prompt: "Run the command 'cat /nonexistent/definitely-missing-file' and then tell me what happened in one sentence.",
    allowedTools: ["Bash"],
  },
  websearch: {
    prompt: "Search the web for the current version of the TypeScript compiler and tell me in one line.",
    allowedTools: ["WebSearch", "WebFetch"],
  },
}

/**
 * The approval scenarios, which cannot be expressed as a row above.
 *
 * They need `canUseTool`, and they must NOT list the tool in `allowedTools` —
 * a bare name there auto-approves before the callback is consulted, and the
 * capture would contain no approval at all.
 */
const APPROVALS = {
  // `rm` rather than `echo`: an allow rule in the developer's own settings
  // covers `echo` and shadows the callback silently, so a capture taken with
  // it contains a tool call and no approval. The command is scoped to the
  // throwaway sandbox, so allowing it is harmless.
  "approval-allow": {
    decision: "allow",
    prompt: "Delete the file notes.txt by running `rm notes.txt` with the Bash tool, then confirm it is gone.",
  },
  "approval-deny": {
    decision: "deny",
    prompt: "Delete the file notes.txt by running `rm notes.txt` with the Bash tool, then confirm it is gone.",
  },
}

process.stderr.write(`sandbox: ${sandbox}\n`)

async function drive(options) {
  for await (const message of query(options)) {
    process.stdout.write(`${JSON.stringify(message)}\n`)
  }
}

const approval = APPROVALS[scenario]
if (approval !== undefined) {
  await drive({
    prompt: approval.prompt,
    options: {
      model: MODEL,
      cwd: sandbox,
      includePartialMessages: true,
      permissionMode: "default",
      canUseTool: async (toolName, input) => {
        process.stderr.write(`asked: ${toolName}\n`)
        return approval.decision === "allow"
          ? { behavior: "allow", updatedInput: input }
          : { behavior: "deny", message: "Denied by the capture script." }
      },
    },
  })
} else if (scenario === "resume") {
  // Two processes, one session: the second `init` is the only place a model
  // change is visible at all, which is the whole point of the scenario.
  let sessionId = null
  for await (const message of query({
    prompt: "Remember the number 47. Create marker.txt containing it. Keep it brief.",
    options: { model: MODEL, cwd: sandbox, allowedTools: ["Write"], includePartialMessages: true, permissionMode: "acceptEdits" },
  })) {
    process.stdout.write(`${JSON.stringify(message)}\n`)
    if (message.type === "system" && message.subtype === "init") sessionId = message.session_id
  }

  await drive({
    prompt: "What number did I ask you to remember?",
    options: {
      model: "claude-haiku-4-5",
      cwd: sandbox,
      allowedTools: [],
      includePartialMessages: true,
      resume: sessionId,
    },
  })
} else {
  const chosen = SCENARIOS[scenario]
  if (chosen === undefined) {
    process.stderr.write(`unknown scenario: ${scenario}\n`)
    process.exit(1)
  }
  await drive({
    prompt: chosen.prompt,
    options: {
      model: MODEL,
      cwd: sandbox,
      allowedTools: chosen.allowedTools,
      includePartialMessages: true,
      permissionMode: "acceptEdits",
    },
  })
}
