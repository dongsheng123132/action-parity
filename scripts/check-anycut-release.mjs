// Release gate for the anycut GitHub Release zip. Builds nothing itself —
// run `node scripts/build-anycut-release.mjs` first. This script only reads
// dist/ and the repo, and asserts the seven §8.5 acceptance criteria from
// docs/ANYCUT_V0.1_PLAN.md. Any failure here means the zip is not ready to
// attach to a GitHub Release.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "packages", "anycut", "package.json"), "utf8"));
const version = pkg.version;
const distName = `anycut-v${version}-win-x64`;
const distRoot = path.join(root, "dist", distName);
const zipPath = path.join(root, "dist", `${distName}.zip`);
const NETWORK_LIBRARY_NAMES = new Set(["axios", "node-fetch", "undici", "got", "request", "ws", "socket.io"]);

const checks = [];
function record(name, fn) {
  checks.push({ name, fn });
}

// 1. schema / negative fixtures / redaction rules / Registry binding — the
//    unit suite this repo already carries for anycut.
record("1 unit suite (schema/fixtures/redaction/registry) 18/18+", async () => {
  const out = await run(process.execPath, ["--test", "test/anycut.test.mjs"], root);
  assert(/pass \d+/.test(out) && !/fail [1-9]/.test(out), `anycut unit suite did not report a clean pass:\n${out}`);
});

// 2. all five commands invocable from inside the single packaged artifact.
record("2 five commands runnable from the packaged bundle", async () => {
  await requireDist();
  const cliPath = path.join(distRoot, "bin", "anycut.mjs");
  for (const command of ["capture", "inspect", "audit", "record", "tutorial"]) {
    // No args -> each command is expected to fail its own argument/usage
    // check, not crash with a module-resolution error. That distinguishes
    // "command wired up, bad args" from "command missing from the bundle".
    const { code, stdout } = await runAllowFail(process.execPath, [cliPath, command], distRoot);
    assert(code !== 0, `${command} with no args unexpectedly exited 0`);
    let envelope;
    try { envelope = JSON.parse(stdout); } catch { throw new Error(`${command} did not emit a JSON envelope: ${stdout}`); }
    assert(envelope.ok === false && envelope.error?.code, `${command} envelope missing structured error: ${stdout}`);
    assert(envelope.error.code !== "internal_error", `${command} failed with internal_error instead of a usage/argument error: ${stdout}`);
  }
});

// 3. runs in a clean environment with no repo/toolchain dependency — copy
//    the packaged artifact somewhere outside the repo and run it there,
//    using only what's inside the zip (its own node_modules + helper exe).
record("3 self-contained outside the repo (no compiler/workspace dependency)", async () => {
  await requireDist();
  const isolated = await mkdtemp(path.join(os.tmpdir(), "anycut-isolated-"));
  try {
    await run("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      `Copy-Item -Path '${distRoot}\\*' -Destination '${isolated}' -Recurse -Force`
    ], root);
    const cliPath = path.join(isolated, "bin", "anycut.mjs");
    const out = await run(process.execPath, [cliPath, "audit", "adapters", "list"], isolated);
    const envelope = JSON.parse(out);
    assert(envelope.ok === true, `packaged CLI failed to run standalone: ${out}`);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});

// 4. offline closed loop — the only in-tree auditor declares network:false,
//    the shipped dependency tree carries no networking library, and the
//    commands above ran to completion with a poisoned/unreachable proxy so
//    a silent network attempt would have surfaced as a failure instead.
record("4 offline (no network capability, no network attempt)", async () => {
  await requireDist();
  const cliPath = path.join(distRoot, "bin", "anycut.mjs");
  const out = await run(process.execPath, [cliPath, "audit", "adapters", "list"], distRoot);
  const envelope = JSON.parse(out);
  const builtin = envelope.data?.find?.((a) => a.id === "builtin") ?? envelope.data;
  assert(builtin && builtin.network === false, `builtin auditor does not declare network:false: ${out}`);
  const shippedDeps = await listDependencyNames(path.join(distRoot, "node_modules"));
  const networkCapable = [...shippedDeps].filter((name) => NETWORK_LIBRARY_NAMES.has(name));
  assert(networkCapable.length === 0, `shipped node_modules includes network-capable packages: ${networkCapable.join(", ")}`);
  // Force any accidental outbound call to fail fast rather than silently
  // succeed against a live proxy on this dev machine.
  const poisoned = { ...process.env, HTTP_PROXY: "http://127.0.0.1:1", HTTPS_PROXY: "http://127.0.0.1:1", NO_PROXY: "" };
  const { code, stdout, stderr } = await runAllowFail(process.execPath, [cliPath, "audit", "adapters", "list"], distRoot, poisoned);
  assert(code === 0, `CLI failed under a poisoned proxy — it may attempt network I/O: ${stdout}${stderr}`);
});

