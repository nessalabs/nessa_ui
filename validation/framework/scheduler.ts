import { availableParallelism } from "node:os"

export async function runBounded<T>(
  tasks: readonly (() => Promise<T>)[],
  concurrency = Math.min(4, availableParallelism()),
): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const index = cursor
      cursor += 1
      results[index] = await tasks[index]!()
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, worker))
  return results
}
