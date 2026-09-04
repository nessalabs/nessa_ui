/**
 * Captures the raw Messages API stream — the wire a host sees when it calls
 * `@anthropic-ai/sdk` directly, with no Claude Code CLI in front of it.
 *
 * One JSON object per line, exactly as the SDK yields it. Nothing is
 * reshaped: the point of a capture is to be evidence, so a field this script
 * renamed would be a field the parser was designed against wrongly.
 *
 * See README.md in this directory for how to run it and the traps that cost a
 * capture. In short:
 *
 *   node claude-messages.mjs <scenario> > ../claude-messages/<scenario>.jsonl
 *
 * Scenarios (run all four; each exercises shapes the others do not):
 *   text      text deltas only, the simplest possible turn
 *   thinking  adaptive thinking with summaries — thinking_delta + signature_delta
 *   tools     a custom tool call, then its result fed back — input_json_delta,
 *             stop_reason "tool_use", and a second message in the same capture
 *   search    the server-side web_search tool — server tool blocks arrive as
 *             content, not as a client-side tool call, and nothing else shows that
 *   parallel  two tool calls in one assistant message, both results returned in
 *             one user message — the shape a mapper's block indexing gets wrong
 *   truncated a turn cut off by max_tokens: stop_reason "max_tokens" with a
 *             content block that never gets a content_block_stop of its own
 *   eager     eager_input_streaming, which changes when input_json_delta starts
 *             arriving relative to the block's name being known
 *   structured  output_config.format — a schema-constrained response
 *   image     an image in the prompt, and the usage that comes with it
 *   failing   a tool result carrying is_error, and the turn continuing anyway
 */

import Anthropic from "@anthropic-ai/sdk"

const MODEL = process.env.CAPTURE_MODEL ?? "claude-opus-5"
const scenario = process.argv[2] ?? "text"
const client = new Anthropic()

/** Every line the capture contains, written as it arrives so a crash still leaves evidence. */
function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

/**
 * Streams one request and returns the assembled message.
 *
 * The events are written raw and the final message is returned for the caller
 * to continue the conversation with — the SDK's own accumulation, rather than
 * this script reassembling deltas and possibly disagreeing with it.
 */
async function streamOnce(params) {
  const stream = client.messages.stream(params)
  for await (const event of stream) emit(event)
  return await stream.finalMessage()
}

const WEATHER_TOOL = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  input_schema: {
    type: "object",
    properties: { city: { type: "string" }, unit: { type: "string", enum: ["c", "f"] } },
    required: ["city"],
    additionalProperties: false,
  },
}

const base = { model: MODEL, max_tokens: 4096 }

if (scenario === "text") {
  await streamOnce({
    ...base,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "In two sentences, what is a newline-delimited JSON stream?" }],
  })
} else if (scenario === "thinking") {
  await streamOnce({
    ...base,
    // Without an explicit `summarized` the thinking blocks stream with empty
    // text on current models, and a capture of empty blocks would teach the
    // parser nothing about the delta shapes it has to join.
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: "high" },
    messages: [{ role: "user", content: "A farmer has 17 sheep; all but 9 run away. How many are left? Reason it through." }],
  })
} else if (scenario === "tools") {
  const messages = [{ role: "user", content: "What is the weather in Oslo? Use the tool." }]
  const first = await streamOnce({ ...base, thinking: { type: "disabled" }, tools: [WEATHER_TOOL], messages })

  // The second turn is what makes this capture worth taking: a tool_result
  // going back up is the only way to see how the wire carries one.
  const call = first.content.find((block) => block.type === "tool_use")
  if (call) {
    messages.push({ role: "assistant", content: first.content })
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify({ city: "Oslo", temperature: 4, unit: "c", conditions: "overcast" }),
        },
      ],
    })
    await streamOnce({ ...base, thinking: { type: "disabled" }, tools: [WEATHER_TOOL], messages })
  }
} else if (scenario === "search") {
  await streamOnce({
    ...base,
    thinking: { type: "disabled" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
    messages: [{ role: "user", content: "What is the newest release of the Zig programming language?" }],
  })
} else if (scenario === "parallel") {
  const TIME_TOOL = {
    name: "get_time",
    description: "Get the current local time for a city.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
      additionalProperties: false,
    },
  }
  const messages = [
    { role: "user", content: "Get both the weather and the local time for Oslo. Call both tools at once." },
  ]
  const first = await streamOnce({
    ...base,
    thinking: { type: "disabled" },
    tools: [WEATHER_TOOL, TIME_TOOL],
    messages,
  })

  const calls = first.content.filter((block) => block.type === "tool_use")
  if (calls.length > 0) {
    messages.push({ role: "assistant", content: first.content })
    // Every result goes back in ONE user message. Splitting them is the
    // documented way to train the model out of parallel calls, and it would
    // also make this capture describe a wire nobody should write against.
    messages.push({
      role: "user",
      content: calls.map((call) => ({
        type: "tool_result",
        tool_use_id: call.id,
        content:
          call.name === "get_weather"
            ? JSON.stringify({ city: "Oslo", temperature: 4, unit: "c" })
            : JSON.stringify({ city: "Oslo", time: "18:42", zone: "CET" }),
      })),
    })
    await streamOnce({ ...base, thinking: { type: "disabled" }, tools: [WEATHER_TOOL, TIME_TOOL], messages })
  }
} else if (scenario === "truncated") {
  await streamOnce({
    ...base,
    max_tokens: 24,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: "Write a long paragraph about the history of the semicolon." }],
  })
} else if (scenario === "eager") {
  await streamOnce({
    ...base,
    thinking: { type: "disabled" },
    // Not a beta: a flag on the tool itself. It makes argument fragments start
    // flowing earlier, which is exactly the timing a delta-joining parser has
    // to survive.
    tools: [{ ...WEATHER_TOOL, eager_input_streaming: true }],
    messages: [{ role: "user", content: "What is the weather in Reykjavik? Use the tool." }],
  })
} else if (scenario === "structured") {
  await streamOnce({
    ...base,
    thinking: { type: "disabled" },
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            language: { type: "string" },
            year: { type: "integer" },
            creators: { type: "array", items: { type: "string" } },
          },
          required: ["language", "year", "creators"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: "Describe the Rust programming language." }],
  })
} else if (scenario === "image") {
  // A 1x1 red PNG, inline so the capture needs no asset beside it.
  const RED_DOT =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  await streamOnce({
    ...base,
    thinking: { type: "disabled" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: RED_DOT } },
          { type: "text", text: "What colour is this image? Answer in one word." },
        ],
      },
    ],
  })
} else if (scenario === "failing") {
  const messages = [{ role: "user", content: "What is the weather in Atlantis? Use the tool." }]
  const first = await streamOnce({ ...base, thinking: { type: "disabled" }, tools: [WEATHER_TOOL], messages })

  const call = first.content.find((block) => block.type === "tool_use")
  if (call) {
    messages.push({ role: "assistant", content: first.content })
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: call.id,
          // A failed tool is still a tool_result — dropping it is what breaks
          // the conversation, and `is_error` is how the failure is carried.
          is_error: true,
          content: "UnknownCityError: no weather station matches 'Atlantis'",
        },
      ],
    })
    await streamOnce({ ...base, thinking: { type: "disabled" }, tools: [WEATHER_TOOL], messages })
  }
} else {
  process.stderr.write(`unknown scenario: ${scenario}\n`)
  process.exit(1)
}
