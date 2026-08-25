import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

/**
 * Run a child process and capture it whole. Lives on its own so the verifier
 * and the change-scope resolver share one definition instead of each growing
 * their own subprocess handling.
 */
export async function runCommand(command, options = {}) {
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== "string")) {
    throw new Error("Verification commands must be non-empty string arrays.");
  }
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = process.hrtime.bigint();
  return await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let outputTruncated = false;
    let settled = false;
    const append = (current, chunk) => {
      const combined = Buffer.concat([current, chunk]);
      if (combined.length > MAX_CAPTURE_BYTES) {
        outputTruncated = true;
        child.kill();
        return combined.subarray(0, MAX_CAPTURE_BYTES);
      }
      return combined;
    };
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        resolve({
          command: [...command],
          cwd,
          exit_code: null,
          timed_out: false,
          spawn_error: error.message,
          output_truncated: false,
          duration_ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
          stdout: stdout.toString("utf8"),
          stderr: stderr.toString("utf8")
        });
      }
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      resolve({
        command: [...command],
        cwd,
        exit_code: code,
        timed_out: timedOut,
        spawn_error: null,
        output_truncated: outputTruncated,
        duration_ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8")
      });
    });
  });
}
