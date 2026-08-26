import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

/**
 * On Windows, npm/pnpm/pnpx and friends are .cmd shims, and CreateProcess --
 * which spawn(shell:false) uses -- refuses them outright (ENOENT), while every
 * .exe on the same PATH works. The U-King pilot hit this class of failure with
 * os error 193 long before this repository did; the fix is the same one it
 * shipped: resolve the program across PATH x PATHEXT ourselves, and route any
 * .cmd/.bat through cmd.exe explicitly instead of letting spawn fail silently.
 */
function resolveExecutable(program, cwd) {
  const hasDirectoryPart = /^[a-zA-Z]:[\\/]|^[\\/]|[\\/]/.test(program);
  const directories = hasDirectoryPart
    ? [path.isAbsolute(program) ? "" : cwd]
    : [cwd, ...process.env.PATH.split(path.delimiter).filter(Boolean)];
  const extensions = path.extname(program)
    ? [""]
    : (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
        .split(";")
        .map((extension) => extension.trim())
        .filter(Boolean);
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.resolve(directory, `${program}${extension}`);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // Not here; keep scanning PATH.
      }
    }
  }
  return null;
}

/**
 * Build the spawn target for a resolved .cmd/.bat: cmd.exe /d /s /c with the
 * whole line wrapped once -- the arrangement cmd.exe itself uses, so the outer
 * quotes are stripped and the inner ones survive. cmd metacharacters (& | < >
 * ^) are caret-escaped even inside quotes, because cmd splits the line before
 * quote-aware argument parsing would protect them. Plan commands come from the
 * repository's own verification plan, the same trust level as the rest of the
 * run; an argument carrying a literal double quote cannot survive a cmd line
 * and should live behind a script instead.
 */
function buildBatchSpawn(command, executablePath) {
  const escapeMeta = (part) => part.replace(/\^|[&|<>]/g, (character) => `^${character}`);
  const quote = (part) => {
    const escaped = escapeMeta(part);
    return part === "" || /[\s"]/.test(part) ? `"${escaped}"` : escaped;
  };
  const line = [`"${executablePath}"`, ...command.slice(1).map(quote)].join(" ");
  return {
    file: process.env.comspec || "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`]
  };
}

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
  let file = command[0];
  let args = command.slice(1);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = process.hrtime.bigint();
  let batchWrapped = false;
  if (process.platform === "win32") {
    const resolved = resolveExecutable(command[0], cwd);
    if (resolved && /\.(cmd|bat)$/i.test(resolved)) {
      const batch = buildBatchSpawn(command, resolved);
      file = batch.file;
      args = batch.args;
      batchWrapped = true;
    } else if (resolved) {
      file = resolved;
    }
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: false,
      windowsHide: true,
      // The batch wrapper's last argument deliberately carries literal quotes
      // (the /s contract: one outer pair around an inner-quoted command line).
      // Default argv-to-command-line quoting would escape them away before
      // cmd.exe ever parses the line, so hand the arguments over verbatim --
      // exactly what node's own shell:true path does.
      windowsVerbatimArguments: batchWrapped,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let outputTruncated = false;
    let settled = false;
    // On Windows a killed cmd.exe does not kill its grandchildren, and an
    // orphaned pnpm->node chain holding the pipes keeps this promise hanging
    // past the timeout. Terminate the whole process tree instead.
    const killTree = () => {
      if (batchWrapped && child.pid) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      } else {
        child.kill();
      }
    };
    const append = (current, chunk) => {
      const combined = Buffer.concat([current, chunk]);
      if (combined.length > MAX_CAPTURE_BYTES) {
        outputTruncated = true;
        killTree();
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
      killTree();
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
