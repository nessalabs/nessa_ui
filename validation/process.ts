import { spawn } from "node:child_process"

export function runCommand(
  command: string,
  args: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; capture?: boolean; input?: string },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.capture ? [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"] : "inherit",
    })
    let stdout = ""
    let stderr = ""
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk })
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk })
    if (options.capture && options.input !== undefined) child.stdin?.end(options.input)
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} ${args.join(" ")} failed (${signal ?? code})${stderr ? `\n${stderr}` : ""}`))
    })
  })
}