// 5/6. provenance — RELEASE.md's commit hash matches HEAD, and every file
// hash in SHA256SUMS (CLI source AND helper exe alike) recomputes clean,
// which is what makes "helper and CLI came from the same commit" checkable
// rather than asserted in prose.
record("5/6 provenance: commit hash matches HEAD; SHA256SUMS verifies helper+CLI", async () => {
  await requireDist();
  const headCommit = (await run("git", ["rev-parse", "HEAD"], root)).trim();
  const gitStatus = await run("git", ["status", "--porcelain", "--untracked-files=no"], root);
  assert(gitStatus.trim() === "", `working tree has uncommitted changes to tracked files; rebuild after committing so the recorded commit hash is trustworthy\n${gitStatus}`);
  const releaseNotes = await readFile(path.join(distRoot, "RELEASE.md"), "utf8");
  const commitMatch = releaseNotes.match(/commit `([0-9a-f]{7,40})`/);
  assert(commitMatch, "RELEASE.md does not record a commit hash");
  assert(commitMatch[1] === headCommit, `RELEASE.md commit ${commitMatch[1]} != HEAD ${headCommit}`);

  const sums = await readFile(path.join(distRoot, "SHA256SUMS"), "utf8");
  const lines = sums.trim().split(/\r?\n/).filter(Boolean);
  assert(lines.length > 0, "SHA256SUMS is empty");
  let sawHelper = false;
  for (const line of lines) {
    const [hash, rel] = line.split(/\s{2,}/);
    assert(hash && rel, `malformed SHA256SUMS line: ${line}`);
    const actual = await sha256(path.join(distRoot, rel));
    assert(actual === hash, `SHA256SUMS mismatch for ${rel}: manifest ${hash} != actual ${actual}`);
    if (rel.endsWith("anycut-windows.exe")) sawHelper = true;
  }
  assert(sawHelper, "SHA256SUMS does not include the anycut-windows.exe helper — helper and CLI provenance not jointly verifiable");

  if (await pathExists(zipPath)) {
    const zipHashFile = `${zipPath}.sha256`;
    if (await pathExists(zipHashFile)) {
      const [zipHash] = (await readFile(zipHashFile, "utf8")).trim().split(/\s+/);
      const actualZipHash = await sha256(zipPath);
      assert(zipHash === actualZipHash, `zip self-hash mismatch: recorded ${zipHash} != actual ${actualZipHash}`);
    }
  }
});

// 7. unverified targets must be declared as compatibility limitations, not
// silently omitted from the Go conclusion.
record("7 compatibility limitations section present and non-trivial", async () => {
  await requireDist();
  const releaseNotes = await readFile(path.join(distRoot, "RELEASE.md"), "utf8");
  const section = releaseNotes.match(/## 兼容性限制[\s\S]*?(?=\n## |$)/);
  assert(section, "RELEASE.md missing a 兼容性限制 (compatibility limitations) section");
  const body = section[0];
  assert(body.split("\n").filter((l) => l.trim().startsWith("-")).length >= 3,
    "compatibility limitations section looks empty/trivial (expected several bullet items)");
  assert(/U-King/.test(body), "compatibility limitations section does not mention the U-King validation result from §9.7");
});

let failures = 0;
for (const { name, fn } of checks) {
  try {
    await fn();
    process.stdout.write(`PASS  ${name}\n`);
  } catch (error) {
    failures += 1;
    process.stdout.write(`FAIL  ${name}\n      ${error.message}\n`);
  }
}
if (failures > 0) {
  process.stdout.write(`\n${failures}/${checks.length} checks failed\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\nall ${checks.length} §8.5 checks passed for ${distName}\n`);
}

// ---- helpers ----

async function requireDist() {
  const exists = await pathExists(distRoot);
  assert(exists, `${distRoot} does not exist — run \`node scripts/build-anycut-release.mjs\` first`);
}

async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function listDependencyNames(nodeModulesDir) {
  const names = new Set();
  if (!(await pathExists(nodeModulesDir))) return names;
  const entries = await readdir(nodeModulesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("@")) {
      const scoped = await readdir(path.join(nodeModulesDir, entry.name), { withFileTypes: true });
      for (const sub of scoped) if (sub.isDirectory()) names.add(`${entry.name}/${sub.name}`);
      continue;
    }
    names.add(entry.name);
  }
  return names;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function run(program, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, env: env ?? process.env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${program} ${args.join(" ")} exited ${code}\n${stderr || stdout}`));
    });
  });
}

function runAllowFail(program, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, env: env ?? process.env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
